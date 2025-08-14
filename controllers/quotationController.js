import Quotation from '../models/quotation.js';
import Joi from 'joi';

const quotationCreateSchema = Joi.object({
  requestType: Joi.string().valid('quick-sell', 'sell', 'buy').required(),
  requestInfo: Joi.object({
    title: Joi.string().min(3).required(),
    description: Joi.string().min(3).required(),
    quantity: Joi.number().min(1).required(),
    budgetRange: Joi.object({
      min: Joi.number().min(0),
      max: Joi.number().min(0),
      currency: Joi.string().required()
    }).required(),
    deliveryDate: Joi.string().isoDate().optional(),
    deliveryAddress: Joi.object().optional()
  }).required(),
  requestedItems: Joi.array().items(
    Joi.object({
      productId: Joi.string().required(),
      quantity: Joi.number().min(1).required(),
      specifications: Joi.string().allow(''),
      estimatedUnitPrice: Joi.number().min(0)
    })
  ).min(1).required(),
  // For sell flow
  sellInfo: Joi.object({
  desiredUnitPrice: Joi.number().min(0).required(),
    commissionRate: Joi.number().min(0).max(1).optional(),
    commissionPassThrough: Joi.string().valid('absorb','pass').optional()
  }).optional(),
  // For buy flow
  buyInfo: Joi.object({
    paymentOption: Joi.string().valid('cash', 'installment').required()
  }).optional(),
  supplierId: Joi.string().allow(null, '').optional(),
  priority: Joi.string().valid('low', 'medium', 'high', 'urgent').optional()
});

const supplierRespondSchema = Joi.object({
  supplierResponse: Joi.object({
    respondedAt: Joi.date().iso(),
    validUntil: Joi.date().iso().required(),
    quotedItems: Joi.array().items(
      Joi.object({
        productId: Joi.string().required(),
        quantity: Joi.number().min(1).required(),
        unitPrice: Joi.number().min(0).required(),
        totalPrice: Joi.number().min(0).required(),
        deliveryTime: Joi.number().min(0),
        warranty: Joi.number(),
        notes: Joi.string().allow('')
      })
    ).required(),
    totalAmount: Joi.number().min(0).required(),
    currency: Joi.string().required(),
    paymentTerms: Joi.string().allow(''),
    deliveryTerms: Joi.string().allow(''),
    notes: Joi.string().allow(''),
    attachments: Joi.array().items(
      Joi.object({
        name: Joi.string(),
        url: Joi.string().uri(),
        size: Joi.number()
      })
    )
  }).required()
});

const messageSchema = Joi.object({
  message: Joi.string().min(1).required()
});

