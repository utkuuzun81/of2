import Defect from '../models/defect.js';

export const listDefects = async (req, res, next) => {
  try {
    const { q, status, priority, productId, orderId } = req.query;
    const page = parseInt(req.query.page, 10);
    const limit = parseInt(req.query.limit, 10);

    const filter = { isDeleted: { $ne: true } };
    if (q) filter.$or = [
      { productName: { $regex: q, $options: 'i' } },
      { orderNumber: { $regex: q, $options: 'i' } },
      { sku: { $regex: q, $options: 'i' } },
      { reason: { $regex: q, $options: 'i' } },
      { description: { $regex: q, $options: 'i' } }
    ];
    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (productId) filter.productId = productId;
    if (orderId) filter.orderId = orderId;

    const sort = { createdAt: -1 };

    const baseQuery = Defect.find(filter).sort(sort);
    if (!isNaN(page) && !isNaN(limit) && page > 0 && limit > 0) {
      const skip = (page - 1) * limit;
      const [items, total] = await Promise.all([
        baseQuery.clone().skip(skip).limit(limit),
        Defect.countDocuments(filter)
      ]);
      const totalPages = Math.max(1, Math.ceil(total / limit));
      return res.json({ items, page, limit, total, totalPages });
    }
    const items = await baseQuery;
    return res.json(items);
  } catch (err) { next(err); }
};

export const getDefect = async (req, res, next) => {
  try {
    const item = await Defect.findOne({ id: req.params.id, isDeleted: { $ne: true } });
    if (!item) return res.status(404).json({ error: 'Kayıt bulunamadı.' });
    res.json(item);
  } catch (err) { next(err); }
};

export const createDefect = async (req, res, next) => {
  try {
    const payload = { ...(req.body || {}), createdBy: req.user?.id };
  const created = await Defect.create(payload);
  res.locals.createdDefectId = created.id;
  res.locals.newDefect = created;
  res.status(201).json(created);
  } catch (err) { next(err); }
};

export const updateDefect = async (req, res, next) => {
  try {
  const oldValue = await Defect.findOne({ id: req.params.id });
    const updateDoc = { ...(req.body || {}), updatedBy: req.user?.id };
  const updated = await Defect.findOneAndUpdate({ id: req.params.id }, updateDoc, { new: true });
  res.locals.oldDefect = oldValue;
  res.locals.updatedDefect = updated;
  res.json(updated);
  } catch (err) { next(err); }
};

export const updateDefectStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
  const oldValue = await Defect.findOne({ id: req.params.id });
  const updated = await Defect.findOneAndUpdate({ id: req.params.id }, { status, updatedBy: req.user?.id }, { new: true });
  res.locals.oldDefect = oldValue;
  res.locals.updatedDefect = updated;
  res.json(updated);
  } catch (err) { next(err); }
};

export const softDeleteDefect = async (req, res, next) => {
  try {
    await Defect.findOneAndUpdate({ id: req.params.id }, { isDeleted: true });
    res.json({ message: 'Kayıt silindi (soft delete).' });
  } catch (err) { next(err); }
};
