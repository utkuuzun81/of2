import logger from './logger.js'; // Eğer logger kullanacaksan, import ile çek

const errorHandler = (err, req, res, next) => {
  // Hataları logla
  logger && logger.error ? logger.error(err) : console.error(err);

  // Joi validation hatası
  if (err.isJoi) {
    return res.status(400).json({ message: err.details[0].message });
  }

  // Diğer hata
  res.status(err.status || 500).json({
    message: err.message || 'Beklenmeyen bir hata oluştu.'
  });
};

export default errorHandler;