export const createQuotation = async (req, res, next) => {
  try {
    const { error } = quotationCreateSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.details[0].message });

    // Normalize numeric strings
    if (req.body?.requestInfo) {
      if (req.body.requestInfo.quantity != null) req.body.requestInfo.quantity = Number(req.body.requestInfo.quantity);
      if (req.body.requestInfo.budgetRange) {
        const br = req.body.requestInfo.budgetRange;
        if (br.min != null) br.min = Number(br.min);
        if (br.max != null) br.max = Number(br.max);
      }
    }
    if (Array.isArray(req.body.requestedItems)) {
      req.body.requestedItems = req.body.requestedItems.map(it => ({
        ...it,
        quantity: it.quantity != null ? Number(it.quantity) : it.quantity,
        estimatedUnitPrice: it.estimatedUnitPrice != null ? Number(it.estimatedUnitPrice) : it.estimatedUnitPrice
      }));
    }
    if (req.body.sellInfo) {
      if (req.body.sellInfo.desiredUnitPrice != null) req.body.sellInfo.desiredUnitPrice = Number(req.body.sellInfo.desiredUnitPrice);
      if (req.body.sellInfo.commissionRate != null) req.body.sellInfo.commissionRate = Number(req.body.sellInfo.commissionRate);
    }

    // Business rules based on request type
    const { requestType } = req.body;
    if (requestType === 'buy') {
      const totalQty = (req.body.requestedItems || []).reduce((a, i) => a + (i.quantity || 0), 0);
      if (totalQty < 10)
        return res.status(400).json({ message: 'Alım taleplerinde toplam adet en az 10 olmalıdır.' });
      if (!req.body.buyInfo?.paymentOption)
        return res.status(400).json({ message: 'Ödeme seçeneği zorunludur (Nakit/Taksit).' });
    }

    let sellCalc = null;
    if (requestType === 'sell') {
      const commissionRate = typeof req.body.sellInfo?.commissionRate === 'number' ? req.body.sellInfo.commissionRate : 0.05;
      const quantity = req.body.requestInfo?.quantity || 1;
      const desired = req.body.sellInfo?.desiredUnitPrice || 0;
      const gross = desired * quantity;
      const commissionAmount = Math.round(gross * commissionRate * 100) / 100;
      const passThrough = req.body.sellInfo?.commissionPassThrough === 'pass';
      const netProceeds = passThrough
        ? Math.round(gross * 100) / 100 // müşteri öderse net brüt ile aynı kalır
        : Math.round((gross - commissionAmount) * 100) / 100;
      const customerTotal = passThrough
        ? Math.round((gross + commissionAmount) * 100) / 100
        : Math.round(gross * 100) / 100;
      const customerUnitPrice = quantity > 0 ? Math.round((customerTotal / quantity) * 100) / 100 : desired;
      sellCalc = { commissionRate, commissionAmount, netProceeds, commissionPassThrough: req.body.sellInfo?.commissionPassThrough || 'absorb', customerTotal, customerUnitPrice };
    }

    // Quick-sell: system generates an instant indicative offer
    let supplierResponse = undefined;
    if (requestType === 'quick-sell') {
      // Fetch discount from settings (optional; if not available default 10%)
      let quickSellDiscount = 10;
      let quickSellEnabled = true;
      let minD = 0, maxD = 50;
      try {
  const Settings = (await import('../models/settings.js')).default;
        const s = await Settings.findOne({ category: 'system' });
        const sys = s?.systemSettings || {};
        if (typeof sys.quickSellDiscount === 'number') quickSellDiscount = sys.quickSellDiscount;
        if (typeof sys.quickSellMinDiscount === 'number') minD = sys.quickSellMinDiscount;
        if (typeof sys.quickSellMaxDiscount === 'number') maxD = sys.quickSellMaxDiscount;
        quickSellEnabled = Boolean(sys.quickSellEnabled ?? true);
      } catch {}
      if (!quickSellEnabled) return res.status(403).json({ message: 'Hızlı Sat şu an devre dışı.' });
      if (Number.isFinite(minD) && Number.isFinite(maxD)) {
        quickSellDiscount = Math.min(Math.max(quickSellDiscount, minD), maxD);
      }
      const items = Array.isArray(req.body.requestedItems) ? req.body.requestedItems : [];
      const quotedItems = items
        .filter(it => Number(it.estimatedUnitPrice) > 0)
        .map(it => {
          const unit = Math.round(Number(it.estimatedUnitPrice) * (1 - (quickSellDiscount/100)) * 100) / 100;
          const qty = Number(it.quantity || 1);
          return {
            productId: it.productId,
            quantity: qty,
            unitPrice: unit,
            totalPrice: Math.round(unit * qty * 100) / 100
          };
        });
      const totalAmount = quotedItems.reduce((a, it) => a + it.totalPrice, 0);
      supplierResponse = {
        respondedAt: new Date(),
        validUntil: new Date(Date.now() + 1000 * 60 * 60 * 24 * 3), // 3 gün
        quotedItems,
        totalAmount: Math.round(totalAmount * 100) / 100,
        currency: req.body.requestInfo?.budgetRange?.currency || 'TRY',
        paymentTerms: 'Hızlı Sat anında ödeme',
        deliveryTerms: 'Depoya teslim',
        notes: 'Sistem tarafından otomatik fiyat teklifi'
      };
    }

    const quotation = await Quotation.create({
      quoteNumber: 'QUO-' + Date.now(),
      requesterId: req.user.id,
      supplierId: req.body.supplierId || null,
      requestType,
      status: requestType === 'quick-sell' ? 'quoted' : 'pending',
      priority: req.body.priority || 'medium',
      requestInfo: req.body.requestInfo,
      requestedItems: req.body.requestedItems,
      sellInfo: sellCalc
        ? { desiredUnitPrice: req.body.sellInfo?.desiredUnitPrice, commissionRate: sellCalc.commissionRate, commissionAmount: sellCalc.commissionAmount, netProceeds: sellCalc.netProceeds, commissionPassThrough: sellCalc.commissionPassThrough, customerTotal: sellCalc.customerTotal, customerUnitPrice: sellCalc.customerUnitPrice }
        : undefined,
      buyInfo: req.body.buyInfo || undefined,
      supplierResponse: supplierResponse,
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      expiresAt: req.body.requestInfo.deliveryDate || null
    });

    res.locals.oldValue = null;
    res.locals.newValue = quotation;
    res.status(201).json({
      id: quotation._id,
      quoteNumber: quotation.quoteNumber,
      status: quotation.status,
      requestType: quotation.requestType,
      sellInfo: quotation.sellInfo,
      supplierResponse: quotation.supplierResponse
    });
  } catch (err) {
    next(err);
  }
};

