import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import verifyToken from '../middleware/verifyToken.js';
import uploadS3 from '../middleware/uploadS3.js';
import {
  uploadImage,
  uploadDocument,
  getFile,
  deleteFile
} from '../controllers/uploadController.js';

const router = express.Router();

// Multer storage ayarı (yerel kullanım için)
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'uploads/';
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage });

// S3'lü resim yükleme
router.post('/image', verifyToken, uploadS3.single('image'), uploadImage);

// Yerel resim yükleme (S3 olmayan fallback)
router.post('/image/local', verifyToken, upload.single('image'), uploadImage);

// Belge yükleme
router.post('/document', verifyToken, upload.single('document'), uploadDocument);

// Kayıt akışı için herkese açık belge yükleme (yalnızca ruhsat gibi kayıt belgeleri)
router.post('/document/public', upload.single('document'), uploadDocument);

// Dosya görüntüleme
router.get('/files/:filename', getFile);

// Dosya silme
router.delete('/files/:filename', verifyToken, deleteFile);

export default router;
