import express from 'express';
import * as orderController from '../controllers/orderController.js';
import verifyToken from '../middleware/verifyToken.js';
import roleAuth from '../middleware/roleAuth.js';

const router = express.Router();

// Sipariş oluştur
router.post('/', verifyToken, orderController.createOrder);

// Kullanıcıya özel sipariş geçmişi
router.get('/user/:id', verifyToken, orderController.getUserOrders);

// Merkez/tüm siparişler
router.get('/center', verifyToken, roleAuth('center'), orderController.getCenterOrders);
router.get('/supplier', verifyToken, roleAuth('supplier'), orderController.getSupplierOrders);
router.get('/admin', verifyToken, roleAuth('admin'), orderController.getAllOrders);

// Sipariş detay/işlem
router.get('/:id', verifyToken, orderController.getOrder);
router.put('/:id/status', verifyToken, roleAuth(['admin', 'supplier']), orderController.updateOrderStatus);
router.put('/:id/shipping', verifyToken, roleAuth(['admin', 'supplier']), orderController.updateShippingInfo);
router.put('/:id/assign-supplier', verifyToken, roleAuth('admin'), orderController.assignSupplier);
router.put('/:id/cancel', verifyToken, roleAuth('admin'), orderController.cancelOrderAdmin);
router.post('/:id/tracking', verifyToken, roleAuth(['admin', 'supplier']), orderController.addTrackingInfo);

// Fatura ve istatistik
router.get('/:id/invoice', verifyToken, orderController.getOrderInvoice);
router.get('/statistics', verifyToken, roleAuth('admin'), orderController.getOrderStatistics);

export default router;
