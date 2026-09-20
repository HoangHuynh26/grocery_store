const express = require('express');
const router = express.Router();
const AiController = require('../controllers/aiController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

router.use(authenticateToken);

router.post('/chat', AiController.chat);
router.post('/classify-product', AiController.classifyProduct);
router.get('/forecast', AiController.getForecast);
router.post('/retrain', requireAdmin, AiController.retrainModel);

module.exports = router;
