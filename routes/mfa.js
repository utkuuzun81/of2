import express from 'express';
import verifyToken from '../middleware/verifyToken.js';
import { startEnroll, verifyEnroll, disableMfa, regenerateBackupCodes, status } from '../controllers/mfaController.js';

const router = express.Router();

router.get('/status', verifyToken, status);
router.post('/start', verifyToken, startEnroll);
router.post('/verify', verifyToken, verifyEnroll);
router.post('/disable', verifyToken, disableMfa);
router.post('/backup-codes', verifyToken, regenerateBackupCodes);

export default router;
