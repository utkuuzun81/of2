import User from '../models/user.js';

// Tüm kullanıcıları listele (opsiyonel filtreler ile)
export async function listUsers(req, res) {
  try {
  const { status, role, q } = req.query || {};
  // Legacy kayıtlar için isDeleted alanı olmayanları da kapsa: { $ne: true }
  const filter = { isDeleted: { $ne: true } };
    if (status && status !== 'all') filter.status = status;
    if (role && role !== 'all') filter.role = role;
    if (q) {
      const rx = new RegExp(q, 'i');
      filter.$or = [
        { email: rx },
        { 'personalInfo.firstName': rx },
        { 'personalInfo.lastName': rx },
        { 'companyInfo.companyName': rx }
      ];
    }

    const users = await User.find(filter)
      .select('email role status createdAt companyInfo companyInfoPending companyInfoApprovalStatus')
      .sort({ createdAt: -1 })
      .lean();
    console.log('[ADMIN][listUsers]', { filter, count: users.length });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// Bekleyen kullanıcı kayıtlarını listele (status === 'pending' ve isDeleted false)
export async function listPendingUsers(req, res) {
  try {
  const users = await User.find({ status: 'pending', isDeleted: { $ne: true } })
      .select('email createdAt companyInfoPending companyInfo companyInfoApprovalStatus personalInfo role status')
      .sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// Kullanıcıya rol ata (supplier veya center)
export async function assignRole(req, res) {
  try {
    const { id } = req.params;
    const { role } = req.body;
    if (!['supplier', 'center'].includes(role)) {
      return res.status(400).json({ error: 'Geçersiz rol.' });
    }
    const oldUser = await User.findById(id);
    const user = await User.findByIdAndUpdate(
      id,
      { role },
      { new: true }
    ).select('firmaAdi email role licenseUrl');
    res.locals.oldUser = oldUser;
    res.locals.updatedUser = user;
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// Kullanıcıyı soft delete ile sil (admin)
export async function deleteUser(req, res) {
  try {
    const oldUser = await User.findById(req.params.id);
    await User.findByIdAndUpdate(req.params.id, { isDeleted: true });
    res.locals.oldUser = oldUser;
    res.json({ message: "Kullanıcı soft delete ile silindi." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
