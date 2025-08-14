import express from 'express';
import verifyToken from '../middleware/verifyToken.js';
import roleAuth from '../middleware/roleAuth.js';
import {
  getSystemSettings,
  updateSystemSettings,
  getUserSettings,
  updateUserSettings
} from '../controllers/settingsController.js';

const router = express.Router();

// Sistem ayarları
router.get('/system', verifyToken, roleAuth(['admin']), getSystemSettings);
router.put('/system', verifyToken, roleAuth(['admin']), updateSystemSettings);

// Kullanıcı ayarları
router.get('/user', verifyToken, getUserSettings);
router.put('/user', verifyToken, updateUserSettings);

export default router;
