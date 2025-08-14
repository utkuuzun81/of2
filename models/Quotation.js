import mongoose from 'mongoose';

const QuotationSchema = new mongoose.Schema({
  quoteNumber: { type: String, required: true, unique: true },
  requesterId: { type: String, required: true, index: true },
  supplierId: { type: String, required: false, index: true },
  requestType: { type: String, enum: ['quick-sell', 'sell', 'buy'], default: 'buy', index: true },
  status: { type: String, enum: ['pending', 'quoted', 'negotiating', 'accepted', 'rejected', 'expired'], default: 'pending' },
  priority: { type: String, enum: ['low', 'medium', 'high', 'urgent'], default: 'medium' },
  requestInfo: {
    title: String,
    description: String,
    quantity: Number,
    budgetRange: { min: Number, max: Number, currency: String },
    deliveryDate: Date,
    deliveryAddress: { street: String, district: String, city: String, postalCode: String, country: String }
  },
  sellInfo: {
    desiredUnitPrice: Number,
    commissionRate: { type: Number, default: 0 },
    commissionAmount: Number,
    netProceeds: Number,
    commissionPassThrough: { type: String, enum: ['absorb','pass'], default: 'absorb' },
    customerTotal: Number,
    customerUnitPrice: Number
  },
  buyInfo: { paymentOption: { type: String, enum: ['cash', 'installment'], default: 'cash' } },
  requestedItems: [{ productId: { type: String }, productName: String, quantity: Number, specifications: String, estimatedUnitPrice: Number }],
  supplierResponse: {
    respondedAt: Date,
    validUntil: Date,
    quotedItems: [{ productId: { type: String }, quantity: Number, unitPrice: Number, totalPrice: Number, deliveryTime: Number, warranty: Number, notes: String }],
    totalAmount: Number,
    currency: String,
    paymentTerms: String,
    deliveryTerms: String,
    notes: String,
    attachments: [{ name: String, url: String, size: Number }]
  },
  messages: [{ senderId: String, message: String, sentAt: Date, isRead: Boolean }],
  expiresAt: { type: Date },
  isDeleted: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date }
});

export default mongoose.model('Quotation', QuotationSchema);
