const roleAuth = (allowedRoles = []) => {
  return (req, res, next) => {
    const role = req.user?.role;
    if (!role || !allowedRoles.includes(role)) {
      return res.status(403).json({ message: 'Bu işlemi yapmak için yetkiniz yok.' });
    }
    next();
  };
};

export default roleAuth;
