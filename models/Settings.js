import mongoose from 'mongoose';

const SettingsSchema = new mongoose.Schema({
  category: { type: String, enum: ['system', 'user', 'business'], required: true },
  // Store userId as string (matches our User.id UUID/string) to avoid ObjectId cast errors
  userId: { type: String, index: true },
  systemSettings: {
    maintenanceMode: Boolean,
    allowRegistrations: Boolean,
    requireEmailVerification: Boolean,
    sessionTimeout: Number,
    maxLoginAttempts: Number,
    pendingApprovalRedirectMs: { type: Number, default: 60000 },
    // Platform commission settings
    commissionRate: { type: Number, default: 0.05 }, // 0.05 => %5
    // Quick Sell pricing: percentage discount applied to entered estimated unit price
    quickSellDiscount: { type: Number, default: 10 }, // %10
    quickSellMinDiscount: { type: Number, default: 0 },
    quickSellMaxDiscount: { type: Number, default: 50 },
    quickSellEnabled: { type: Boolean, default: true },
    // Loyalty / Points settings
    points: {
      earnRate: { type: Number, default: 1 }, // 1 TL = earnRate points
      levels: [
        new mongoose.Schema({
          name: { type: String, required: true },
          min: { type: Number, required: true },
          bonus: { type: Number, required: true }
        }, { _id: false })
      ]
    }
  },
  updatedAt: { type: Date, default: Date.now },
  // Keep as string as well, since req.user.id is a string UUID
  updatedBy: { type: String }
});

export default mongoose.models.Settings || mongoose.model('Settings', SettingsSchema);
