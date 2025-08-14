import express from 'express';
import {
  applyFranchise,
  getMyApplication,
  updateMyApplication,
  getApprovedFranchises,
  getAllApplicationsAdmin,
  updateApplicationStatus,
  deleteApplication
} from '../controllers/franchiseController.js';
import verifyToken from '../middleware/verifyToken.js';
import roleAuth from '../middleware/roleAuth.js';
import auditLogger from '../middleware/auditLogger.js';

const router = express.Router();

// Kullanıcı başvurusu
router.post(
  '/apply',
  verifyToken,
  applyFranchise,
  auditLogger('FRANCHISE_APPLY', 'FranchiseApplication', (req, res) => res.locals.newValue._id, (req, res) => ({
    oldValue: null,
    newValue: res.locals.newValue
  }))
);

// Başvuru güncelle
router.put(
  '/my-application/:id',
  verifyToken,
  updateMyApplication,
  auditLogger('FRANCHISE_UPDATE', 'FranchiseApplication', (req, res) => req.params.id, (req, res) => ({
    oldValue: res.locals.oldValue,
    newValue: res.locals.newValue
  }))
);

// Kendi başvurusunu getir
router.get('/my-application', verifyToken, getMyApplication);

// Onaylı başvurular
router.get('/approved', verifyToken, getApprovedFranchises);

// Admin: tüm başvurular
router.get('/admin', verifyToken, roleAuth(['admin']), getAllApplicationsAdmin);

// Admin: başvuru durumu güncelle
router.put(
  '/admin/:id/status',
  verifyToken,
  roleAuth(['admin']),
  updateApplicationStatus,
  auditLogger('FRANCHISE_STATUS_UPDATE', 'FranchiseApplication', (req, res) => req.params.id, (req, res) => ({
    oldValue: res.locals.oldValue,
    newValue: res.locals.newValue
  }))
);

// Admin: başvuru sil (soft delete)
router.delete(
  '/admin/:id',
  verifyToken,
  roleAuth(['admin']),
  deleteApplication,
  auditLogger('FRANCHISE_DELETE', 'FranchiseApplication', (req, res) => req.params.id, (req, res) => ({
    oldValue: res.locals.oldValue,
    newValue: res.locals.newValue
  }))
);

export default router;
