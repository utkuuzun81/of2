import Session from '../models/session.js';

export const listSessions = async (req, res) => {
  const items = await Session.find({ userId: req.user.id, revokedAt: { $exists: false } }).sort({ lastSeenAt: -1 }).lean();
  res.json(items);
};

export const revokeSession = async (req, res) => {
  const { id } = req.params;
  const sess = await Session.findOne({ id, userId: req.user.id });
  if (!sess) return res.status(404).json({ message: 'Session not found' });
  sess.revokedAt = new Date();
  sess.revokedBy = req.user.id;
  await sess.save();
  res.json({ revoked: true });
};

export const revokeAll = async (req, res) => {
  await Session.updateMany({ userId: req.user.id, revokedAt: { $exists: false } }, { $set: { revokedAt: new Date(), revokedBy: req.user.id } });
  res.json({ revokedAll: true });
};
