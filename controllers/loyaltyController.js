import Order from '../models/order.js';
import LoyaltyTransaction from '../models/LoyaltyTransaction.js';
import mongoose from 'mongoose';
import User from '../models/user.js';
import Settings from '../models/Settings.js';

export const getSummary = async (req, res) => {
  // Orders are stored with userId as string (uuid) on Order, but LoyaltyTransaction.userId is ObjectId
  const userIdStr = req.user?.id || req.user?._id?.toString();
  const orderCount = await Order.countDocuments({ userId: userIdStr, isDeleted: { $ne: true } });
  // Resolve user's ObjectId for loyalty transactions
  const isHex = (v) => /^[a-f\d]{24}$/i.test(String(v || ''));
  const uq = isHex(userIdStr) ? { _id: userIdStr } : { id: userIdStr };
  const userDoc = await User.findOne(uq).select({ _id: 1 }).lean();
  const userObjectId = userDoc?._id;

  let credit = 0;
  if (userObjectId) {
    // Sum all transaction amounts for this user (earn/adjust positive, spend negative if any)
    const agg = await LoyaltyTransaction.aggregate([
      { $match: { userId: userObjectId } },
      { $group: { _id: null, balance: { $sum: { $ifNull: ['$amount', 0] } } } }
    ]);
    credit = Math.round((agg?.[0]?.balance || 0));
  }
  res.json({ orderCount, credit });
};

export const getTransactions = async (req, res) => {
  // Resolve user ObjectId then list transactions
  const userIdStr = req.user?.id || req.user?._id?.toString();
  const isHex = (v) => /^[a-f\d]{24}$/i.test(String(v || ''));
  const uq = isHex(userIdStr) ? { _id: userIdStr } : { id: userIdStr };
  const userDoc = await User.findOne(uq).select({ _id: 1 }).lean();
  if (!userDoc?._id) return res.json([]);
  const tx = await LoyaltyTransaction.find({ userId: userDoc._id }).sort({ createdAt: -1 }).limit(200).lean();
  res.json(tx.map(t => ({ id: String(t._id), type: t.type, amount: t.amount, date: t.createdAt, desc: t.reason })));
};

// Admin: assign or remove points for any user
export const adminAssignPoints = async (req, res) => {
  const { userId, amount, reason } = req.body || {};
  if (!userId || !Number.isFinite(Number(amount))) return res.status(400).json({ error: 'userId ve amount gerekli' });
  const uid = mongoose.Types.ObjectId.isValid(userId) ? userId : null;
  if (!uid) return res.status(400).json({ error: 'Geçersiz userId' });
  const tx = await LoyaltyTransaction.create({ userId: uid, type: 'adjust', amount: Number(amount), reason: reason || 'Admin adjustment' });
  res.json({ id: tx._id, success: true });
};

export const adminListUserTransactions = async (req, res) => {
  const { userId } = req.params;
  const uid = mongoose.Types.ObjectId.isValid(userId) ? userId : null;
  if (!uid) return res.status(400).json({ error: 'Geçersiz userId' });
  const tx = await LoyaltyTransaction.find({ userId: uid }).sort({ createdAt: -1 }).limit(500).lean();
  res.json(tx);
};

// Admin: Audit loyalty balances and check delivered orders vs. earn transactions
export const adminAudit = async (req, res) => {
  try {
    // Aggregate balances per user from transactions
    const perUser = await LoyaltyTransaction.aggregate([
      {
        $group: {
          _id: '$userId',
          txCount: { $sum: 1 },
          lastTxAt: { $max: '$createdAt' },
          totalCredit: { $sum: { $ifNull: ['$amount', 0] } },
          totalEarn: {
            $sum: {
              $cond: [{ $eq: ['$type', 'earn'] }, { $ifNull: ['$amount', 0] }, 0]
            }
          },
          totalSpend: {
            $sum: {
              $cond: [{ $eq: ['$type', 'spend'] }, { $ifNull: ['$amount', 0] }, 0]
            }
          },
          totalAdjust: {
            $sum: {
              $cond: [{ $eq: ['$type', 'adjust'] }, { $ifNull: ['$amount', 0] }, 0]
            }
          },
          earnOrderCount: {
            $sum: {
              $cond: [
                { $and: [ { $eq: ['$type', 'earn'] }, { $ifNull: ['$orderId', false] } ] },
                1,
                0
              ]
            }
          }
        }
      },
      // Join user to fetch uuid id and email/company
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
      // Lookup delivered orders for that user (Order.userId holds uuid string)
      {
        $lookup: {
          from: 'orders',
          let: { userUuid: '$user.id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$userId', '$$userUuid'] },
                    { $eq: ['$status', 'delivered'] },
                    { $ne: ['$isDeleted', true] }
                  ]
                }
              }
            },
            { $count: 'deliveredCount' }
          ],
          as: 'deliveredAgg'
        }
      },
      {
        $addFields: {
          deliveredCount: { $ifNull: [ { $arrayElemAt: ['$deliveredAgg.deliveredCount', 0] }, 0 ] }
        }
      },
      {
        $project: {
          _id: 0,
          userObjectId: '$_id',
          userUuid: '$user.id',
          email: '$user.email',
          companyName: '$user.companyInfo.companyName',
          txCount: 1,
          lastTxAt: 1,
          totalCredit: 1,
          totalEarn: 1,
          totalSpend: 1,
          totalAdjust: 1,
          earnOrderCount: 1,
          deliveredCount: 1,
          missingEarnForDelivered: {
            $let: {
              vars: {
                diff: { $subtract: ['$deliveredCount', '$earnOrderCount'] }
              },
              in: { $cond: [{ $gt: ['$$diff', 0] }, '$$diff', 0] }
            }
          }
        }
      },
      { $sort: { missingEarnForDelivered: -1, totalCredit: -1 } }
    ]);

    res.json({
      generatedAt: new Date(),
      users: perUser
    });
  } catch (err) {
    console.error('adminAudit error:', err);
    res.status(500).json({ error: 'Denetim sırasında hata oluştu.' });
  }
};

