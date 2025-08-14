import express from 'express';
import { exportOrders, orderSummary, exportLoyalty } from '../controllers/reportController.js';
import verifyToken from '../middleware/verifyToken.js';
import roleAuth from '../middleware/roleAuth.js';

const router = express.Router();

// Admin tüm siparişleri; Supplier kendi siparişlerini export edebilir
router.get('/orders', verifyToken, roleAuth(['admin','supplier']), exportOrders);
router.get('/orders/summary', verifyToken, roleAuth(['admin','supplier']), orderSummary);
router.get('/loyalty', verifyToken, roleAuth(['admin']), exportLoyalty);

export default router;

