import multer from 'multer';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = `uploads/${req.params.folder || 'misc'}`;
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const uniqueName = `${file.fieldname}_${Date.now()}${ext}`;
    cb(null, uniqueName);
  }
});

const fileFilter = (req, file, cb) => {
  const allowed = ['.pdf', '.jpg', '.jpeg', '.png', '.docx'];
  const ext = path.extname(file.originalname).toLowerCase();
  cb(null, allowed.includes(ext));
};

export default multer({ storage, fileFilter });
