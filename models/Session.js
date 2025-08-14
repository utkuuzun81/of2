import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

const SessionSchema = new mongoose.Schema({
  id: { type: String, default: uuidv4, unique: true },
  userId: { type: String, index: true, required: true },
  tokenId: { type: String, index: true },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date },
  userAgent: String,
  ip: String,
  lastSeenAt: { type: Date, default: Date.now },
  revokedAt: Date,
  revokedBy: String
});

const Session = mongoose.model('Session', SessionSchema);
export default Session;
