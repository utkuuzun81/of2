import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

const UserSchema = new mongoose.Schema({
  id: { type: String, default: uuidv4, unique: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'center', 'supplier', 'user'], default: 'user' },
  status: { type: String, enum: ['pending', 'approved', 'rejected', 'suspended'], default: 'pending' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  lastLoginAt: { type: Date },
  lastLoginDevice: { type: String },
  lastLoginIp: { type: String },
  lastLoginUa: { type: String },
  lastLoginOS: { type: String },
  lastLoginBrowser: { type: String },
  isDeleted: { type: Boolean, default: false }, // SOFT DELETE

  // Personal Info
  personalInfo: {
    firstName: String,
    lastName: String,
  phone: String,
  title: String,
  avatar: String,
  avatarShape: { type: String, enum: ['circular', 'rounded', 'square'], default: 'circular' }
  },
  // Company Info (center/supplier için)
  companyInfo: {
    companyName: String,
    taxNumber: String,
    address: {
      street: String,
      district: String,
      city: String,
      postalCode: String,
      country: String
    },
    website: String,
    foundedYear: Number,
    employeeCount: Number,
    licenseNumber: String,
  licenseDocumentUrl: String,
    certifications: [String]
  },
  // Company Info approval workflow
  companyInfoApprovalStatus: { type: String, enum: ['approved', 'pending', 'rejected'], default: 'approved' },
  companyInfoPending: {
    companyName: String,
    taxNumber: String,
    address: {
      street: String,
      district: String,
      city: String,
      postalCode: String,
      country: String
    },
    website: String,
    foundedYear: Number,
    employeeCount: Number,
    licenseNumber: String,
  licenseDocumentUrl: String,
    certifications: [String]
  },
  companyInfoApprovedAt: { type: Date },
  companyInfoPendingAt: { type: Date },
  // Business Settings
  businessSettings: {
    workingHours: Object,
    paymentMethods: [String],
    deliveryOptions: [String],
    minOrderAmount: Number,
    maxOrderAmount: Number
  },
  // Preferences
  preferences: {
    language: { type: String, default: 'tr' },
    timezone: String,
    currency: String,
    notifications: {
      email: Boolean,
      sms: Boolean,
      push: Boolean
    },
    theme: { type: String, enum: ['light', 'dark'], default: 'light' }
  }
  ,
  // Security (MFA)
  mfa: {
    enabled: { type: Boolean, default: false },
    secret: { type: String }, // TOTP secret (base32)
    tempSecret: { type: String }, // waiting verification
    backupCodes: [{
      codeHash: String,
      used: { type: Boolean, default: false },
      usedAt: Date
    }],
    enabledAt: Date
  }
});

// Guard: Coerce invalid/empty role to 'user' to avoid enum validation errors
const VALID_ROLES = ['admin', 'center', 'supplier', 'user'];
UserSchema.pre('save', function(next) {
  if (!this.role || !VALID_ROLES.includes(this.role)) {
    this.role = 'user';
  }
  next();
});
UserSchema.pre('findOneAndUpdate', function(next) {
  const update = this.getUpdate() || {};
  const $set = update.$set || update;
  if ($set && Object.prototype.hasOwnProperty.call($set, 'role')) {
    const r = $set.role;
    if (!r || !VALID_ROLES.includes(r)) {
      // Remove invalid value; let it fall back to existing value or default
      if (update.$set) delete update.$set.role; else delete update.role;
    }
  }
  next();
});

const User = mongoose.model('User', UserSchema);
export default User;
