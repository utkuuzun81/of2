module.exports = function(req, res, next) {
  if (!req.user || req.user.status !== 'approved') {
    return res.status(403).json({ message: 'Hesabınız onaylı değil. Lütfen yönetici onayını bekleyin.' });
  }
  next();
};
