// server/middleware/isAdmin.js
export default function isAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Erişim reddedildi. Yetersiz yetki.' });
  }
  next();
}
