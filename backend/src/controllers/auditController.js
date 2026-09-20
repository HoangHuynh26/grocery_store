const { getAuditLogs } = require('../repositories/auditRepository');

class AuditController {
  static async list(req, res, next) {
    try {
      const page = parseInt(req.query.page || '1', 10);
      const limit = parseInt(req.query.limit || '20', 10);
      const startDate = req.query.startDate || null;
      const endDate = req.query.endDate || null;
      const userId = req.query.userId || null;
      const action = req.query.action || null;
      const entityType = req.query.entityType || null;

      const logs = await getAuditLogs({
        startDate,
        endDate,
        userId,
        action,
        entityType,
        page,
        limit
      });

      return res.status(200).json({
        success: true,
        data: logs
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = AuditController;