export const getQuotationsForCenter = async (req, res, next) => {
  try {
  const list = await Quotation.find({ requesterId: req.user.id, isDeleted: { $ne: true } });
    res.status(200).json(list);
  } catch (err) {
    next(err);
  }
};

export const getQuotationsForSupplier = async (req, res, next) => {
  try {
    const list = await Quotation.find({ supplierId: req.user.id, isDeleted: { $ne: true } });
    res.status(200).json(list);
  } catch (err) {
    next(err);
  }
};

export const getAllQuotationsAdmin = async (req, res, next) => {
  try {
    // Optional basic filters: status, requestType
    const { status, requestType } = req.query || {};
    const q = { isDeleted: { $ne: true } };
    if (status) q.status = status;
    if (requestType) q.requestType = requestType;
    const list = await Quotation.find(q).sort({ createdAt: -1 }).limit(1000).lean();

    // Enrich with requester/supplier display info (support both User.id and User._id)
    try {
      const ids = new Set();
      for (const it of list) {
        if (it.requesterId) ids.add(String(it.requesterId));
        if (it.supplierId) ids.add(String(it.supplierId));
      }
      if (ids.size) {
        const { default: User } = await import('../models/user.js');
        const { default: mongoose } = await import('mongoose');
        const idArr = Array.from(ids);
        const objIds = idArr
          .filter(v => typeof v === 'string' && /^[a-f0-9]{24}$/i.test(v))
          .map(v => new mongoose.Types.ObjectId(v));
        const or = [{ id: { $in: idArr } }];
        if (objIds.length) or.push({ _id: { $in: objIds } });
        const users = await User.find({ $or: or })
          .select('id _id email personalInfo.firstName personalInfo.lastName companyInfo.companyName companyInfo.name')
          .lean();
        // Map by both id and _id
        const map = new Map();
        for (const u of users) {
          if (u.id) map.set(String(u.id), u);
          if (u._id) map.set(String(u._id), u);
        }
        for (const it of list) {
          const rqU = it.requesterId ? map.get(String(it.requesterId)) : null;
          const spU = it.supplierId ? map.get(String(it.supplierId)) : null;
          const shape = (u) => u ? ({
            id: u.id || String(u._id),
            email: u.email,
            firstName: u.personalInfo?.firstName,
            lastName: u.personalInfo?.lastName,
            fullName: [u.personalInfo?.firstName, u.personalInfo?.lastName].filter(Boolean).join(' ') || undefined,
            companyName: u.companyInfo?.companyName || u.companyInfo?.name
          }) : null;
          it._requester = shape(rqU);
          it._supplier = shape(spU);
        }
      }
    } catch {}

    res.status(200).json(list);
  } catch (err) {
    next(err);
  }
};

