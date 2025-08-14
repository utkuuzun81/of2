import express from 'express';
import Joi from 'joi';
import * as authController from '../controllers/authController.js';
import auditLogger from '../middleware/auditLogger.js';
import verifyToken from '../middleware/verifyToken.js';
import User from '../models/user.js';

const router = express.Router();

// Validation middleware
const validate = schema => (req, res, next) => {
  const { error } = schema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });
  next();
};

const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  personalInfo: Joi.object().optional(),
  companyInfo: Joi.object().optional()
});

// REGISTER
router.post(
  '/register',
  validate(registerSchema),
  authController.register, // Önce controller
  auditLogger(
    'USER_REGISTER',
    'User',
    (req, res) => res.locals.createdUserId,
    (req, res) => ({ oldValue: null, newValue: res.locals.newUser })
  )
);

// LOGIN (auditLogger da eklenebilir)
router.post('/login', authController.login);

// DEBUG: List users (always mounted; gated by DEBUG_AUTH flag)
router.get('/_debug/users', async (req, res) => {
  if (process.env.DEBUG_AUTH !== 'true') {
    return res.status(403).json({ message: 'DEBUG_AUTH disabled' });
  }
  try {
    const users = await User.find({}, 'id email role status lastLoginAt isDeleted').lean();
    res.json({ count: users.length, users });
  } catch (e) {
    res.status(500).json({ message: 'Debug users fetch failed', error: e.message });
  }
});

// Kendi profilini getir
router.get('/me', verifyToken, authController.me);

// PROFİL GÜNCELLE
router.put(
  '/profile',
  verifyToken,
  authController.updateProfile, // Önce controller
  auditLogger(
    'USER_PROFILE_UPDATE',
    'User',
    (req, res) => req.user.id,
    (req, res) => ({ oldValue: res.locals.oldUser, newValue: res.locals.updatedUser })
  )
);

router.post('/logout', verifyToken, authController.logout);
router.post('/refresh-token', authController.refreshToken);
router.get('/verify-email/:token', authController.verifyEmail);

// ŞİFRE SIFIRLAMA
router.post(
  '/forgot-password',
  authController.forgotPassword, // Önce controller
  auditLogger(
    'USER_FORGOT_PASSWORD',
    'User',
    (req, res) => res.locals.affectedUserId,
    (req, res) => ({ oldValue: null, newValue: { forgotPassword: true } })
  )
);

router.post(
  '/reset-password',
  authController.resetPassword, // Önce controller
  auditLogger(
    'USER_RESET_PASSWORD',
    'User',
    (req, res) => res.locals.affectedUserId,
    (req, res) => ({ oldValue: null, newValue: { resetPassword: true } })
  )
);

export default router;
