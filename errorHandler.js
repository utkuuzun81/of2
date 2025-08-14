const logger = require('../logger');
module.exports = (err, req, res, next) => {
  logger.error(err);
  res.status(err.status || 500).json({ message: err.message || 'Beklenmeyen bir hata oluştu.' });
};

export default errorHandler;