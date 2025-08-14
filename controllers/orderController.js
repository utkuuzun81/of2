import Order from '../models/order.js';
import User from '../models/user.js';
import Product from '../models/product.js';
import PDFDocument from 'pdfkit';
import mongoose from 'mongoose';
import Settings from '../models/settings.js';
import LoyaltyTransaction from '../models/loyaltytransaction.js';
import Notification from '../models/notification.js';
import emitNotification from '../utils/emitNotification.js';
import { sendMail } from '../utils/mailer.js';

// Optional status normalization (English -> English kept; legacy TR mapped here if received)
const normalizeStatus = (s) => {
  const map = {
    bekliyor: 'pending',
    onaylandi: 'confirmed',
    faturalandi: 'processing',
    sevkiyatta: 'shipped',
    'teslim edildi': 'delivered',
    'iptal edildi': 'cancelled',
  };
  return map[s] || s;
};

// Robust line calculator to handle legacy field names
const toNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const lineAmount = (it) => {
  if (!it) return 0;
  const price = [
    it.price,
    it?.product?.price,
    it.unitPrice,
    it?.product?.unitPrice,
    it.linePrice,
    it.amount,
    it.totalPrice,
    it.lineTotal
  ].map(toNum).find((n) => n > 0) || 0;
  const qty = [
    it.quantity,
    it.qty,
    it.count,
    it.units
  ].map(toNum).find((n) => n > 0) || 0;
  return price * qty;
};

// Fallback: derive Date from Mongo ObjectId when createdAt is missing
function createdAtFromId(id) {
  try {
    const hex = String(id || '').slice(0, 8);
    const ts = parseInt(hex, 16);
    if (!Number.isFinite(ts)) return null;
    return new Date(ts * 1000);
  } catch { return null; }
}

// Sipariş oluştur
export async function createOrder(req, res, next) {
  try {
  const { items, shippingAddress, paymentMethod, pricing, billing } = req.body || {};
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Sipariş ürünleri eksik.' });
    }
    const userId = req.user?.id || req.user?._id?.toString();
  // Resolve product names for snapshotting into order lines so listings can display names without extra lookups
  let enrichedItems = items.map(it => ({ ...it }));
  try {
    const ids = Array.from(new Set(
      items
        .map(it => it?.productId || it?.product || it?.id)
        .filter(Boolean)
        .map(String)
    ));
    const objIds = ids.filter(s => /^[a-f\d]{24}$/i.test(s));
    const uuidIds = ids.filter(s => !/^[a-f\d]{24}$/i.test(s));
    if (ids.length) {
      const products = await Product.find({
        $or: [
          ...(objIds.length ? [{ _id: { $in: objIds } }] : []),
          ...(uuidIds.length ? [{ id: { $in: uuidIds } }] : [])
        ]
      }).select({ _id: 1, id: 1, name: 1, 'pricing.basePrice': 1, 'pricing.salePrice': 1 }).lean();
      const pMap = new Map();
      for (const p of products) {
        if (p._id) pMap.set(String(p._id), p);
        if (p.id) pMap.set(String(p.id), p);
      }
      enrichedItems = items.map(it => {
        const pid = it?.productId || it?.product || it?.id;
        const prod = pid ? pMap.get(String(pid)) : null;
        const name = it?.name || it?.product?.name || prod?.name;
        const unit = Number(it?.price ?? it?.product?.price ?? prod?.pricing?.salePrice ?? prod?.pricing?.basePrice ?? 0);
        return { ...it, productId: pid || it?.productId, name: name || it?.name, price: unit };
      });
    }
  } catch (e) {
    try { console.warn('[createOrder] item enrichment skipped:', e?.message); } catch {}
  }
  const totalAmount = pricing?.totalAmount ?? enrichedItems.reduce((sum, it) => sum + (Number(it.price || 0) * Number(it.quantity || 0)), 0);

    const order = new Order({
      orderNumber: 'ORD-' + Date.now(),
      userId,
      items: enrichedItems,
      shippingAddress: shippingAddress || undefined,
      billingInfo: billing || undefined,
      paymentInfo: { method: paymentMethod || 'unknown' },
      pricing: { totalAmount },
      status: 'pending'
    });
    const saved = await order.save();
    res.locals.createdOrderId = saved.id;
    res.locals.newOrder = saved;
    // Fire-and-forget: create in-app notification and send email (if configured)
    try {
      const userIdStr = req.user?.id || req.user?._id?.toString();
      const title = 'Sipariş oluşturuldu';
      const message = `Siparişiniz oluşturuldu. Sipariş No: ${saved.orderNumber || saved._id}`;
      const notif = await Notification.create({
        userId: userIdStr,
        type: 'order_status',
        priority: 'medium',
        title,
        message,
        metadata: { orderId: String(saved._id), orderNumber: saved.orderNumber },
        createdAt: new Date()
      });
      emitNotification(userIdStr, {
        id: notif.id,
        title,
        message,
        type: 'order_status',
        priority: 'medium',
        createdAt: notif.createdAt,
        metadata: notif.metadata
      });
      // Email (best-effort)
      const user = await User.findOne({ id: userIdStr }).lean();
      if (user?.email) {
        await sendMail({
          to: user.email,
          subject: 'Siparişiniz alındı',
          html: `<p>Merhaba,</p><p>Siparişiniz başarıyla oluşturuldu.</p><p><b>Sipariş No:</b> ${saved.orderNumber || saved._id}</p>`
        });
      }
    } catch (notifyErr) {
      try { console.warn('[OrderNotify] failed:', notifyErr?.message); } catch {}
    }
    return res.status(201).json({ orderId: String(saved._id), orderNumber: saved.orderNumber || String(saved._id), ...saved.toObject?.() });
  } catch (err) {
    console.error('❌ createOrder error:', err);
    return next(err);
  }
}

