import Settings from '../models/Settings.js';
import mongoose from 'mongoose';

// Admin: sistem ayarlarını getir
export const getSystemSettings = async (req, res) => {
  try {
    const setting = await Settings.findOne({ category: 'system' });
    res.status(200).json({ systemSettings: setting?.systemSettings || {} });
  } catch (e) {
    res.status(500).json({ message: 'Sistem ayarları getirilemedi', error: e?.message });
  }
};

// Admin: sistem ayarlarını güncelle
export const updateSystemSettings = async (req, res) => {
  try {
    // Merge incoming with existing to avoid wiping other keys
    const current = await Settings.findOne({ category: 'system' });
    // Normalize payload (coerce numbers, ensure array shape)
    const incoming = { ...(req.body || {}) };
    if (incoming.points) {
      const pts = incoming.points;
      const earnRate = Number(pts.earnRate);
      const levels = Array.isArray(pts.levels) ? pts.levels : [];
      incoming.points = {
        earnRate: Number.isFinite(earnRate) && earnRate >= 0 ? earnRate : 1,
        levels: levels
          .map(l => ({
            name: (l?.name ?? '').toString().trim(),
            min: Number(l?.min),
            bonus: Number(l?.bonus)
          }))
          .filter(l => l.name && Number.isFinite(l.min) && Number.isFinite(l.bonus))
      };
    }
  if (Object.prototype.hasOwnProperty.call(incoming, 'commissionRate')) incoming.commissionRate = Number(incoming.commissionRate);
  if (Object.prototype.hasOwnProperty.call(incoming, 'quickSellDiscount')) incoming.quickSellDiscount = Number(incoming.quickSellDiscount);
  if (Object.prototype.hasOwnProperty.call(incoming, 'quickSellMinDiscount')) incoming.quickSellMinDiscount = Number(incoming.quickSellMinDiscount);
  if (Object.prototype.hasOwnProperty.call(incoming, 'quickSellMaxDiscount')) incoming.quickSellMaxDiscount = Number(incoming.quickSellMaxDiscount);
  if (Object.prototype.hasOwnProperty.call(incoming, 'quickSellEnabled')) incoming.quickSellEnabled = Boolean(incoming.quickSellEnabled);
    const merged = { ...(current?.systemSettings || {}), ...incoming };
  // updatedBy: avoid CastError if token contains a non-ObjectId id
  const updatedBy = mongoose.Types.ObjectId.isValid(req.user?.id) ? req.user.id : undefined;
    const updated = await Settings.findOneAndUpdate(
      { category: 'system' },
      {
    $set: { systemSettings: merged, updatedAt: new Date(), ...(updatedBy ? { updatedBy } : {}) },
        $setOnInsert: { category: 'system' }
      },
      { upsert: true, new: true, runValidators: true }
    );
  res.status(200).json({ systemSettings: updated.systemSettings || {} });
  } catch (e) {
  // Provide a bit more context for troubleshooting in development logs
  try { console.error('updateSystemSettings error:', e?.message, e?.errors || ''); } catch {}
  res.status(500).json({ message: 'Sistem ayarları kaydedilemedi', error: e?.message });
  }
};

// Kullanıcı ayarlarını getir
export const getUserSettings = async (req, res) => {
  try {
    const setting = await Settings.findOne({ category: 'user', userId: req.user.id });
    res.status(200).json(setting || {});
  } catch (e) {
    res.status(500).json({ message: 'Kullanıcı ayarları alınamadı', error: e?.message });
  }
};

// Kullanıcı ayarlarını güncelle
export const updateUserSettings = async (req, res) => {
  try {
  const updatedBy = mongoose.Types.ObjectId.isValid(req.user?.id) ? req.user.id : undefined;
    const updated = await Settings.findOneAndUpdate(
      { category: 'user', userId: req.user.id },
      {
    $set: { userSettings: req.body, updatedAt: new Date(), ...(updatedBy ? { updatedBy } : {}) },
        $setOnInsert: { category: 'user', userId: req.user.id }
      },
      { upsert: true, new: true, runValidators: true }
    );
  res.status(200).json(updated);
  } catch (e) {
    res.status(500).json({ message: 'Kullanıcı ayarları kaydedilemedi', error: e?.message });
  }
};

// Public: minimal system info for client gating
export const getSystemPublic = async (req, res) => {
  const setting = await Settings.findOne({ category: 'system' });
  const sys = setting?.systemSettings || {};
  res.status(200).json({
    maintenanceMode: Boolean(sys.maintenanceMode),
  pendingApprovalRedirectMs: typeof sys.pendingApprovalRedirectMs === 'number' ? sys.pendingApprovalRedirectMs : undefined,
  commissionRate: typeof sys.commissionRate === 'number' ? sys.commissionRate : 0.05,
  quickSellDiscount: typeof sys.quickSellDiscount === 'number' ? sys.quickSellDiscount : 10,
  quickSellMinDiscount: typeof sys.quickSellMinDiscount === 'number' ? sys.quickSellMinDiscount : 0,
  quickSellMaxDiscount: typeof sys.quickSellMaxDiscount === 'number' ? sys.quickSellMaxDiscount : 50,
  quickSellEnabled: Boolean(sys.quickSellEnabled ?? true)
  });
};
