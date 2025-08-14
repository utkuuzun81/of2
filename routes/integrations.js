import express from 'express';
import {
  initPayment,
  verifyPayment,
  createShipment,
  trackShipment,
  generateInvoice
} from '../controllers/integrationController.js';

import verifyToken from '../middleware/verifyToken.js';
import roleAuth from '../middleware/roleAuth.js';

const router = express.Router();

// Ödeme
router.post('/payment/init', verifyToken, initPayment);
router.post('/payment/verify', verifyToken, verifyPayment);

// Kargo
router.post('/cargo/create', verifyToken, createShipment);
router.get('/cargo/track/:trackingNumber', verifyToken, trackShipment);

// Muhasebe
router.post('/invoice/generate', verifyToken, roleAuth(['admin']), generateInvoice);

export default router;