// Kullanıcı: Kendi siparişlerini listele
export async function getUserOrders(req, res, next) {
  try {
  const userId = req.user?.id || req.user?._id?.toString();
  const orders = await Order.find({ userId: userId, isDeleted: { $ne: true } }).sort({ createdAt: -1 });
    return res.status(200).json(orders);
  } catch (err) {
    console.error('❌ getUserOrders error:', err);
    return next(err);
  }
}

// Admin: Tüm siparişleri listele
export async function getAllOrdersAdmin(req, res, next) {
  try {
    // Only list "real" orders: has a userId, createdAt, and either totalAmount>0
    // or at least one line with positive quantity and price
    const orders = await Order.find({
      isDeleted: { $ne: true },
      createdAt: { $ne: null },
      userId: { $exists: true, $nin: [null, ''] },
      $or: [
        { 'pricing.totalAmount': { $gt: 0 } },
        {
          items: {
            $elemMatch: {
              $or: [
                { $and: [ { quantity: { $gt: 0 } }, { price: { $gt: 0 } } ] },
                { $and: [ { quantity: { $gt: 0 } }, { 'product.price': { $gt: 0 } } ] }
              ]
            }
          }
        }
      ]
    }).sort({ createdAt: -1 }).lean();
    // Build ID sets
    const userIds = new Set();
    const supplierIds = new Set();
    for (const o of orders) {
      if (o.userId) userIds.add(o.userId);
      if (o.supplierId) supplierIds.add(o.supplierId);
    }
  const allIds = Array.from(new Set([...userIds, ...supplierIds])).filter(Boolean);
    // Fetch users by either _id or uuid id
    const byObjectIds = allIds.filter((x)=> /^[a-f\d]{24}$/i.test(String(x)));
    const byUuidIds = allIds.filter((x)=> !/^[a-f\d]{24}$/i.test(String(x)));
  const users = await User.find({
      $or: [
        ...(byObjectIds.length ? [{ _id: { $in: byObjectIds } }] : []),
        ...(byUuidIds.length ? [{ id: { $in: byUuidIds } }] : [])
      ]
  }).select({ id: 1, email: 1, 'companyInfo.companyName': 1 }).lean();
    const map = new Map();
    for (const u of users) {
      // Key by both forms to maximize hit rate
      map.set(String(u._id), u);
      if (u.id) map.set(String(u.id), u);
    }
    // Resolve product names once for all orders to build human-friendly itemsPreview
    const prodUuidIds = new Set();
    const prodObjIds = new Set();
    for (const o of orders) {
      const items = Array.isArray(o.items) ? o.items : [];
      for (const it of items) {
        const pid = it?.productId || it?.product || it?.id;
        if (!pid) continue;
        const s = String(pid);
        if (/^[a-f\d]{24}$/i.test(s)) prodObjIds.add(s); else prodUuidIds.add(s);
      }
    }
    let prodMap = new Map();
    if (prodUuidIds.size || prodObjIds.size) {
      const products = await Product.find({
        $or: [
          ...(prodObjIds.size ? [{ _id: { $in: Array.from(prodObjIds) } }] : []),
          ...(prodUuidIds.size ? [{ id: { $in: Array.from(prodUuidIds) } }] : [])
        ]
      }).select({ _id: 1, id: 1, name: 1 }).lean();
      for (const p of products) {
        if (p._id) prodMap.set(String(p._id), p.name);
        if (p.id) prodMap.set(String(p.id), p.name);
      }
    }

    const enrichedRaw = orders.map((o)=>{
      const u = map.get(String(o.userId));
      const s = map.get(String(o.supplierId));
      const status = normalizeStatus(o.status);
      // compute a reliable total for display
      const lineSum = Array.isArray(o.items)
        ? o.items.reduce((sum, it) => sum + lineAmount(it), 0)
        : 0;
      const pricing = { ...(o.pricing || {}) };
      if (!(typeof pricing.totalAmount === 'number') || pricing.totalAmount <= 0) {
        pricing.totalAmount = lineSum;
      }
      const itemsPreview = Array.isArray(o.items) && o.items.length
        ? o.items
            .slice(0, 2)
            .map(it => {
              const pid = it?.productId || it?.product || it?.id;
              const resolved = it?.product?.name || it?.name || it?.title || it?.label || (pid ? prodMap.get(String(pid)) : null);
              return (resolved || 'Ürün') + (it?.quantity ? ` × ${it.quantity}` : '');
            })
            .join(', ')
            .trim() + (o.items.length > 2 ? ` +${o.items.length - 2}` : '')
        : '';
      const createdAt = o.createdAt || createdAtFromId(o._id) || null;
      const uiStatus = ({ pending:'Beklemede', confirmed:'Onaylandı', processing:'Hazırlanıyor', shipped:'Kargoda', delivered:'Teslim Edildi', cancelled:'İptal' }[status]) || 'Beklemede';
      const userDisplay =
        u?.companyInfo?.companyName ||
        u?.email ||
        o?.customerInfo?.companyName ||
        o?.customerInfo?.name ||
        o?.customerInfo?.email ||
        o?.billingAddress?.name ||
        o?.shippingAddress?.name ||
        o.userId ||
        null;
      const supplierDisplay = s?.companyInfo?.companyName || s?.email || o.supplierId || null;
      return {
        ...o,
        status,
        orderNumber: String(o.orderNumber || o._id || o.id || ''),
        pricing,
        itemsPreview,
        userDisplay,
        createdAt,
        uiStatus,
        supplierDisplay
      };
    });
    const enriched = enrichedRaw.filter(e => Number(e?.pricing?.totalAmount || 0) > 0);
  try { console.debug('[AdminOrders] total', orders.length); } catch {}
  return res.json(enriched);
  } catch (err) {
    console.error('❌ getAllOrdersAdmin error:', err);
    return next(err);
  }
}
export const getAllOrders = getAllOrdersAdmin;

