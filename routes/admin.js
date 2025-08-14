import express from 'express';
import {
  updateUserRoleStatus,
  bulkDeleteUsers,
  bulkDisableProducts,
  markQuotationsAccepted,
  approveCompanyInfo,
  listApprovalQueue,
  handleApprovalAction
} from '../controllers/adminController.js';

import verifyToken from '../middleware/verifyToken.js';
import roleAuth from '../middleware/roleAuth.js';
import auditLogger from '../middleware/auditLogger.js';

const router = express.Router();

router.put(
  '/users/:id',
  verifyToken,
  roleAuth(['admin']),
  updateUserRoleStatus,
  auditLogger('ADMIN_UPDATE_USER', 'User', (req, res) => req.params.id, (req, res) => ({
    oldValue: res.locals.oldValue,
    newValue: res.locals.newValue
  }))
);

router.put(
  '/users/bulk-delete',
  verifyToken,
  roleAuth(['admin']),
  bulkDeleteUsers,
  auditLogger('ADMIN_BULK_DELETE_USERS', 'User', () => 'bulk', (req, res) => ({
    oldValue: res.locals.oldValue,
    newValue: res.locals.newValue
  }))
);

router.put(
  '/products/bulk-disable',
  verifyToken,
  roleAuth(['admin']),
  bulkDisableProducts,
  auditLogger('ADMIN_BULK_DISABLE_PRODUCTS', 'Product', () => 'bulk', (req, res) => ({
    oldValue: res.locals.oldValue,
    newValue: res.locals.newValue
  }))
);

router.put(
  '/quotations/bulk-accept',
  verifyToken,
  roleAuth(['admin']),
  markQuotationsAccepted,
  auditLogger('ADMIN_BULK_ACCEPT_QUOTES', 'Quotation', () => 'bulk', (req, res) => ({
    oldValue: res.locals.oldValue,
    newValue: res.locals.newValue
  }))
);

// Kurumsal bilgi onay/red
router.post(
  '/users/:id/company-info/approve',
  verifyToken,
  roleAuth(['admin']),
  approveCompanyInfo,
  auditLogger('ADMIN_APPROVE_COMPANY_INFO', 'User', (req) => req.params.id, (req, res) => ({
    oldValue: res.locals.oldValue,
    newValue: res.locals.newValue
  }))
);

export default router;

// Onay Merkezi
router.get(
  '/approvals',
  verifyToken,
  roleAuth(['admin']),
  listApprovalQueue
);
router.post(
  '/approvals/:type/:id',
  verifyToken,
  roleAuth(['admin']),
  handleApprovalAction,
  auditLogger('ADMIN_APPROVAL_ACTION', 'Approval', (req) => `${req.params.type}:${req.params.id}`, (req) => ({ action: req.body?.action || 'unknown', type: req.params.type }))
);
