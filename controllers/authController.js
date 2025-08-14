import User from '../models/user.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import Joi from 'joi';
import nodemailer from 'nodemailer';
import { JWT_SECRET, debugSecret } from '../config/secrets.js';
import Session from '../models/session.js';
debugSecret();
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1d';
const REQUIRE_EMAIL_VERIFICATION = String(process.env.REQUIRE_EMAIL_VERIFICATION || 'false') === 'true';
const EMAIL_FROM = process.env.EMAIL_FROM || 'no-reply@odyostore.com';
const APP_URL = process.env.APP_URL || 'http://localhost:3000';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

async function sendMail({ to, subject, html }) {
  await transporter.sendMail({
    from: EMAIL_FROM,
    to,
    subject,
    html
  });
}

const companyInfoSchema = Joi.object({
  companyName: Joi.string().optional(),
  taxNumber: Joi.string().optional(),
  address: Joi.object({
    street: Joi.string().optional(),
    district: Joi.string().optional(),
    city: Joi.string().optional(),
    postalCode: Joi.string().optional(),
    country: Joi.string().optional(),
    taxOffice: Joi.string().optional(),
  }).optional(),
  website: Joi.string().optional(),
  foundedYear: Joi.number().optional(),
  employeeCount: Joi.number().optional(),
  licenseNumber: Joi.string().optional(),
  licenseDocumentUrl: Joi.string()
    .custom((value, helpers) => {
      if (value === undefined || value === null || value === '') return value; // treat empty as omitted
      if (typeof value !== 'string') return helpers.error('any.invalid');
      // Accept relative paths like /uploads/...
      if (value.startsWith('/')) return value;
      // Accept http/https absolute URLs
      try {
        // eslint-disable-next-line no-new
        new URL(value);
        return value;
      } catch (e) {
        return helpers.error('string.uri');
      }
    })
    .optional(),
  certifications: Joi.array().items(Joi.string()).optional(),
}).optional();

const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  personalInfo: Joi.object().optional(),
  companyInfo: companyInfoSchema
});
const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});
const forgotSchema = Joi.object({ email: Joi.string().email().required() });
const resetSchema = Joi.object({
  token: Joi.string().required(),
  newPassword: Joi.string().min(6).required()
});