// Admin: ID ile sipariş getir
export async function getOrderByIdAdmin(req, res, next) {
  try {
  const { id } = req.params;
  const query = { isDeleted: { $ne: true } };
  if (mongoose.Types.ObjectId.isValid(id)) query._id = id; else query.orderNumber = id;
  const order = await Order.findOne(query).lean();
    if (!order) {
      return res.status(404).json({ error: 'Sipariş bulunamadı.' });
    }
    // Enrich similar to list with safe lookup to avoid CastError
    const isHex = (v)=> /^[a-f\d]{24}$/i.test(String(v||''));
    let u = null;
    if (order.userId) {
      const uq = isHex(order.userId) ? { _id: order.userId } : { id: order.userId };
      u = await User.findOne(uq).select({ id:1, email:1, 'companyInfo.companyName':1 }).lean();
    }
    let s = null;
    if (order.supplierId) {
      const sq = isHex(order.supplierId) ? { _id: order.supplierId } : { id: order.supplierId };
      s = await User.findOne(sq).select({ id:1, email:1, 'companyInfo.companyName':1 }).lean();
    }
    const lineSum = Array.isArray(order.items)
      ? order.items.reduce((sum, it) => sum + lineAmount(it), 0)
      : 0;
    const pricing = { ...(order.pricing || {}) };
    if (!(typeof pricing.totalAmount === 'number') || pricing.totalAmount <= 0) pricing.totalAmount = lineSum;
    const out = {
      ...order,
      status: normalizeStatus(order.status),
      orderNumber: String(order.orderNumber || order._id || order.id || ''),
      pricing,
      userDisplay:
        u?.companyInfo?.companyName ||
        u?.email ||
        order?.customerInfo?.companyName ||
        order?.customerInfo?.name ||
        order?.customerInfo?.email ||
        order?.billingAddress?.name ||
        order?.shippingAddress?.name ||
        order.userId ||
        null,
      supplierDisplay: s?.companyInfo?.companyName || s?.email || order.supplierId || null,
    };
    return res.json(out);
  } catch (err) {
    console.error('❌ getOrderByIdAdmin error:', err);
    return next(err);
  }
}
export const getOrderById = getOrderByIdAdmin;

