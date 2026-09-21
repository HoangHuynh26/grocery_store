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

// Continuous Self-Learning Endpoints (Daily auto-train & on product add)
router.get('/learning-stats', AiController.getLearningStats);
router.get('/training-logs', AiController.getTrainingLogs);
router.post('/self-train', requireAdmin, AiController.triggerSelfTraining);

// AI Visual Product Recognition (Camera Packaging & Label Scanner)
router.post('/recognize-product-image', AiController.recognizeProductImage);

// AI Voice Speech-to-Text Transcription (Multimodal Gemini Audio)
router.post('/transcribe-audio', AiController.transcribeAudio);

module.exports = router;
