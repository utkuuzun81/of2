import speakeasy from 'speakeasy';
import qrcode from 'qrcode';
import crypto from 'crypto';
import User from '../models/user.js';

const hash = (plain) => crypto.createHash('sha256').update(String(plain)).digest('hex');

export const startEnroll = async (req, res) => {
  const user = await User.findOne({ id: req.user.id, isDeleted: false });
  if (!user) return res.status(404).json({ message: 'User not found' });
  const secret = speakeasy.generateSecret({ length: 20, name: `Odyostore (${user.email})` });
  user.mfa = user.mfa || {};
  user.mfa.tempSecret = secret.base32;
  await user.save();
  const otpauth = secret.otpauth_url;
  const qrDataUrl = await qrcode.toDataURL(otpauth);
  res.json({ otpauth, qrDataUrl });
};

export const verifyEnroll = async (req, res) => {
  const { token } = req.body;
  const user = await User.findOne({ id: req.user.id, isDeleted: false });
  if (!user?.mfa?.tempSecret) return res.status(400).json({ message: 'Enrollment not initialized' });
  const verified = speakeasy.totp.verify({
    secret: user.mfa.tempSecret,
    encoding: 'base32',
    token,
    window: 1
  });
  if (!verified) return res.status(400).json({ message: 'Invalid token' });
  user.mfa.secret = user.mfa.tempSecret;
  user.mfa.tempSecret = undefined;
  user.mfa.enabled = true;
  user.mfa.enabledAt = new Date();
  // generate 10 backup codes
  const backups = Array.from({ length: 10 }, () => Math.random().toString(36).slice(2, 10));
  user.mfa.backupCodes = backups.map(code => ({ codeHash: hash(code), used: false }));
  await user.save();
  res.json({ enabled: true, backupCodes: backups });
};

export const disableMfa = async (req, res) => {
  const user = await User.findOne({ id: req.user.id, isDeleted: false });
  if (!user?.mfa?.enabled) return res.status(400).json({ message: 'MFA not enabled' });
  user.mfa = { enabled: false };
  await user.save();
  res.json({ disabled: true });
};

export const regenerateBackupCodes = async (req, res) => {
  const user = await User.findOne({ id: req.user.id, isDeleted: false });
  if (!user?.mfa?.enabled) return res.status(400).json({ message: 'MFA not enabled' });
  const backups = Array.from({ length: 10 }, () => Math.random().toString(36).slice(2, 10));
  user.mfa.backupCodes = backups.map(code => ({ codeHash: hash(code), used: false }));
  await user.save();
  res.json({ backupCodes: backups });
};

export const status = async (req, res) => {
  const user = await User.findOne({ id: req.user.id, isDeleted: false }).select('mfa');
  res.json(user?.mfa || { enabled: false });
};