// Admin: Sipariş durumunu güncelle
export async function updateOrderStatus(req, res, next) {
  try {
  const status = normalizeStatus(req.body?.status);
  const validStatuses = ['pending','confirmed','processing','shipped','delivered','cancelled','refunded'];
  if (!validStatuses.includes(status)) return res.status(400).json({ error: 'Geçersiz durum değeri.' });
    const oldOrder = await Order.findById(req.params.id);
    const updated = await Order.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );
    res.locals.oldOrder = oldOrder;
    res.locals.updatedOrder = updated;
    // Award points on delivered (once per order)
    try {
      if (updated && status === 'delivered' && updated.userId) {
        const existing = await LoyaltyTransaction.findOne({ orderId: updated._id });
        if (!existing) {
          const sys = await Settings.findOne({ category: 'system' }).lean();
          const pts = sys?.systemSettings?.points || { earnRate: 1, levels: [] };
          const total = Number(updated?.pricing?.totalAmount || 0);
          const earnRate = Number(pts.earnRate || 1);
          // Resolve user ObjectId from stored string id or ObjectId string
          const isHex = (v)=> /^[a-f\d]{24}$/i.test(String(v||''));
          const uq = isHex(updated.userId) ? { _id: updated.userId } : { id: updated.userId };
          const userDoc = await User.findOne(uq).select({ _id:1 }).lean();
          const userObjectId = userDoc?._id;
          if (userObjectId) {
            const amount = Math.round(total * earnRate);
            if (amount > 0) {
              await LoyaltyTransaction.create({ userId: userObjectId, orderId: updated._id, type: 'earn', amount, reason: 'Order delivered', meta: { earnRate } });
            }
          }
        }
      }
    } catch (e) { try { console.warn('Points award skipped:', e?.message); } catch {} }
    return res.json(updated);
  } catch (err) {
    console.error('❌ updateOrderStatus error:', err);
    return next(err);
  }
}
export const updateOrder = updateOrderStatus;

// Admin: Kargo bilgisi ekle/güncelle
export async function updateShippingInfo(req, res, next) {
  try {
    const { company, trackingNumber } = req.body;
    const oldOrder = await Order.findById(req.params.id);
    const updated = await Order.findByIdAndUpdate(
      req.params.id,
      {
  shippingInfo: { company, trackingNumber, status: 'shipped' },
  shippedAt: new Date()
      },
      { new: true }
    );
    res.locals.oldOrder = oldOrder;
    res.locals.updatedOrder = updated;
    return res.json(updated);
  } catch (err) {
    console.error('❌ updateShippingInfo error:', err);
    return next(err);
  }
}

// Admin: Siparişi iptal et (durum değiştir, soft delete uygulama)
export async function cancelOrderAdmin(req, res, next) {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ error: 'Sipariş bulunamadı.' });
    }
    if (order.status !== 'pending') {
      return res.status(400).json({ error: 'Sadece beklemedeki siparişler iptal edilebilir.' });
    }
    res.locals.oldOrder = { ...order.toObject() };
    order.status = 'cancelled';
    order.isDeleted = true;
    await order.save();
    return res.json({ message: 'Sipariş iptal edildi.' });
  } catch (err) {
    console.error('❌ cancelOrderAdmin error:', err);
    return next(err);
  }
}
export const cancelOrder = cancelOrderAdmin;