// Kullanıcı Girişi
export const login = async (req, res, next) => {
  try {
    if (process.env.DEBUG_AUTH === 'true') {
      console.log('[DEBUG][LOGIN] Incoming body:', req.body);
    }
    const { error } = loginSchema.validate(req.body);
    if (error) {
      if (process.env.DEBUG_AUTH === 'true') {
        console.log('[DEBUG][LOGIN] Joi validation error:', error.details[0].message);
      }
      return res.status(400).json({ message: error.details[0].message });
    }

    let { email, password } = req.body;
    const rawEmail = email;
    email = (email || '').trim().toLowerCase();
    if (process.env.DEBUG_AUTH === 'true' && rawEmail !== email) {
      console.log('[DEBUG][LOGIN] Normalized email:', rawEmail, '->', email);
    }
    const totalUsers = await User.countDocuments();
    if (process.env.DEBUG_AUTH === 'true') {
      console.log('[DEBUG][LOGIN] Total users in DB:', totalUsers);
    }
    const user = await User.findOne({
      email,
      $or: [ { isDeleted: false }, { isDeleted: { $exists: false } } ]
    });
    if (process.env.DEBUG_AUTH === 'true') {
      console.log('[DEBUG][LOGIN] Queried user by email:', email, '->', user ? { id: user.id, status: user.status, role: user.role } : 'NOT_FOUND');
    }
    if (!user) {
      return res.status(400).json({ message: 'Kullanıcı bulunamadı.' });
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (process.env.DEBUG_AUTH === 'true') {
      console.log('[DEBUG][LOGIN] Password match:', isMatch);
    }
    if (!isMatch) {
      return res.status(400).json({ message: 'Şifre hatalı.' });
    }
    if (user.status !== 'approved') {
      if (process.env.DEBUG_AUTH === 'true') {
        console.log('[DEBUG][LOGIN] User not approved status=', user.status);
      }
      return res.status(403).json({ message: 'Hesap onaylı değil. Lütfen yönetici onayını bekleyin.' });
    }

  const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  user.lastLoginAt = new Date();
  const ua = req.headers['user-agent'] || '';
  user.lastLoginDevice = ua || 'Bilinmiyor';
  user.lastLoginUa = ua;
  // naive UA parse for OS/Browser
  const osMatch = ua.match(/Windows|Mac OS X|Linux|Android|iOS/i);
  const browserMatch = ua.match(/Chrome|Firefox|Safari|Edge|OPR|Opera/i);
  user.lastLoginOS = osMatch ? osMatch[0] : undefined;
  user.lastLoginBrowser = browserMatch ? (browserMatch[0] === 'OPR' ? 'Opera' : browserMatch[0]) : undefined;
  // behind proxy support
  const fwd = (req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  user.lastLoginIp = fwd || req.ip || req.socket?.remoteAddress || '0.0.0.0';
    await user.save();
    // create session
    try {
      const expMs = (()=>{
        // Try to derive ms from JWT_EXPIRES_IN (supports s|m|h|d)
        const m = String(JWT_EXPIRES_IN||'').match(/^(\d+)([smhd])$/);
        if (!m) return undefined;
        const n = parseInt(m[1]);
        const unit = m[2];
        const mult = unit==='s'?1000: unit==='m'?60000: unit==='h'?3600000: 86400000;
        return Date.now() + n*mult;
      })();
      await Session.create({
        userId: user.id,
        userAgent: ua,
        ip: user.lastLoginIp,
        createdAt: new Date(),
        expiresAt: expMs ? new Date(expMs) : undefined
      });
    } catch {}
    if (process.env.DEBUG_AUTH === 'true') {
      console.log('[DEBUG][LOGIN] SUCCESS issuing token for user:', { id: user.id, role: user.role });
    }
    res.json({ token, user });
  } catch (err) {
    if (process.env.DEBUG_AUTH === 'true') {
      console.log('[DEBUG][LOGIN] Exception:', err);
    }
    next(err);
  }
};

// Kullanıcı Kaydı
export const register = async (req, res, next) => {
  try {
    const { error } = registerSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.details[0].message });

  let { email, password, personalInfo, companyInfo } = req.body;
  if (process.env.DEBUG_AUTH === 'true') {
    console.log('[DEBUG][REGISTER] Incoming companyInfo:', companyInfo);
  }
  email = (email || '').trim().toLowerCase();
  const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ message: 'Bu e-posta ile zaten kayıtlı.' });

    const hash = await bcrypt.hash(password, 10);
  const user = await User.create({
      email,
      password: hash,
      personalInfo,
      // Başvurudaki şirket bilgilerini pending kuyruğuna al
      companyInfo: undefined,
      companyInfoPending: companyInfo || undefined,
      companyInfoApprovalStatus: companyInfo ? 'pending' : 'approved',
      status: 'pending',
      role: companyInfo ? 'center' : 'user'
    });

    // Audit log için
    res.locals.createdUserId = user.id;
    res.locals.newUser = user;

    // Email onay linki oluştur
    if (REQUIRE_EMAIL_VERIFICATION) {
      try {
        const emailToken = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '1d' });
        const verifyLink = `${APP_URL}/api/auth/verify-email/${emailToken}`;
        if (process.env.SMTP_HOST) {
          await sendMail({
            to: user.email,
            subject: "Odyostore Hesap Onayı",
            html: `<p>Merhaba,</p><p>Hesabınızı onaylamak için <a href="${verifyLink}">buraya tıklayın</a>.</p>`
          });
        } else if (process.env.DEBUG_AUTH === 'true') {
          console.warn('[REGISTER] SMTP yapılandırılmadı, e-posta gönderimi atlandı. Doğrulama linki:', verifyLink);
        }
      } catch (mailErr) {
        if (process.env.DEBUG_AUTH === 'true') {
          console.warn('[REGISTER] Email gönderimi başarısız:', mailErr.message);
        }
        // E-posta gönderilemese de kayıt tamamlanır.
      }
    }

    res.status(201).json({
      message: REQUIRE_EMAIL_VERIFICATION
        ? 'Kayıt başarılı. Lütfen email adresinizi onaylayın.'
        : 'Başvuru alındı. Yönetici onayı bekleniyor.',
      user: { id: user.id, email: user.email, status: user.status }
    });
  } catch (err) {
    next(err);
  }
};

