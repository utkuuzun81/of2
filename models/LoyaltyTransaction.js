import mongoose from 'mongoose';

const LoyaltyTxSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true, required: true },
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', index: true },
  type: { type: String, enum: ['earn', 'spend', 'adjust'], required: true },
  amount: { type: Number, required: true }, // positive for earn/adjust+, negative for spend/adjust-
  reason: { type: String },
  meta: { type: Object }, // snapshot details like earnRate, bonus
  createdAt: { type: Date, default: Date.now }
});

LoyaltyTxSchema.index({ userId: 1, createdAt: -1 });
LoyaltyTxSchema.index({ orderId: 1 }, { unique: true, partialFilterExpression: { orderId: { $type: 'objectId' } } });

export default mongoose.models.LoyaltyTransaction || mongoose.model('LoyaltyTransaction', LoyaltyTxSchema);
