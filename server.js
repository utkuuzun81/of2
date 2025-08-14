import dotenv from 'dotenv';
dotenv.config();
console.log('>>> ENV BUCKET:', process.env.AWS_S3_BUCKET, '<<<');
console.log('>>> DEBUG_AUTH:', process.env.DEBUG_AUTH, '<<<');
console.log('[BUILD] SERVER_VERSION: 2025-08-14T00:00Z');

import './telemetry.js'; // Eğer yoksa, bu satırı kaldırabilirsin.
import express from 'express';
import mongoose from 'mongoose';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import logger from './middleware/logger.js';
import swaggerUi from 'swagger-ui-express';
import errorHandler from './middleware/errorHandler.js';
import http from 'http';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { initSocket } from './socket.js';
import { startWeeklyReportJob } from './cron/weeklyReportJob.js';
import { startNotificationCleanupJob } from './cron/cleanupNotificationsJob.js';
import { seedDefaultUsers } from './utils/seedDefaultUsers.js';
import { normalizeUsers } from './utils/normalizeUsers.js';

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Persisted path for MongoMemory fallback so data survives restarts in dev
const MEM_DB_PATH = process.env.MEM_DB_PATH || path.join(__dirname, '.data', 'mongo-memory');
const swaggerPath = path.join(__dirname, 'swagger.json');
const swaggerDocument = JSON.parse(fs.readFileSync(swaggerPath, 'utf-8'));

// Route dosyaları
import authRoutes from './routes/auth.js';
import productRoutes from './routes/products.js';
import quotationRoutes from './routes/quotations.js';
import orderRoutes from './routes/orders.js';
import mfaRoutes from './routes/mfa.js';
import sessionRoutes from './routes/sessions.js';
import notificationRoutes from './routes/notifications.js';
import settingsRoutes from './routes/settings.js';
import uploadRoutes from './routes/upload.js';
import dashboardRoutes from './routes/dashboard.js';
import reportRoutes from './routes/reports.js';
import integrationRoutes from './routes/integrations.js';
import healthRoutes from './routes/health.js';
import publicRoutes from './routes/public.js';
import loyaltyRoutes from './routes/loyalty.js';
import adminRoutes from './routes/admin.js';
import usersRoutes from './routes/users.js';
import defectRoutes from './routes/defects.js';

// Express ve HTTP sunucu başlat
const app = express();
const server = http.createServer(app);
const io = initSocket(server);
app.set('io', io);

// Security ve logging middleware
app.use(helmet());
app.use(cors({
  origin: [
    'http://localhost:5556',
    'http://localhost:5555',
    'http://127.0.0.1:5556',
    'http://127.0.0.1:5555'
  ],
  credentials: true
}));
app.use(logger);

// Rate limit
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: "Çok fazla istek gönderdiniz, lütfen daha sonra tekrar deneyin."
}));

// JSON ve form-data desteği
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Statik dosya servis (upload edilenler için)
app.use('/uploads', express.static('uploads'));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/quotations', quotationRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/mfa', mfaRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/integrations', integrationRoutes);
app.use('/api/health', healthRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/loyalty', loyaltyRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/defects', defectRoutes);

// Swagger (API dokümantasyonu)
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Root endpoint
app.get('/', (req, res) => res.json({ message: 'Odyostore API v1' }));

// 404 Catcher (API)
app.use('/api', (req, res, next) => {
  // Sadece başka route'a düşmemiş API istekleri
  console.warn('[API 404]', req.method, req.originalUrl, 'Body:', req.body);
  return res.status(404).json({ message: 'Endpoint bulunamadı', path: req.originalUrl });
});

// Generic 404 for everything else (ör: SPA route'ları frontend tarafından handle edilebilir)
// İstersek burada index.html servis edebilirdik; şimdilik sadece logluyoruz.
app.use((req, res, next) => {
  if (!req.originalUrl.startsWith('/api')) {
    console.warn('[WEB 404]', req.method, req.originalUrl);
  }
  next();
});

// Global error handler
app.use(errorHandler);

// Cron Joblar
startWeeklyReportJob();
startNotificationCleanupJob();

// MongoDB bağlantısı ve server başlatma (Atlas yoksa memory fallback)
const PORT = process.env.PORT || 5000;
async function start() {
  try {
    const uri = process.env.MONGO_URI;
    if (!uri) throw new Error('MONGO_URI not provided');
    await mongoose.connect(uri);
    console.log('✅ MongoDB connected');
  } catch (err) {
    console.error('❌ MongoDB bağlantı hatası veya MONGO_URI yok:', err.message);
    // Only allow fallback when not explicitly disabled
    if (String(process.env.DISABLE_MEMORY_FALLBACK || 'false') === 'true') {
      console.error('⛔ Memory fallback devre dışı. Lütfen geçerli bir MONGO_URI sağlayın.');
      process.exit(1);
    }
    // Ensure persistent folder exists (so data survives restarts)
    try {
      fs.mkdirSync(MEM_DB_PATH, { recursive: true });
    } catch {}
    const mongod = await MongoMemoryServer.create({
      instance: {
        dbPath: MEM_DB_PATH,
        storageEngine: 'wiredTiger'
      }
    });
    const memUri = mongod.getUri();
    await mongoose.connect(memUri);
    console.log('🧪 MongoMemoryServer (persisted) ile bağlandı:', MEM_DB_PATH);
    console.warn('⚠️ UYARI: Production için gerçek bir MongoDB kullanın. .env dosyanıza MONGO_URI ekleyin.');
  }
  server.listen(PORT, () => {
    console.log(`🚀 Sunucu aktif: http://localhost:${PORT}`);
  });
  // Normalize existing users (fix empty/invalid roles etc.)
  try { await normalizeUsers(); } catch (e) { console.warn('[NORMALIZE] Error:', e.message); }
  seedDefaultUsers().catch(e => console.error('[SEED] Hata:', e));
  // Default: do NOT seed products unless explicitly enabled
  if (String(process.env.ENABLE_SEED_PRODUCTS || 'false') === 'true') {
    try {
      const mod = await import('./utils/seedDefaultProducts.js');
      if (mod && typeof mod.seedDefaultProducts === 'function') {
        mod.seedDefaultProducts().catch(e => console.error('[SEED][Products] Hata:', e));
      } else {
        console.warn('[SEED][Products] seedDefaultProducts not found; skipping');
      }
    } catch (e) {
      console.warn('[SEED][Products] skipped (import error):', e.message);
    }
  } else {
    console.log('[SEED][Products] Skipped (ENABLE_SEED_PRODUCTS!=true)');
  }
}

start().catch((e) => {
  console.error('Fatal start error:', e);
  process.exit(1);
});

// ESM'de module.exports yok, test için export edin:
export default app;


