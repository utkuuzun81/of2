import User from '../models/user.js';

// Normalize user documents to ensure valid roles and statuses
export async function normalizeUsers() {
  const users = await User.find({});
  let fixed = 0;
  for (const u of users) {
    let changed = false;
    const validRoles = ['admin','center','supplier','user'];
    if (!u.role || !validRoles.includes(u.role)) {
      u.role = 'user';
      changed = true;
    }
    if (!u.status) {
      u.status = 'pending';
      changed = true;
    }
    if (changed) {
      try {
        await u.save();
        fixed++;
      } catch (e) {
        console.warn('[NORMALIZE] Failed to fix user', u.email, e.message);
      }
    }
  }
  if (fixed) console.log(`[NORMALIZE] Fixed ${fixed} user documents (role/status).`);
}
