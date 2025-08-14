import mongoose from 'mongoose';

const AuditLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  action: { type: String, required: true },
  resource: { type: String, required: true },
  resourceId: { type: String, required: true },
  ip: { type: String },
  userAgent: { type: String },
  oldValue: { type: Object },
  newValue: { type: Object },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('AuditLog', AuditLogSchema);
