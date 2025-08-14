import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config/secrets.js';

export default function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token bulunamadı.' });
  }

  const token = authHeader.split(' ')[1];
  try {
  const decoded = jwt.verify(token, JWT_SECRET);
    console.log('🔐 decoded JWT payload:', decoded);
    req.user = { id: decoded.id, _id: decoded.id, role: decoded.role };
    next();
  } catch (err) {
    console.error('Token doğrulama hatası:', err);
    res.status(403).json({ error: 'Geçersiz token.' });
  }
}