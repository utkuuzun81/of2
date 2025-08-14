import Product from '../models/product.js';

// Tüm ürünleri listele (isDeleted: false)
export const listProducts = async (req, res, next) => {
  try {
    const { q, category, brand, sort } = req.query;
    const page = parseInt(req.query.page, 10);
    const limit = parseInt(req.query.limit, 10);
  const filter = { isDeleted: { $ne: true } };
  // Pazar yeri listesi: admin dışındaki roller sadece aktif ürünleri görür
  const role = req.user?.role;
  if (role !== 'admin') filter.status = 'active';
    if (q) filter.name = { $regex: q, $options: 'i' };
    if (category) filter.$or = [ { categoryId: category }, { 'category.name': category } ];
    if (brand) filter.brand = brand;

    const sortMap = {
      newest: { createdAt: -1 },
      name_asc: { name: 1 },
      name_desc: { name: -1 },
      price_asc: { 'pricing.salePrice': 1, 'pricing.basePrice': 1 },
      price_desc: { 'pricing.salePrice': -1, 'pricing.basePrice': -1 },
    };
    const sortSpec = sortMap[sort] || sortMap.newest;

    const baseQuery = Product.find(filter).sort(sortSpec);
    if (!isNaN(page) && !isNaN(limit) && page > 0 && limit > 0) {
      const skip = (page - 1) * limit;
      const [items, total] = await Promise.all([
        baseQuery.clone().skip(skip).limit(limit),
        Product.countDocuments(filter)
      ]);
      const totalPages = Math.max(1, Math.ceil(total / limit));
      return res.json({ items, page, limit, total, totalPages });
    }
    const products = await baseQuery;
    return res.json(products);
  } catch (err) {
    next(err);
  }
};

// Ürün detayı (isDeleted: false)
export const getProduct = async (req, res, next) => {
  try {
  const role = req.user?.role;
  const base = { id: req.params.id, isDeleted: { $ne: true } };
  if (role !== 'admin') base.status = 'active';
  const product = await Product.findOne(base);
    if (!product) return res.status(404).json({ error: 'Ürün bulunamadı.' });
    res.json(product);
  } catch (err) {
    next(err);
  }
};

// Tedarikçiye ait ürünler
export const listSupplierProducts = async (req, res, next) => {
  try {
    const products = await Product.find({
      'supplierInfo.supplierId': req.params.supplierId,
      isDeleted: { $ne: true }
    });
    res.json(products);
  } catch (err) {
    next(err);
  }
};

// Kategori listesi (dummy; kategori modeli varsa güncelle)
export const listCategories = async (req, res, next) => {
  try {
    res.json([
      { id: "cat1", name: "İşitme Cihazları" },
      { id: "cat2", name: "Pil ve Aksesuar" }
    ]);
  } catch (err) {
    next(err);
  }
};

// Marka listesi (distinct)
export const listBrands = async (req, res, next) => {
  try {
  const brands = await Product.distinct('brand', { isDeleted: { $ne: true }, brand: { $exists: true, $ne: null } });
  res.json(brands.filter(Boolean).sort());
  } catch (err) {
    next(err);
  }
};

// Ürün arama (isimde geçenler, isDeleted false)
export const searchProducts = async (req, res, next) => {
  try {
    const { q } = req.query;
  const role = req.user?.role;
  const filter = { name: { $regex: q || '', $options: 'i' }, isDeleted: { $ne: true } };
  if (role !== 'admin') filter.status = 'active';
  const products = await Product.find(filter);
    res.json(products);
  } catch (err) {
    next(err);
  }
};

// Ürün oluştur (auditLogger için atama!)
export const createProduct = async (req, res, next) => {
  try {
    const role = req.user?.role;
    const payload = { ...(req.body || {}) };
    // Non-admin creations must start as pending
    if (role !== 'admin') {
      payload.status = 'pending';
    }
    const product = await Product.create(payload);
    res.locals.createdProductId = product.id;
    res.locals.newProduct = product;
    res.status(201).json(product);
  } catch (err) {
    next(err);
  }
};

// Ürün güncelle (auditLogger için old/new atama!)
export const updateProduct = async (req, res, next) => {
  try {
    const role = req.user?.role;
    const oldProduct = await Product.findOne({ id: req.params.id });
    const updateDoc = { ...(req.body || {}) };
    // Prevent non-admins from altering status
    if (role !== 'admin' && 'status' in updateDoc) {
      delete updateDoc.status;
    }
    const updated = await Product.findOneAndUpdate(
      { id: req.params.id },
      updateDoc,
      { new: true }
    );
    res.locals.oldProduct = oldProduct;
    res.locals.updatedProduct = updated;
    res.json(updated);
  } catch (err) {
    next(err);
  }
};

// Soft delete ürün (auditLogger için old/new)
export const deleteProduct = async (req, res, next) => {
  try {
    const oldProduct = await Product.findOne({ id: req.params.id });
    await Product.findOneAndUpdate(
      { id: req.params.id },
      { isDeleted: true }
    );
    res.locals.oldProduct = oldProduct;
    res.json({ message: 'Ürün soft delete ile silindi.' });
  } catch (err) {
    next(err);
  }
};

// Ürün statü güncelle
export const updateProductStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const oldProduct = await Product.findOne({ id: req.params.id });
    const updated = await Product.findOneAndUpdate(
      { id: req.params.id },
      { status },
      { new: true }
    );
    res.locals.oldProduct = oldProduct;
    res.locals.updatedProduct = updated;
    res.json(updated);
  } catch (err) {
    next(err);
  }
};

// Ürün görseli ekle (sadece audit log için örnek atama, upload mantığı ayrı)
export const uploadProductImage = async (req, res, next) => {
  try {
    const product = await Product.findOne({ id: req.params.id });
    if (!product) return res.status(404).json({ error: "Ürün bulunamadı." });
    product.media = product.media || {};
    product.media.images = product.media.images || [];
    product.media.images.push({
      id: "img-" + Date.now(),
  url: '/' + String(req.file.path).replace(/\\\\/g, '/').replace(/^\/+/, ''),
      alt: req.body.alt || "",
      isPrimary: req.body.isPrimary === "true"
    });
    await product.save();
    res.json({ message: "Görsel eklendi.", images: product.media.images });
  } catch (err) {
    next(err);
  }
};

// Ürün görseli sil (sadece audit log için örnek atama)
export const deleteProductImage = async (req, res, next) => {
  try {
    const product = await Product.findOne({ id: req.params.id });
    if (!product) return res.status(404).json({ error: "Ürün bulunamadı." });
    product.media.images = (product.media.images || []).filter(img => img.id !== req.params.imageId);
    await product.save();
    res.json({ message: "Görsel silindi." });
  } catch (err) {
    next(err);
  }
};

// Bir görseli kapak (isPrimary) yap ve diğerlerini kaldır
export const setPrimaryImage = async (req, res, next) => {
  try {
    const product = await Product.findOne({ id: req.params.id });
    if (!product) return res.status(404).json({ error: 'Ürün bulunamadı.' });
    const images = product.media?.images || [];
    const found = images.find(img => img.id === req.params.imageId);
    if (!found) return res.status(404).json({ error: 'Görsel bulunamadı.' });
    product.media.images = images.map(img => ({ ...img.toObject?.() || img, isPrimary: img.id === req.params.imageId }));
    await product.save();
    res.json({ message: 'Kapak güncellendi.', images: product.media.images });
  } catch (err) {
    next(err);
  }
};

export default Product;