// Oturum Açmış Kullanıcı Bilgisi
export const me = async (req, res, next) => {
  try {
  const user = await User.findOne({ id: req.user.id, isDeleted: false }).select('-password');
  if (!user) return res.status(404).json({ message: 'Kullanıcı bulunamadı.' });
  // Normalize company info for frontend: expose name/taxNo, prefer pending if awaiting approval
  const out = user.toObject ? user.toObject() : user;
  const approvalPending = out.companyInfoApprovalStatus === 'pending' && out.companyInfoPending;
  const src = approvalPending ? (out.companyInfoPending || {}) : (out.companyInfo || {});
      // Safety: default approval status to 'approved' if company info exists but status missing/invalid
      if (!out.companyInfoApprovalStatus && (out.companyInfo?.companyName || out.companyInfo?.name)) {
        out.companyInfoApprovalStatus = 'approved';
      }
  const companyName = src.companyName || src.name || undefined;
  const taxNumber = src.taxNumber || src.taxNo || undefined;
  out.companyInfo = out.companyInfo || {};
  // Preserve original fields
  out.companyInfo.companyName = companyName || out.companyInfo.companyName;
  out.companyInfo.taxNumber = taxNumber || out.companyInfo.taxNumber;
  // Add aliases expected by FE
  out.companyInfo.name = companyName || out.companyInfo.name;
  out.companyInfo.taxNo = taxNumber || out.companyInfo.taxNo;
  return res.json(out);
  } catch (err) {
    next(err);
  }
};

// Profil Güncelleme
export const updateProfile = async (req, res, next) => {
  try {
    const oldUser = await User.findOne({ id: req.user.id });
    const updates = { ...req.body };
    // Build a $set document with dot paths to ensure fields are persisted reliably
    const setDoc = {};
    // Accept basic editable fields
    if (typeof updates.email === 'string') setDoc['email'] = updates.email.trim().toLowerCase();
    if (updates.personalInfo && typeof updates.personalInfo === 'object') {
      const pi = updates.personalInfo;
      if (pi.firstName !== undefined) setDoc['personalInfo.firstName'] = pi.firstName;
      if (pi.lastName !== undefined) setDoc['personalInfo.lastName'] = pi.lastName;
      if (pi.phone !== undefined) setDoc['personalInfo.phone'] = pi.phone;
      if (pi.title !== undefined) setDoc['personalInfo.title'] = pi.title;
      if (pi.avatar !== undefined) setDoc['personalInfo.avatar'] = pi.avatar;
      if (pi.avatarShape !== undefined) setDoc['personalInfo.avatarShape'] = pi.avatarShape;
    }
    // Company info goes to pending and requires approval
    if (updates.companyInfo && typeof updates.companyInfo === 'object') {
      const ci = updates.companyInfo || {};
      const companyName = ci.companyName || ci.name;
      const taxNumber = ci.taxNumber || ci.taxNo;
      if (companyName !== undefined) setDoc['companyInfoPending.companyName'] = companyName;
      if (taxNumber !== undefined) setDoc['companyInfoPending.taxNumber'] = taxNumber;
      if (ci.address !== undefined) setDoc['companyInfoPending.address'] = ci.address;
      if (ci.website !== undefined) setDoc['companyInfoPending.website'] = ci.website;
      if (ci.foundedYear !== undefined) setDoc['companyInfoPending.foundedYear'] = ci.foundedYear;
      if (ci.employeeCount !== undefined) setDoc['companyInfoPending.employeeCount'] = ci.employeeCount;
      if (ci.licenseNumber !== undefined) setDoc['companyInfoPending.licenseNumber'] = ci.licenseNumber;
      if (ci.licenseDocumentUrl !== undefined) setDoc['companyInfoPending.licenseDocumentUrl'] = ci.licenseDocumentUrl;
      if (ci.certifications !== undefined) setDoc['companyInfoPending.certifications'] = ci.certifications;
      setDoc['companyInfoApprovalStatus'] = 'pending';
      setDoc['companyInfoPendingAt'] = new Date();
    }
    const user = await User.findOneAndUpdate({ id: req.user.id }, { $set: setDoc }, { new: true, runValidators: true }).select('-password');
    res.locals.oldUser = oldUser;
    res.locals.updatedUser = user;
    // Echo normalized company info aliases in response for immediate UI reflection
    const out = user.toObject ? user.toObject() : user;
    const src = out.companyInfoPending && out.companyInfoApprovalStatus === 'pending' ? out.companyInfoPending : out.companyInfo || {};
    const companyName = src.companyName || src.name;
    const taxNumber = src.taxNumber || src.taxNo;
    out.companyInfo = out.companyInfo || {};
    out.companyInfo.companyName = companyName || out.companyInfo.companyName;
    out.companyInfo.taxNumber = taxNumber || out.companyInfo.taxNumber;
    out.companyInfo.name = companyName || out.companyInfo.name;
    out.companyInfo.taxNo = taxNumber || out.companyInfo.taxNo;
    res.json(out);
  } catch (err) {
    next(err);
  }
};