// Admin: Fatura PDF oluştur
export async function getInvoice(req, res, next) {
  try {
  const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ error: 'Sipariş bulunamadı.' });
    }

    const doc = new PDFDocument();
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => {
      const pdf = Buffer.concat(chunks);
      res.status(200)
        .set({
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="Fatura_${order._id}.pdf"`
        })
        .send(pdf);
    });

    doc.fontSize(16).text('FATURA', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Sipariş No: ${order._id}`);
    doc.text(`Tarih: ${new Date(order.createdAt).toLocaleString()}`);
    doc.text(`Müşteri: ${order.user?.firmaAdi || 'Bilinmiyor'}`);
    doc.text(`UTS No: ${order.user?.utsNo || '—'}`);
    doc.moveDown();

    doc.text('Ürünler:');
  (order.items||[]).forEach((item, i) => {
      doc.text(
    `${i + 1}) ${item?.name || item?.product?.name || 'Ürün'} × ${item.quantity} — ${(item?.price || item?.product?.price || 0) * (item.quantity||0)} ₺`
      );
    });

    doc.moveDown();
    doc.fontSize(14).text(`Toplam Tutar: ${order.totalPrice} ₺`);
    doc.end();
  } catch (err) {
    console.error('❌ getInvoice error:', err);
    return next(err);
  }
}

// ======= EKLENENLER (BOŞ GÖVDE, KENDİNE GÖRE DOLDURABİLİRSİN) =======

// Merkez: Merkeze özel siparişleri listele
export async function getCenterOrders(req, res, next) {
  try {
    const userId = req.user?.id || req.user?._id?.toString();
    const orders = await Order.find({
      isDeleted: { $ne: true },
      userId,
      createdAt: { $ne: null },
      $or: [
        { 'pricing.totalAmount': { $gt: 0 } },
        {
          items: {
            $elemMatch: {
              $or: [
                { $and: [ { quantity: { $gt: 0 } }, { price: { $gt: 0 } } ] },
                { $and: [ { quantity: { $gt: 0 } }, { 'product.price': { $gt: 0 } } ] }
              ]
            }
          }
        }
      ]
    })
      .sort({ createdAt: -1 })
      .lean();

    // Resolve product names in bulk
    const prodUuidIds = new Set();
    const prodObjIds = new Set();
    for (const o of orders) {
      const items = Array.isArray(o.items) ? o.items : [];
      for (const it of items) {
        const pid = it?.productId || it?.product || it?.id;
        if (!pid) continue;
        const s = String(pid);
        if (/^[a-f\d]{24}$/i.test(s)) prodObjIds.add(s); else prodUuidIds.add(s);
      }
    }
    let prodMap = new Map();
    if (prodUuidIds.size || prodObjIds.size) {
      const products = await Product.find({
        $or: [
          ...(prodObjIds.size ? [{ _id: { $in: Array.from(prodObjIds) } }] : []),
          ...(prodUuidIds.size ? [{ id: { $in: Array.from(prodUuidIds) } }] : [])
        ]
      }).select({ _id: 1, id: 1, name: 1 }).lean();
      for (const p of products) {
        if (p._id) prodMap.set(String(p._id), p.name);
        if (p.id) prodMap.set(String(p.id), p.name);
      }
    }

    const normalizedRaw = orders.map((o) => {
      const status = normalizeStatus(o.status);
      const lineSum = Array.isArray(o.items)
        ? o.items.reduce((sum, it) => sum + lineAmount(it), 0)
        : 0;
      const pricing = { ...(o.pricing || {}) };
      if (!(typeof pricing.totalAmount === 'number') || pricing.totalAmount <= 0) {
        pricing.totalAmount = lineSum;
      }
      const itemsPreview = Array.isArray(o.items) && o.items.length
        ? o.items.slice(0, 2)
            .map(it => {
              const pid = it?.productId || it?.product || it?.id;
              const resolved = it?.product?.name || it?.name || it?.title || it?.label || (pid ? prodMap.get(String(pid)) : null);
              return (resolved || 'Ürün') + (it?.quantity ? ` × ${it.quantity}` : '');
            })
            .join(', ')
            .trim() + (o.items.length > 2 ? ` +${o.items.length - 2}` : '')
        : '-';
      const createdAt = o.createdAt || createdAtFromId(o._id) || null;
      return {
        ...o,
        status,
        orderNumber: String(o.orderNumber || o._id || o.id || ''),
        pricing,
        itemsPreview,
        createdAt,
      };
    });
    return res.json(normalizedRaw.filter(e => Number(e?.pricing?.totalAmount || 0) > 0));
  } catch (err) {
    next(err);
  }
}

