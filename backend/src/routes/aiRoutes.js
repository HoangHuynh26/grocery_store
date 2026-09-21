const express = require('express');
const router = express.Router();
const AiController = require('../controllers/aiController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

router.use(authenticateToken);

router.post('/chat', AiController.chat);
router.post('/classify-product', AiController.classifyProduct);
router.get('/forecast', AiController.getForecast);
router.post('/retrain', requireAdmin, AiController.retrainModel);

// Product Embeddings Endpoints (Auto-update on product creation & 12:00 AM Midnight)
router.get('/embeddings/status', AiController.getEmbeddingStatus);
router.post('/embeddings/sync', requireAdmin, AiController.syncEmbeddings);
router.post('/embeddings/search', AiController.semanticSearch);

module.exports = router;
