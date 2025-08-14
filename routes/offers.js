// routes/offers.js
import express from 'express';
const router = express.Router();

// Teklif gönder
router.post('/request', (req, res) => {
  const { userId, items } = req.body;
  res.json({ message: 'Teklif talebi alındı', userId, items });
});

// Kullanıcının tekliflerini getir
router.get('/:userId', (req, res) => {
  const { userId } = req.params;
  res.json({ userId, offers: [] });
});

export default router;