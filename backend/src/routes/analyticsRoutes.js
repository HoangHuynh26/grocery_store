const express = require('express');
const router = express.Router();
const AnalyticsController = require('../controllers/analyticsController');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

router.get('/summary', AnalyticsController.getSummary);
router.get('/chart', AnalyticsController.getChart);

module.exports = router;