// Tedarikçi: Tedarikçiye özel siparişleri listele
export async function getSupplierOrders(req, res, next) {
  try {
  const supplierId = req.user?.id || req.user?._id?.toString();
  const orders = await Order.find({
      isDeleted: { $ne: true },
      supplierId,
      createdAt: { $ne: null },
      $or: [
        { 'pricing.totalAmount': { $gt: 0 } },
        {
          items: {
            $elemMatch: {
              $or: [
                { $and: [ { quantity: { $gt: 0 } }, { price: { $gt: 0 } } ] },
                { $and: [ { quantity: { $gt: 0 } }, { 'product.price': { $gt: 0 } } ] }
              ]
            }
          }
        }
      ]
    }).sort({ createdAt: -1 }).lean();
    // Resolve product names in bulk
    const prodUuidIds = new Set();
    const prodObjIds = new Set();
    for (const o of orders) {
      const items = Array.isArray(o.items) ? o.items : [];
      for (const it of items) {
        const pid = it?.productId || it?.product || it?.id;
        if (!pid) continue;
        const s = String(pid);
        if (/^[a-f\d]{24}$/i.test(s)) prodObjIds.add(s); else prodUuidIds.add(s);
      }
    }
    let prodMap = new Map();
    if (prodUuidIds.size || prodObjIds.size) {
      const products = await Product.find({
        $or: [
          ...(prodObjIds.size ? [{ _id: { $in: Array.from(prodObjIds) } }] : []),
          ...(prodUuidIds.size ? [{ id: { $in: Array.from(prodUuidIds) } }] : [])
        ]
      }).select({ _id: 1, id: 1, name: 1 }).lean();
      for (const p of products) {
        if (p._id) prodMap.set(String(p._id), p.name);
        if (p.id) prodMap.set(String(p.id), p.name);
      }
    }

    const enrichedRaw = orders.map(o => {
      const status = normalizeStatus(o.status);
      const lineSum = Array.isArray(o.items)
        ? o.items.reduce((s, it) => s + lineAmount(it), 0)
        : 0;
      const pricing = { ...(o.pricing || {}) };
      if (!(typeof pricing.totalAmount === 'number') || pricing.totalAmount <= 0) {
        pricing.totalAmount = lineSum;
      }
      const itemsPreview = Array.isArray(o.items) && o.items.length
        ? o.items.slice(0, 2)
            .map(it => {
              const pid = it?.productId || it?.product || it?.id;
              const resolved = it?.product?.name || it?.name || it?.title || it?.label || (pid ? prodMap.get(String(pid)) : null);
              return (resolved || 'Ürün') + (it?.quantity ? ` × ${it.quantity}` : '');
            })
            .join(', ')
            .trim() + (o.items.length > 2 ? ` +${o.items.length - 2}` : '')
        : '-';
      const createdAt = o.createdAt || createdAtFromId(o._id) || null;
      return {
        ...o,
        status,
        orderNumber: String(o.orderNumber || o._id || o.id || ''),
        pricing,
        itemsPreview,
        createdAt,
      };
    });
    return res.json(enrichedRaw.filter(e => Number(e?.pricing?.totalAmount || 0) > 0));
  } catch (err) {
    next(err);
  }
}

// Admin: Tüm siparişleri (eski route ile)
// alias already declared above

// Sipariş Detay
// Route alias: generic get by id (uses admin resolver for now)
export const getOrder = getOrderByIdAdmin;

// Siparişe tedarikçi atama
export async function assignSupplier(req, res, next) {
  try {
    const { supplierId } = req.body;
    if (!supplierId) return res.status(400).json({ error: 'supplierId zorunlu' });
    const updated = await Order.findByIdAndUpdate(
      req.params.id,
      { supplierId },
      { new: true }
    );
    if (!updated) return res.status(404).json({ error: 'Sipariş bulunamadı.' });
    return res.json(updated);
  } catch (err) {
    next(err);
  }
}

// Siparişe kargo takip bilgisi ekleme
export async function addTrackingInfo(req, res, next) {
  try {
    const { company, trackingNumber, status } = req.body;
    const updated = await Order.findByIdAndUpdate(
      req.params.id,
      {
        shippingInfo: {
          company: company || null,
          trackingNumber: trackingNumber || null,
          status: status || 'in_transit'
        }
      },
      { new: true }
    );
    if (!updated) return res.status(404).json({ error: 'Sipariş bulunamadı.' });
    return res.json(updated);
  } catch (err) {
    next(err);
  }
}

// Sipariş için fatura indir
// Route alias: invoice download
export const getOrderInvoice = getInvoice;

// Sipariş istatistikleri
export async function getOrderStatistics(req, res, next) {
  try {
    const total = await Order.countDocuments({ isDeleted: { $ne: true } });
    const byStatus = await Order.aggregate([
      { $match: { isDeleted: { $ne: true } } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    return res.json({ total, byStatus });
  } catch (err) {
    next(err);
  }
}
