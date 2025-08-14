import express from 'express';
import {
  createQuotation,
  respondQuotation,
  acceptQuotation,
  rejectQuotation,
  getQuotationById,
  getQuotationsForCenter,
  getQuotationsForSupplier,
  getAllQuotationsAdmin
} from '../controllers/quotationController.js';
import verifyToken from '../middleware/verifyToken.js';
import roleAuth from '../middleware/roleAuth.js';
import auditLogger from '../middleware/auditLogger.js';

const router = express.Router();

// Teklif oluştur (İşitme merkezi)
router.post(
  '/',
  verifyToken,
  roleAuth(['center']),
  createQuotation,
  auditLogger('QUOTATION_CREATE', 'Quotation', (req, res) => res.locals.newValue._id, (req, res) => ({
    oldValue: null,
    newValue: res.locals.newValue
  }))
);

// Tedarikçi yanıt verir
router.put(
  '/:id/respond',
  verifyToken,
  roleAuth(['supplier']),
  respondQuotation,
  auditLogger('QUOTATION_RESPOND', 'Quotation', (req, res) => req.params.id, (req, res) => ({
    oldValue: null,
    newValue: res.locals.newValue
  }))
);

// Merkez kabul eder
router.put(
  '/:id/accept',
  verifyToken,
  roleAuth(['center']),
  acceptQuotation,
  auditLogger('QUOTATION_ACCEPT', 'Quotation', (req, res) => req.params.id, (req, res) => ({
    oldValue: null,
    newValue: res.locals.newValue
  }))
);

// Merkez reddeder
router.put(
  '/:id/reject',
  verifyToken,
  roleAuth(['center']),
  rejectQuotation,
  auditLogger('QUOTATION_REJECT', 'Quotation', (req, res) => req.params.id, (req, res) => ({
    oldValue: null,
    newValue: res.locals.newValue
  }))
);

// Merkezin teklifleri (specific routes should come BEFORE generic '/:id')
router.get('/center', verifyToken, roleAuth(['center']), getQuotationsForCenter);

// Tedarikçinin teklifleri
router.get('/supplier', verifyToken, roleAuth(['supplier']), getQuotationsForSupplier);

// Admin: tüm teklifler
router.get('/admin', verifyToken, roleAuth(['admin']), getAllQuotationsAdmin);

// Teklif detayı (keep after specific routes to avoid intercepting '/center' or '/supplier')
router.get('/:id', verifyToken, getQuotationById);

export default router;
