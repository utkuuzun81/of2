import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

const NotificationSchema = new mongoose.Schema({
  id: { type: String, default: uuidv4, unique: true },
  // Store as string to align with User.id (UUID) and req.user.id usage
  userId: { type: String, index: true },
  type: { 
    type: String, 
    enum: ['order_status', 'quote_response', 'application_update', 'system_alert'],
    default: 'system_alert'
  },
  priority: { type: String, enum: ['low', 'medium', 'high', 'urgent'], default: 'medium' },
  title: String,
  message: String,
  metadata: Object,
  channels: {
    push: Boolean,
    email: Boolean,
    sms: Boolean
  },
  isRead: { type: Boolean, default: false },
  readAt: Date,
  deliveryStatus: {
    push: String,
    email: String,
    sms: String
  },
  createdAt: { type: Date, default: Date.now },
  expiresAt: Date
});

export default mongoose.model('Notification', NotificationSchema);
