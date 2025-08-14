import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

const OrderSchema = new mongoose.Schema({
  id: { type: String, default: uuidv4, unique: true },
  orderNumber: String,
  userId: String,
  supplierId: { type: String, default: null },
  status: {
    type: String,
    enum: [
      'pending',
      'confirmed',
      'processing',
      'shipped',
      'delivered',
      'cancelled',
      'refunded'
    ],
    default: 'pending'
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'refunded'],
    default: 'pending'
  },
  shippingStatus: {
    type: String,
    enum: ['pending', 'preparing', 'shipped', 'in_transit', 'delivered'],
    default: 'pending'
  },
  customerInfo: Object,
  billingAddress: Object,
  shippingAddress: Object,
  items: [Object],
  pricing: Object,
  paymentInfo: Object,
  shippingInfo: Object,
  notes: Object,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  shippedAt: Date,
  deliveredAt: Date,
  cancelledAt: Date,
  isDeleted: { type: Boolean, default: false }
});

// Burada model tanımını doğrudan dışa aktar!
const Order = mongoose.model('Order', OrderSchema);
export default Order;
