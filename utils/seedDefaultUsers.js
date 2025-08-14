import bcrypt from 'bcryptjs';
import User from '../models/user.js';

/**
 * Her server start'ında default admin ve diğer kritik kullanıcıları garantiler.
 * Şifreler env'den geçilebilir; yoksa default kullanılır.
 */
export async function seedDefaultUsers() {
  const defaults = [
    {
      email: process.env.DEFAULT_ADMIN_EMAIL || 'admin@odyostore.com',
      passwordPlain: process.env.DEFAULT_ADMIN_PASSWORD || 'Admin1234-',
      role: 'admin',
      status: 'approved',
      personalInfo: { firstName: 'Admin', lastName: 'User' }
    },
    {
      email: process.env.DEFAULT_CENTER_EMAIL || 'center@odyostore.com',
      passwordPlain: process.env.DEFAULT_CENTER_PASSWORD || 'Center1234-',
      role: 'center',
      status: 'approved',
      personalInfo: { firstName: 'Center', lastName: 'User' },
      companyInfo: { companyName: 'Odyostore Center' }
    },
    {
      email: process.env.DEFAULT_SUPPLIER_EMAIL || 'supplier@odyostore.com',
      passwordPlain: process.env.DEFAULT_SUPPLIER_PASSWORD || 'Supplier1234-',
      role: 'supplier',
      status: 'approved',
      personalInfo: { firstName: 'Supplier', lastName: 'User' },
      companyInfo: { companyName: 'Odyostore Supplier' }
    }
  ];

  for (const u of defaults) {
    // Trim password to avoid trailing space issues
    const cleanedPassword = (u.passwordPlain || '').replace(/\r?\n/g, '').trim();
    if (process.env.DEBUG_AUTH === 'true' && cleanedPassword !== u.passwordPlain) {
      console.log('[SEED][DEBUG] Password trimmed for', u.email, 'origLen=', u.passwordPlain.length, 'newLen=', cleanedPassword.length);
    }
    u.passwordPlain = cleanedPassword;
    const existing = await User.findOne({ email: u.email });
    if (!existing) {
      const hash = await bcrypt.hash(u.passwordPlain, 10);
      await User.create({ ...u, password: hash });
      console.log('[SEED] Created user', u.email);
    } else {
      // İsteğe bağlı: şifreleri güncelle (her restart'ta resetlemek istersen ACTIVE_RESET=true yap)
      if (process.env.RESET_DEFAULT_PASSWORDS === 'true') {
        const hash = await bcrypt.hash(u.passwordPlain, 10);
        existing.password = hash;
  existing.status = u.status; // tekrar onaylı hale getir
  existing.role = u.role;
        await existing.save();
  console.log('[SEED] Updated existing user', u.email, '-> status:', existing.status, 'role:', existing.role);
      } else {
  console.log('[SEED] Exists user', u.email, 'status:', existing.status, 'role:', existing.role);
      }
    }
  }

  // Backfill: eksik isDeleted alanlarını false yap
  const result = await User.updateMany({ isDeleted: { $exists: false } }, { $set: { isDeleted: false } });
  if (result.modifiedCount) {
    console.log('[SEED] Backfilled isDeleted=false for', result.modifiedCount, 'users');
  }
}
