import User from '../models/user.js';
import Product from '../models/product.js';
import Quotation from '../models/quotation.js';
import FranchiseApplication from '../models/franchiseapplication.js';
import Order from '../models/order.js';
import SupplierApplication from '../models/supplierapplication.js';
import Joi from 'joi';

// Kullanıcı rol ve statü güncelle
export const updateUserRoleStatus = async (req, res) => {
  // Validate input to avoid accidentally blanking role/status
  const schema = Joi.object({
    role: Joi.string().valid('admin','center','supplier','user').optional(),
    status: Joi.string().valid('pending','approved','rejected','suspended').optional()
  }).min(1);
  const { error, value } = schema.validate(req.body || {});
  if (error) return res.status(400).json({ message: error.details[0].message });

  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ message: 'Kullanıcı bulunamadı' });

  const oldUser = { ...user.toObject() };

  if (Object.prototype.hasOwnProperty.call(value, 'role')) user.role = value.role; // only if provided (non-empty, valid)
  if (Object.prototype.hasOwnProperty.call(value, 'status')) user.status = value.status;
  user.updatedAt = new Date();
  await user.save();

  res.locals.oldValue = oldUser;
  res.locals.newValue = user;
  res.status(200).json({ message: 'Güncellendi' });
};

// Toplu kullanıcı silme (soft delete)
export const bulkDeleteUsers = async (req, res) => {
  const ids = req.body.ids;
  const results = await User.updateMany(
    { _id: { $in: ids } },
    { isDeleted: true, updatedAt: new Date() }
  );

  res.locals.oldValue = { count: ids.length };
  res.locals.newValue = { softDeleted: results.modifiedCount };
  res.status(200).json({ message: `${results.modifiedCount} kullanıcı silindi.` });
};

// Toplu ürün pasifleştirme
export const bulkDisableProducts = async (req, res) => {
  const ids = req.body.ids;
  const results = await Product.updateMany(
    { _id: { $in: ids } },
    { status: 'inactive', updatedAt: new Date() }
  );

  res.locals.oldValue = { ids };
  res.locals.newValue = { updated: results.modifiedCount };
  res.status(200).json({ message: `${results.modifiedCount} ürün pasifleştirildi.` });
};

// Teklifleri onaylanmış olarak işaretle
export const markQuotationsAccepted = async (req, res) => {
  const ids = req.body.ids;
  const results = await Quotation.updateMany(
    { _id: { $in: ids } },
    { status: 'accepted', updatedAt: new Date() }
  );

  res.locals.oldValue = { ids };
  res.locals.newValue = { updated: results.modifiedCount };
  res.status(200).json({ message: `${results.modifiedCount} teklif kabul edildi.` });
};

// Admin: Kullanıcının kurumsal bilgilerini onayla/ret et
export const approveCompanyInfo = async (req, res) => {
  const schema = Joi.object({ action: Joi.string().valid('approve','reject').required() });
  const { error } = schema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ message: 'Kullanıcı bulunamadı' });
  const oldUser = { ...user.toObject() };
  if (req.body.action === 'approve') {
    if (user.companyInfoPending) {
      user.companyInfo = user.companyInfoPending;
      user.companyInfoPending = undefined;
    }
    user.companyInfoApprovalStatus = 'approved';
    user.companyInfoApprovedAt = new Date();
  // Genel kullanıcı statüsünü de onaylı yap
  user.status = 'approved';
  } else {
    user.companyInfoApprovalStatus = 'rejected';
  user.status = 'pending';
  }
  user.updatedAt = new Date();
  await user.save();
  res.locals.oldValue = oldUser;
  res.locals.newValue = user;
  res.status(200).json({ message: 'Kurumsal bilgiler güncellendi', status: user.companyInfoApprovalStatus });
};

