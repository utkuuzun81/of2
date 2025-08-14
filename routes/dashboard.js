
import express from 'express';
import dashboardController from '../controllers/dashboardController.js';
import verifyToken from '../middleware/verifyToken.js';
import roleAuth from '../middleware/roleAuth.js';

const router = express.Router();

// Dashboardlar
router.get('/admin', verifyToken, roleAuth('admin'), dashboardController.getAdminDashboard);
router.get('/center', verifyToken, roleAuth('center'), dashboardController.getCenterDashboard);
router.get('/supplier', verifyToken, roleAuth('supplier'), dashboardController.getSupplierDashboard);

// Analytics
router.get('/analytics/sales', verifyToken, roleAuth('admin'), dashboardController.getSalesAnalytics);
router.get('/analytics/products', verifyToken, roleAuth('admin'), dashboardController.getProductsAnalytics);

export default router;
