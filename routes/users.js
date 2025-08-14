import express from 'express';
import User from '../models/user.js';
import verifyToken from '../middleware/verifyToken.js';
import isAdmin from '../middleware/isAdmin.js';
import auditLogger from '../middleware/auditLogger.js';
import { listUsers, listPendingUsers, assignRole, deleteUser } from '../controllers/userController.js';

const router = express.Router();

// Bekleyen başvuruları getir (isDeleted false!)
router.get('/pending', verifyToken, isAdmin, listPendingUsers);

// Tüm kullanıcıları getir (admin)
router.get('/', verifyToken, isAdmin, listUsers);

// Kullanıcıya rol ata (auditLogger ile!)
router.put(
  '/:id/role',
  verifyToken,
  isAdmin,
  assignRole, // Önce controller
  auditLogger(
    'USER_ROLE_ASSIGN',
    'User',
    (req, res) => req.params.id,
    (req, res) => ({ oldValue: res.locals.oldUser, newValue: res.locals.updatedUser })
  )
);

// Kullanıcı sil (soft delete)
router.delete(
  '/:id',
  verifyToken,
  isAdmin,
  deleteUser, // Önce controller
  auditLogger(
    'USER_SOFT_DELETE',
    'User',
    (req, res) => req.params.id,
    (req, res) => ({ oldValue: res.locals.oldUser, newValue: { isDeleted: true } })
  )
);

export default router;
