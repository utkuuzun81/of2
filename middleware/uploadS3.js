import dotenv from 'dotenv';
dotenv.config();
import multer from 'multer';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import path from 'path';

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ''
  }
});

// Memory storage: önce RAM'e alacağız sonra manuel S3 upload.
const memoryStorage = multer.memoryStorage();

export const uploadS3 = multer({
  storage: memoryStorage,
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'application/pdf'];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error('Geçersiz dosya tipi!'));
    }
    cb(null, true);
  },
  limits: { fileSize: 10 * 1024 * 1024 }
});

// Middleware: uploadS3.single('file') sonrası çağır.
export async function persistUploadedFileToS3(req, res, next) {
  if (!req.file) return next();
  try {
    const ext = path.extname(req.file.originalname).replace(/\s+/g, '');
    const key = `${Date.now()}-${req.file.originalname.replace(/\s+/g, '_')}`;
    const bucket = process.env.AWS_S3_BUCKET;
    const put = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
      ACL: 'public-read'
    });
    await s3.send(put);
    req.file.location = `https://${bucket}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
    req.file.key = key;
    next();
  } catch (e) {
    next(e);
  }
}

export default uploadS3;
