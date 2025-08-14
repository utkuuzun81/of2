import express from 'express';
import * as defectController from '../controllers/defectController.js';
import verifyToken from '../middleware/verifyToken.js';
import roleAuth from '../middleware/roleAuth.js';
import auditLogger from '../middleware/auditLogger.js';

const router = express.Router();

router.get('/', verifyToken, roleAuth(['admin']), defectController.listDefects);
router.get('/:id', verifyToken, roleAuth(['admin']), defectController.getDefect);

router.post(
  '/',
  verifyToken,
  roleAuth(['admin']),
  defectController.createDefect,
  auditLogger(
    'DEFECT_CREATE', 'Defect',
  (req, res) => res.locals.createdDefectId,
  (req, res) => ({ oldValue: null, newValue: res.locals.newDefect })
  )
);

router.put(
  '/:id',
  verifyToken,
  roleAuth(['admin']),
  defectController.updateDefect,
  auditLogger(
    'DEFECT_UPDATE', 'Defect',
    (req, res) => req.params.id,
  (req, res) => ({ oldValue: res.locals.oldDefect, newValue: res.locals.updatedDefect })
  )
);

router.put(
  '/:id/status',
  verifyToken,
  roleAuth(['admin']),
  defectController.updateDefectStatus,
  auditLogger(
    'DEFECT_STATUS_UPDATE', 'Defect',
    (req, res) => req.params.id,
    (req, res) => ({ oldValue: res.locals.oldDefect, newValue: res.locals.updatedDefect })
  )
);

router.delete(
  '/:id',
  verifyToken,
  roleAuth(['admin']),
  defectController.softDeleteDefect,
  auditLogger(
    'DEFECT_SOFT_DELETE', 'Defect',
    (req, res) => req.params.id,
    (req, res) => ({ oldValue: null, newValue: { isDeleted: true } })
  )
);

export default router;
