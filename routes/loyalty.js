import express from 'express';
import verifyToken from '../middleware/verifyToken.js';
import roleAuth from '../middleware/roleAuth.js';
import { getSummary, getTransactions, adminAssignPoints, adminListUserTransactions, adminAudit, adminBackfillEarn } from '../controllers/loyaltyController.js';

const router = express.Router();

// Center kullanıcıları ve admin erişebilir
router.get('/summary', verifyToken, roleAuth(['center','admin']), getSummary);
router.get('/transactions', verifyToken, roleAuth(['center','admin']), getTransactions);
// Admin
router.post('/admin/assign', verifyToken, roleAuth(['admin']), adminAssignPoints);
router.get('/admin/:userId/transactions', verifyToken, roleAuth(['admin']), adminListUserTransactions);
router.get('/admin/audit', verifyToken, roleAuth(['admin']), adminAudit);
router.post('/admin/backfill/earn', verifyToken, roleAuth(['admin']), adminBackfillEarn);

export default router;
