import express from 'express';
import {
  getUserNotifications,
  markAsRead,
  markAllAsRead,
  sendBulkNotification,
  deleteNotification
} from '../controllers/notificationController.js';
import verifyToken from '../middleware/verifyToken.js';
import roleAuth from '../middleware/roleAuth.js';

const router = express.Router();

// Kullanıcı bildirimleri
router.get('/', verifyToken, getUserNotifications);

// Okundu işareti
router.put('/:id/read', verifyToken, markAsRead);

// Tümünü okundu işaretle
router.put('/mark-all/read', verifyToken, markAllAsRead);

// Admin: toplu bildirim gönder
router.post('/send', verifyToken, roleAuth(['admin']), sendBulkNotification);

// Bildirim silme
router.delete('/:id', verifyToken, deleteNotification);

export default router;
