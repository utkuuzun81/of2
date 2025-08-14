import express from 'express';
import rateLimit from 'express-rate-limit';
import Joi from 'joi';
import Notification from '../models/Notification.js';
import { getSystemPublic } from '../controllers/settingsController.js';

const router = express.Router();

// Per-route rate limit: max 5 contact messages per minute per IP
const contactLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Çok sık iletişim isteği gönderdiniz, lütfen kısa bir süre sonra tekrar deneyin.'
});

const contactSchema = Joi.object({
  name: Joi.string().trim().max(120).allow('', null),
  email: Joi.string().trim().email({ tlds: { allow: false } }).required(),
  message: Joi.string().trim().min(10).max(2000).required()
});

// Public system info
router.get('/system', getSystemPublic);

router.post('/contact', contactLimiter, async (req, res) => {
  try {
    const { error, value } = contactSchema.validate(req.body || {}, { abortEarly: false });
    if (error) {
      return res.status(400).json({ message: 'Geçersiz veri', details: error.details.map(d => d.message) });
    }
    const { name, email, message } = value;
    await Notification.create({
      title: `İletişim: ${name || 'Anonim'}`,
      message: `${email}: ${message}`,
      priority: 'low'
    });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ message: 'İletişim gönderilemedi' });
  }
});

export default router;
