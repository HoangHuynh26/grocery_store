const express = require('express');
const router = express.Router();
const AuditController = require('../controllers/auditController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

router.use(authenticateToken, requireAdmin);

router.get('/', AuditController.list);

module.exports = router;
