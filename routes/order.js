import express from 'express';
import verifyToken from '../middleware/verifyToken.js';
import auditLogger from '../middleware/auditLogger.js';
import {
  createOrder,
  getUserOrders,
  updateOrder,
  deleteOrder
} from '../controllers/orderController.js';

const router = express.Router();

// CREATE: Sipariş oluştur
router.post(
  '/',
  verifyToken,
  auditLogger(
    'ORDER_CREATE',
    'Order',
    (req, res) => res.locals.createdOrderId,
    (req, res) => ({ oldValue: null, newValue: res.locals.newOrder })
  ),
  createOrder
);

// UPDATE: Sipariş güncelle (ör. status değiştirme)
router.put(
  '/:id',
  verifyToken,
  // updateOrder fonksiyonu güncellemeden önce eski değeri ve yeni değeri res.locals'a atar!
  auditLogger(
    'ORDER_UPDATE',
    'Order',
    (req, res) => req.params.id,
    (req, res) => ({ oldValue: res.locals.oldOrder, newValue: res.locals.updatedOrder })
  ),
  updateOrder
);

// DELETE: Sipariş sil (soft delete)
router.delete(
  '/:id',
  verifyToken,
  // deleteOrder eski order bilgisini res.locals.oldOrder'a atmalı!
  auditLogger(
    'ORDER_DELETE',
    'Order',
    (req, res) => req.params.id,
    (req, res) => ({ oldValue: res.locals.oldOrder, newValue: { isDeleted: true } })
  ),
  deleteOrder
);

// Listeleme (log gerektirmez)
router.get('/', verifyToken, getUserOrders);

export default router;
