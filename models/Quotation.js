import mongoose from 'mongoose';

const QuotationSchema = new mongoose.Schema({
  quoteNumber: { type: String, required: true, unique: true },
  // We store user IDs as string (matches User.id UUID/string)
  requesterId: { type: String, required: true, index: true },
  // Supplier can be empty for system-generated quotes (e.g., Quick Sell)
  supplierId: { type: String, required: false, index: true },
  // New: request type to support different business flows on UI
  requestType: {
    type: String,
    enum: ['quick-sell', 'sell', 'buy'],
    default: 'buy',
    index: true
  },
  status: {
    type: String,
    enum: ['pending', 'quoted', 'negotiating', 'accepted', 'rejected', 'expired'],
    default: 'pending'
  },
  priority: { type: String, enum: ['low', 'medium', 'high', 'urgent'], default: 'medium' },
  requestInfo: {
    title: String,
    description: String,
    quantity: Number,
    budgetRange: {
      min: Number,
      max: Number,
      currency: String
    },
    deliveryDate: Date,
    deliveryAddress: {
      street: String,
      district: String,
      city: String,
      postalCode: String,
      country: String
    }
  },
  // Flow-specific fields
  sellInfo: {
    desiredUnitPrice: Number, // Kullanıcının satmak istediği birim fiyat
    commissionRate: { type: Number, default: 0 }, // 0.05 => %5
    commissionAmount: Number,
  netProceeds: Number,
  commissionPassThrough: { type: String, enum: ['absorb','pass'], default: 'absorb' },
  // Calculated customer-facing totals (if pass-through, includes commission)
  customerTotal: Number,
  customerUnitPrice: Number
  },
  buyInfo: {
    paymentOption: { type: String, enum: ['cash', 'installment'], default: 'cash' }
  },
  requestedItems: [
    {
      productId: { type: String },
      productName: String,
      quantity: Number,
      specifications: String,
      estimatedUnitPrice: Number
    }
  ],
  supplierResponse: {
    respondedAt: Date,
    validUntil: Date,
    quotedItems: [
      {
        productId: { type: String },
        quantity: Number,
        unitPrice: Number,
        totalPrice: Number,
        deliveryTime: Number,
        warranty: Number,
        notes: String
      }
    ],
    totalAmount: Number,
    currency: String,
    paymentTerms: String,
    deliveryTerms: String,
    notes: String,
    attachments: [
      {
        name: String,
        url: String,
        size: Number
      }
    ]
  },
  messages: [
    {
  // Align with our user.id type (string UUID) to avoid ObjectId cast errors
  senderId: String,
      message: String,
      sentAt: Date,
      isRead: Boolean
    }
  ],
  expiresAt: { type: Date },
  isDeleted: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date }
});

export default mongoose.model('Quotation', QuotationSchema);
