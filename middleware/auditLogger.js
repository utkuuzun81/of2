import AuditLog from '../models/auditlog.js';

const auditLogger = (action, resource, getResourceId, getChangeData) => {
  return async (req, res, next) => {
    try {
      const userId = req.user?.id;
      const ip = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const resourceId = typeof getResourceId === 'function' ? getResourceId(req, res) : null;
      const { oldValue, newValue } = typeof getChangeData === 'function' ? getChangeData(req, res) : {};

      const log = new AuditLog({
        userId,
        action,
        resource,
        resourceId,
        ip,
        userAgent,
        oldValue,
        newValue
      });

      await log.save();
    } catch (err) {
      console.error('Audit log kaydedilemedi:', err);
    } finally {
      next();
    }
  };
};

export default auditLogger;
