import express from 'express';
import verifyToken from '../middleware/verifyToken.js';
import { listSessions, revokeSession, revokeAll } from '../controllers/sessionController.js';

const router = express.Router();

router.get('/', verifyToken, listSessions);
router.post('/revoke/:id', verifyToken, revokeSession);
router.post('/revoke-all', verifyToken, revokeAll);

export default router;
