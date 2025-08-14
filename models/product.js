import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

const ProductSchema = new mongoose.Schema({
  id: { type: String, default: uuidv4, unique: true },
  sku: String,
  name: { type: String, required: true },
  slug: String,
  description: String,
  shortDescription: String,

  // Kategoriler
  categoryId: String,
  subcategoryId: String,
  brand: String,
  model: String,

  // Fiyatlandırma
  pricing: {
    basePrice: Number,
    salePrice: Number,
    costPrice: Number,
    currency: String,
    taxRate: Number,
    profitMargin: Number,
    dealerPricing: {
      tier1: Number,
      tier2: Number,
      tier3: Number
    }
  },

  // Stok
  inventory: {
    stockQuantity: Number,
    reservedQuantity: Number,
    minStockLevel: Number,
    maxStockLevel: Number,
    reorderPoint: Number,
    lastRestockedAt: Date
  },

  // Tedarikçi
  supplierInfo: {
    supplierId: String,
    supplierSku: String,
    supplierPrice: Number,
    leadTime: Number,
    minOrderQuantity: Number,
    maxOrderQuantity: Number
  },

  // Özellikler
  specifications: {
    technical: Object,
    features: [String],
    compatibility: [String],
    warranty: Object
  },

  // Medya
  media: {
    images: [
      {
        id: String,
        url: String,
        alt: String,
        isPrimary: Boolean,
        sortOrder: Number
      }
    ],
    videos: [
      {
        id: String,
        url: String,
        title: String,
        duration: Number
      }
    ],
    documents: [
      {
        id: String,
        name: String,
        url: String,
        type: String,
        size: Number
      }
    ]
  },

  // SEO
  seo: {
    title: String,
    description: String,
    keywords: [String]
  },

  status: { type: String, enum: ['active', 'inactive', 'pending', 'discontinued'], default: 'pending' },
  isActive: { type: Boolean, default: true },
  isFeatured: { type: Boolean, default: false },
  publishedAt: Date,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },

  isDeleted: { type: Boolean, default: false } // SOFT DELETE!
});

export default mongoose.models.Product || mongoose.model('Product', ProductSchema);
