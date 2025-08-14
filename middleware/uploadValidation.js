module.exports = function (allowedTypes = [], maxSizeMB = 5) {
  return function (req, file, cb) {
    // Dosya tipi kontrolü
    if (!allowedTypes.includes(file.mimetype)) {
      return cb(new Error('Geçersiz dosya türü!'));
    }
    // Dosya boyutu kontrolü (Multer otomatik sınır koyuyorsa gerek yok)
    if (file.size > maxSizeMB * 1024 * 1024) {
      return cb(new Error('Dosya boyutu çok büyük!'));
    }
    cb(null, true);
  }
};