export const logout = async (req, res) => {
  try {
    // Best-effort: mark latest session as revoked
    const last = await Session.findOne({ userId: req.user.id }).sort({ createdAt: -1 });
    if (last && !last.revokedAt) {
      last.revokedAt = new Date();
      last.revokedBy = req.user.id;
      await last.save();
    }
  } catch {}
  res.json({ message: 'Çıkış yapıldı.' });
};

export const refreshToken = async (req, res) => {
  res.status(501).json({ message: 'Henüz geliştirilmedi.' });
};

// Email Doğrulama
export const verifyEmail = async (req, res, next) => {
  try {
    const { token } = req.params;
    let payload;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return res.status(400).json({ message: 'Geçersiz veya süresi dolmuş onay linki.' });
    }
    const user = await User.findOne({ id: payload.id, email: payload.email, isDeleted: false });
    if (!user) return res.status(404).json({ message: 'Kullanıcı bulunamadı.' });
    if (user.status === 'approved') return res.json({ message: 'Email zaten onaylanmış.' });
    user.status = 'approved';
    await user.save();
    res.json({ message: 'Email başarıyla onaylandı. Artık giriş yapabilirsiniz.' });
  } catch (err) {
    next(err);
  }
};

// Şifre Sıfırlama (email ile)
export const forgotPassword = async (req, res, next) => {
  try {
    const { error } = forgotSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.details[0].message });

    const user = await User.findOne({ email: req.body.email, isDeleted: false });
    if (!user) return res.status(400).json({ message: 'Böyle bir kullanıcı bulunamadı.' });

    // Audit log için
    res.locals.affectedUserId = user.id;

    const resetToken = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '30m' });
    const resetLink = `${APP_URL}/reset-password?token=${resetToken}`;
    await sendMail({
      to: user.email,
      subject: "Odyostore Şifre Sıfırlama",
      html: `<p>Şifrenizi sıfırlamak için <a href="${resetLink}">buraya tıklayın</a>.</p>`
    });
    res.json({ message: 'Şifre sıfırlama maili gönderildi.' });
  } catch (err) {
    next(err);
  }
};

// Şifre Sıfırlama (token ile)
export const resetPassword = async (req, res, next) => {
  try {
    const { error } = resetSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.details[0].message });

    let payload;
    try {
      payload = jwt.verify(req.body.token, JWT_SECRET);
    } catch (err) {
      return res.status(400).json({ message: 'Geçersiz veya süresi dolmuş sıfırlama linki.' });
    }
    const user = await User.findOne({ id: payload.id, email: payload.email, isDeleted: false });
    if (!user) return res.status(404).json({ message: 'Kullanıcı bulunamadı.' });
    user.password = await bcrypt.hash(req.body.newPassword, 10);
    await user.save();
    res.locals.affectedUserId = user.id;
    res.json({ message: 'Şifreniz başarıyla güncellendi. Giriş yapabilirsiniz.' });
  } catch (err) {
    next(err);
  }
};
