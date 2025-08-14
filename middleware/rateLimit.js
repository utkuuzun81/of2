const rateLimit = require('express-rate-limit');

module.exports = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 dakika
  max: 100, // Her IP 15 dakikada 100 istek atabilir
  message: 'Çok fazla istek attınız, lütfen daha sonra tekrar deneyin.'
});