// Onay Merkezi: Bekleyen öğeleri topla
export const listApprovalQueue = async (req, res) => {
  // Toplayacağımız kalemler: Kullanıcı kurumsal bilgi onayı, bekleyen ürünler, bekleyen siparişler, tedarikçi başvuruları
  const [userCompany, products, orders, supplierApps] = await Promise.all([
    User.find({ isDeleted: { $ne: true }, companyInfoPending: { $exists: true, $ne: null } })
      .select('email role companyInfoPending companyInfo companyInfoApprovalStatus createdAt')
      .lean(),
    Product.find({ isDeleted: { $ne: true }, status: 'pending' })
      .select('id name brand status createdAt supplierInfo')
      .lean(),
    Order.find({
      isDeleted: { $ne: true },
      $or: [
        { status: { $in: ['pending', 'bekliyor', 'bekleyen'] } },
        { paymentStatus: 'pending' }
      ]
    })
      .select('_id orderNumber status createdAt userId')
      .lean(),
    SupplierApplication.find({ isDeleted: { $ne: true }, status: { $in: ['pending', 'under_review'] } })
      .select('_id applicationNumber status createdAt companyDetails')
      .lean()
  ]);

  const queue = [];
  for (const u of userCompany) {
    const isNewMembership = !u.companyInfo || (typeof u.companyInfo === 'object' && Object.keys(u.companyInfo || {}).length === 0);
    queue.push({
      type: 'user_company',
      id: String(u._id),
      title: u.companyInfoPending?.companyName || u.email,
      subtitle: isNewMembership ? 'Yeni üyelik başvurusu' : 'Kurumsal bilgi güncelleme',
      requestedBy: u.email,
      status: u.companyInfoApprovalStatus || 'pending',
      createdAt: u.createdAt,
      meta: {
        previous: u.companyInfo || null,
        pending: u.companyInfoPending || null
      }
    });
  }
  for (const p of products) {
    queue.push({
      type: 'product',
      id: p.id,
      title: p.name,
      subtitle: p.brand || 'Ürün onayı',
      requestedBy: p.supplierInfo?.supplierId || null,
      status: p.status,
      createdAt: p.createdAt,
      meta: { brand: p.brand || null }
    });
  }
  for (const o of orders) {
    queue.push({
      type: 'order',
      id: String(o._id),
      title: o.orderNumber || String(o._id),
      subtitle: 'Sipariş onayı',
      requestedBy: o.userId || null,
      status: o.status,
      createdAt: o.createdAt,
      meta: {}
    });
  }
  for (const s of supplierApps) {
    queue.push({
      type: 'supplier_application',
      id: String(s._id),
      title: s.companyDetails?.companyInfo?.companyName || s.applicationNumber,
      subtitle: 'Tedarikçi başvurusu',
      requestedBy: null,
      status: s.status,
      createdAt: s.createdAt,
      meta: { applicationNumber: s.applicationNumber }
    });
  }
  // Kısa debug çıktısı (gerekirse kaldırılabilir)
  try { console.debug('[ApprovalQueue] counts', { userCompany: userCompany.length, products: products.length, orders: orders.length, supplierApps: supplierApps.length }); } catch {}
  // Tarihe göre yeni -> eski
  queue.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return res.json({ items: queue, total: queue.length });
};

// Onay Merkezi: Tekil işlem (approve/reject)
export const handleApprovalAction = async (req, res) => {
  const schema = Joi.object({ action: Joi.string().valid('approve','reject').required(), note: Joi.string().allow('', null) });
  const { error } = schema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });
  const { type, id } = req.params;
  const action = req.body.action;

  switch (type) {
    case 'user_company': {
      // Aynı approveCompanyInfo mantığı
      const user = await User.findById(id);
      if (!user) return res.status(404).json({ message: 'Kullanıcı bulunamadı' });
      const oldUser = { ...user.toObject() };
      if (action === 'approve') {
        if (user.companyInfoPending) {
          user.companyInfo = user.companyInfoPending;
          user.companyInfoPending = undefined;
        }
        user.companyInfoApprovalStatus = 'approved';
        user.companyInfoApprovedAt = new Date();
        user.status = 'approved';
      } else {
        user.companyInfoApprovalStatus = 'rejected';
        user.status = 'pending';
      }
      user.updatedAt = new Date();
      await user.save();
      res.locals.oldValue = oldUser;
      res.locals.newValue = user;
      return res.json({ message: 'Kullanıcı kurumsal bilgi işlemi tamamlandı', status: user.companyInfoApprovalStatus });
    }
    case 'product': {
      // Ürünlerde reject => inactive; approve => active
      const product = await Product.findOne({ id }) || await Product.findById(id);
      if (!product) return res.status(404).json({ message: 'Ürün bulunamadı' });
      const oldProduct = { ...product.toObject() };
      product.status = action === 'approve' ? 'active' : 'inactive';
      product.updatedAt = new Date();
      await product.save();
      res.locals.oldValue = oldProduct;
      res.locals.newValue = product;
      return res.json({ message: 'Ürün durumu güncellendi', status: product.status });
    }
    case 'order': {
      const order = await Order.findById(id);
      if (!order) return res.status(404).json({ message: 'Sipariş bulunamadı' });
      const oldOrder = { ...order.toObject() };
      order.status = action === 'approve' ? 'confirmed' : 'cancelled';
      if (action !== 'approve') order.isDeleted = true;
      order.updatedAt = new Date();
      await order.save();
      res.locals.oldValue = oldOrder;
      res.locals.newValue = order;
      return res.json({ message: 'Sipariş işlemi tamamlandı', status: order.status });
    }
    case 'supplier_application': {
      const app = await SupplierApplication.findById(id);
      if (!app) return res.status(404).json({ message: 'Başvuru bulunamadı' });
      const oldApp = { ...app.toObject() };
      app.status = action === 'approve' ? 'approved' : 'rejected';
      app.updatedAt = new Date();
      await app.save();
      res.locals.oldValue = oldApp;
      res.locals.newValue = app;
      return res.json({ message: 'Tedarikçi başvurusu güncellendi', status: app.status });
    }
    default:
      return res.status(400).json({ message: 'Geçersiz onay türü' });
  }
};