// Admin: Backfill missing earn transactions for delivered orders
export const adminBackfillEarn = async (req, res) => {
  try {
    const now = new Date();
    const defFrom = new Date(now);
    defFrom.setMonth(defFrom.getMonth() - 6); // default last 6 months
    const { from, to, dryRun } = req.query;
    const range = {
      from: from ? new Date(from) : defFrom,
      to: to ? new Date(to) : now,
    };
    // Fetch delivered orders in range
    const orders = await Order.find({
      status: 'delivered',
      isDeleted: { $ne: true },
      createdAt: { $gte: range.from, $lte: range.to },
    }).select({ _id: 1, userId: 1, 'pricing.totalAmount': 1 }).lean();

    if (!orders.length) return res.json({ processed: 0, missing: 0, created: 0, skipped: 0, details: [] });

    // Existing tx by orderId
    const orderIds = orders.map(o => o._id);
    const existing = await LoyaltyTransaction.find({ orderId: { $in: orderIds } }).select({ orderId: 1 }).lean();
    const existingSet = new Set(existing.map(e => String(e.orderId)));

    const toFix = orders.filter(o => !existingSet.has(String(o._id)));

    // Resolve users in bulk (orders.userId is uuid or hex string of ObjectId)
    const userIdStrings = Array.from(new Set(toFix.map(o => String(o.userId)).filter(Boolean)));
    const isHex = (v) => /^[a-f\d]{24}$/i.test(String(v || ''));
    const hexIds = userIdStrings.filter(isHex);
    const uuidIds = userIdStrings.filter(id => !isHex(id));
    const users = await User.find({
      $or: [
        ...(hexIds.length ? [{ _id: { $in: hexIds } }] : []),
        ...(uuidIds.length ? [{ id: { $in: uuidIds } }] : []),
      ],
    }).select({ _id: 1, id: 1 }).lean();
    const userMap = new Map();
    for (const u of users) {
      if (u.id) userMap.set(String(u.id), u._id);
      userMap.set(String(u._id), u._id);
    }

    // Earn rate from settings
    const sys = await Settings.findOne({ category: 'system' }).lean();
    const earnRate = Number(sys?.systemSettings?.points?.earnRate || 1);

    const details = [];
    const docs = [];
    let skipped = 0;
    for (const o of toFix) {
      const userObjectId = userMap.get(String(o.userId));
      const total = Number(o?.pricing?.totalAmount || 0);
      const amount = Math.round(total * earnRate);
      if (!userObjectId) {
        skipped++;
        details.push({ orderId: o._id, reason: 'user-not-found', userId: o.userId });
        continue;
      }
      if (!(amount > 0)) {
        skipped++;
        details.push({ orderId: o._id, reason: 'non-positive-amount', total, earnRate });
        continue;
      }
      docs.push({ userId: userObjectId, orderId: o._id, type: 'earn', amount, reason: 'Backfill: order delivered', meta: { earnRate } });
    }

    if (dryRun === 'true') {
      return res.json({ processed: orders.length, missing: toFix.length, wouldCreate: docs.length, skipped, details: details.slice(0, 100) });
    }

    const created = docs.length ? await LoyaltyTransaction.insertMany(docs, { ordered: false }) : [];
    return res.json({ processed: orders.length, missing: toFix.length, created: created.length, skipped, details: details.slice(0, 100) });
  } catch (err) {
    console.error('adminBackfillEarn error:', err);
    res.status(500).json({ error: 'Backfill sırasında hata oluştu.' });
  }
};
