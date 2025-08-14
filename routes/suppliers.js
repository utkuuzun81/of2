import express from 'express';
import {
  applySupplier,
  updateMyApplication,
  deleteSupplierApplication,
  getAllApplications
} from '../controllers/supplierController.js';
import verifyToken from '../middleware/verifyToken.js';
import roleAuth from '../middleware/roleAuth.js';
import auditLogger from '../middleware/auditLogger.js';

const router = express.Router();

// Tedarikçi başvuru
router.post(
  '/apply',
  verifyToken,
  applySupplier,
  auditLogger('SUPPLIER_APPLY', 'SupplierApplication', (req, res) => res.locals.newValue._id, (req, res) => ({
    oldValue: null,
    newValue: res.locals.newValue
  }))
);

// Güncelleme
router.put(
  '/my-application/:id',
  verifyToken,
  updateMyApplication,
  auditLogger('SUPPLIER_UPDATE', 'SupplierApplication', (req, res) => req.params.id, (req, res) => ({
    oldValue: res.locals.oldValue,
    newValue: res.locals.newValue
  }))
);

// Soft delete
router.delete(
  '/admin/:id',
  verifyToken,
  roleAuth(['admin']),
  deleteSupplierApplication,
  auditLogger('SUPPLIER_DELETE', 'SupplierApplication', (req, res) => req.params.id, (req, res) => ({
    oldValue: res.locals.oldValue,
    newValue: res.locals.newValue
  }))
);

// Liste
router.get('/admin', verifyToken, roleAuth(['admin']), getAllApplications);

export default router;