export const getQuotationById = async (req, res, next) => {
  try {
  const q = await Quotation.findOne({ _id: req.params.id, isDeleted: { $ne: true } });
    if (!q) return res.status(404).json({ message: 'Teklif bulunamadı.' });

    if (
      (req.user.role === 'center' && String(q.requesterId) !== String(req.user.id)) ||
      (req.user.role === 'supplier' && q.supplierId && String(q.supplierId) !== String(req.user.id))
    ) return res.status(403).json({ message: 'Yetkiniz yok.' });

    // Enrich with minimal requester/supplier info for UI (supports id/_id)
    let out = q.toObject ? q.toObject() : q;
    try {
      const ids = [q.requesterId, q.supplierId].filter(Boolean).map(String);
      if (ids.length) {
        const { default: User } = await import('../models/user.js');
        const { default: mongoose } = await import('mongoose');
        const objIds = ids.filter(v => /^[a-f0-9]{24}$/i.test(v)).map(v => new mongoose.Types.ObjectId(v));
        const or = [{ id: { $in: ids } }];
        if (objIds.length) or.push({ _id: { $in: objIds } });
        const users = await User.find({ $or: or })
          .select('id _id email personalInfo.firstName personalInfo.lastName companyInfo.companyName companyInfo.name')
          .lean();
        const map = new Map();
        for (const u of users) {
          if (u.id) map.set(String(u.id), u);
          if (u._id) map.set(String(u._id), u);
        }
        const rq = q.requesterId ? map.get(String(q.requesterId)) : null;
        const sp = q.supplierId ? map.get(String(q.supplierId)) : null;
        const shape = (u) => u ? ({
          id: u.id || String(u._id),
          email: u.email,
          firstName: u.personalInfo?.firstName,
          lastName: u.personalInfo?.lastName,
          fullName: [u.personalInfo?.firstName, u.personalInfo?.lastName].filter(Boolean).join(' ') || undefined,
          companyName: u.companyInfo?.companyName || u.companyInfo?.name
        }) : null;
        out._requester = shape(rq);
        out._supplier = shape(sp);
      }
    } catch {}

    res.status(200).json(out);
  } catch (err) {
    next(err);
  }
};

export const respondQuotation = async (req, res, next) => {
  try {
    const { error } = supplierRespondSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.details[0].message });

  const q = await Quotation.findOne({ _id: req.params.id, isDeleted: { $ne: true } });
    if (!q) return res.status(404).json({ message: 'Teklif bulunamadı.' });
  if (q.supplierId && String(q.supplierId) !== String(req.user.id))
      return res.status(403).json({ message: 'Sadece atanan tedarikçi teklif verebilir.' });

    q.supplierResponse = {
      ...req.body.supplierResponse,
      respondedAt: new Date()
    };
    q.status = 'quoted';
    q.updatedAt = new Date();
    await q.save();

    res.locals.oldValue = null;
    res.locals.newValue = q;
    res.json({ status: q.status, validUntil: q.supplierResponse.validUntil });
  } catch (err) {
    next(err);
  }
};

export const acceptQuotation = async (req, res, next) => {
  try {
  const q = await Quotation.findOne({ _id: req.params.id, isDeleted: { $ne: true } });
    if (!q) return res.status(404).json({ message: 'Teklif bulunamadı.' });
    if (q.requesterId.toString() !== req.user.id)
      return res.status(403).json({ message: 'Sadece teklif isteyen kullanıcı onaylayabilir.' });
    if (q.status !== 'quoted')
      return res.status(400).json({ message: 'Henüz tedarikçi teklif vermedi.' });

    q.status = 'accepted';
    q.updatedAt = new Date();
    await q.save();

    res.locals.oldValue = null;
    res.locals.newValue = q;
    res.json({ status: 'accepted' });
  } catch (err) {
    next(err);
  }
};

export const rejectQuotation = async (req, res, next) => {
  try {
  const q = await Quotation.findOne({ _id: req.params.id, isDeleted: { $ne: true } });
    if (!q) return res.status(404).json({ message: 'Teklif bulunamadı.' });
    if (q.requesterId.toString() !== req.user.id)
      return res.status(403).json({ message: 'Sadece teklif isteyen kullanıcı reddedebilir.' });

    q.status = 'rejected';
    q.updatedAt = new Date();
    await q.save();

    res.locals.oldValue = null;
    res.locals.newValue = q;
    res.json({ status: 'rejected' });
  } catch (err) {
    next(err);
  }
};

export const addMessage = async (req, res, next) => {
  try {
    const { error } = messageSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.details[0].message });

  const q = await Quotation.findOne({ _id: req.params.id, isDeleted: { $ne: true } });
    if (!q) return res.status(404).json({ message: 'Teklif bulunamadı.' });

  if (![q.requesterId && q.requesterId.toString(), q.supplierId && q.supplierId.toString()].filter(Boolean).includes(req.user.id))
      return res.status(403).json({ message: 'Sadece merkez ya da tedarikçi mesaj ekleyebilir.' });

    q.messages.push({
      senderId: req.user.id,
      message: req.body.message,
      sentAt: new Date(),
      isRead: false
    });
    q.updatedAt = new Date();
    await q.save();

    res.locals.oldValue = null;
    res.locals.newValue = q;
    res.json({ message: 'Mesaj eklendi.' });
  } catch (err) {
    next(err);
  }
};
