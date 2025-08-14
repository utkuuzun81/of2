const multer = require('multer');
const path = require('path');

// Sadece resim/döküman tipi ve boyut kontrolü
const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
const maxSizeMB = 10;

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g, '_'));
  }
});
const fileFilter = (req, file, cb) => {
  if (!allowedTypes.includes(file.mimetype)) {
    return cb(new Error('Geçersiz dosya türü!'), false);
  }
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: maxSizeMB * 1024 * 1024 }
});

module.exports = upload;
