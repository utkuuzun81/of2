import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

const DefectSchema = new mongoose.Schema({
  id: { type: String, default: uuidv4, unique: true },
  productId: { type: String, index: true },
  orderId: { type: String, default: null },
  sku: String,
  productName: String,
  orderNumber: String,

  reason: { type: String, default: '' },
  description: { type: String, default: '' },
  status: {
    type: String,
    enum: [
      'reported',        // Bildirildi
      'inspecting',      // İncelemede
      'approved',        // Onaylandı (iade/değişim)
      'repaired',        // Onarıldı
      'scrapped',        // İmha edildi
      'returned_supplier', // Tedarikçiye iade
      'refunded',        // Ücret iadesi yapıldı
      'closed'           // Kapandı
    ],
    default: 'reported'
  },
  priority: { type: String, enum: ['low', 'normal', 'high', 'urgent'], default: 'normal' },
  warehouseLocation: String,
  assignedTo: { type: String, default: null }, // userId

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
    documents: [
      { id: String, name: String, url: String, type: String, size: Number }
    ]
  },

  resolution: {
    action: String, // refund / replace / repair / scrap / return_supplier
    notes: String,
    date: Date
  },

  createdBy: { type: String, index: true },
  updatedBy: { type: String, default: null },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  isDeleted: { type: Boolean, default: false }
});

DefectSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.models.Defect || mongoose.model('Defect', DefectSchema);
