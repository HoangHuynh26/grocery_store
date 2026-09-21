const LangGraphAgent = require('../modules/ai/assistant/langGraphAgent');
const ForecastService = require('../modules/ai/forecasting/forecastService');
const ProductClassifier = require('../modules/ai/classifier/productClassifier');
const { EmbeddingService } = require('../modules/ai/embedding/embeddingService');
const cronScheduler = require('../modules/ai/embedding/cronScheduler');
const ContinuousLearningEngine = require('../modules/ai/learning/continuousLearningEngine');
const ProductVisionEngine = require('../modules/ai/vision/productVisionEngine');
const { query } = require('../database');
const { createAuditLog } = require('../repositories/auditRepository');
const { AppError } = require('../middleware/errorHandler');
const config = require('../config/env');

class AiController {
  static async chat(req, res, next) {
    const { message, sessionId } = req.body;
    try {
      if (!message || !message.trim()) {
        throw new AppError('Tin nhắn không được để trống.', 400, 'EMPTY_MESSAGE');
      }

      // Process with LangGraph tool-based agent
      const agentResponse = await LangGraphAgent.processMessage(message);

      // Save message in chat_messages if session exists or create one
      let currentSessionId = sessionId;
      if (!currentSessionId) {
        const sessionRes = await query(
          `INSERT INTO chat_sessions (user_id, title, created_at, updated_at)
           VALUES ($1, $2, NOW(), NOW()) RETURNING id;`,
          [req.user.id, message.substring(0, 50)]
        );
        currentSessionId = sessionRes.rows[0].id;
      }

      // Insert user message
      await query(
        `INSERT INTO chat_messages (session_id, role, content, created_at)
         VALUES ($1, 'user', $2, NOW());`,
        [currentSessionId, message]
      );

      // Insert assistant message
      await query(
        `INSERT INTO chat_messages (session_id, role, content, tool_calls, created_at)
         VALUES ($1, 'assistant', $2, $3, NOW());`,
        [currentSessionId, agentResponse.reply, agentResponse.toolUsed ? JSON.stringify({ tool: agentResponse.toolUsed }) : null]
      );

      return res.status(200).json({
        success: true,
        data: {
          sessionId: currentSessionId,
          reply: agentResponse.reply,
          toolUsed: agentResponse.toolUsed,
          structuredData: agentResponse.data || null
        }
      });
    } catch (err) {
      next(err);
    }
  }

  static async getForecast(req, res, next) {
    try {
      const forecast = await ForecastService.getLatestForecast();
      return res.status(200).json({
        success: true,
        data: forecast
      });
    } catch (err) {
      next(err);
    }
  }

  static async retrainModel(req, res, next) {
    const clientIp = req.ip || req.headers['x-forwarded-for'];
    const userAgent = req.headers['user-agent'];

    try {
      const result = await ForecastService.trainAndForecast();

      await createAuditLog({
        userId: req.user.id,
        action: 'RETRAIN_FORECAST_MODEL',
        entityType: 'FORECAST_MODEL',
        entityId: result.model.id,
        newValues: {
          version: result.model.version,
          mape: result.model.mape,
          rmse: result.model.rmse,
          predictedRevenue: result.forecast.predicted_revenue
        },
        reason: 'Huấn luyện lại mô hình dự báo doanh thu tự động',
        ipAddress: clientIp,
        userAgent
      });

      return res.status(200).json({
        success: true,
        data: result,
        message: 'Huấn luyện và cập nhật mô hình dự đoán doanh thu thành công.'
      });
    } catch (err) {
      next(err);
    }
  }

  static async classifyProduct(req, res, next) {
    try {
      const { name, productName, description } = req.body;
      const targetName = name || productName;
      if (!targetName || !targetName.trim()) {
        throw new AppError('Vui lòng cung cấp tên sản phẩm để AI phân loại.', 400, 'MISSING_NAME');
      }

      const result = await ProductClassifier.classify(targetName, description);
      return res.status(200).json({
        success: true,
        data: result
      });
    } catch (err) {
      next(err);
    }
  }

  static async getEmbeddingStatus(req, res, next) {
    try {
      const stats = await EmbeddingService.getEmbeddingStats();
      const schedulerStatus = cronScheduler.getStatus();
      return res.status(200).json({
        success: true,
        data: {
          ...stats,
          scheduler: schedulerStatus
        }
      });
    } catch (err) {
      next(err);
    }
  }

  static async syncEmbeddings(req, res, next) {
    try {
      const force = req.body.force !== undefined ? req.body.force : true;
      const stats = await cronScheduler.triggerManualRun({ force });
      return res.status(200).json({
        success: true,
        data: stats,
        message: `Đã hoàn tất cập nhật embedding cho ${stats.updatedCount} sản phẩm.`
      });
    } catch (err) {
      next(err);
    }
  }

  static async semanticSearch(req, res, next) {
    try {
      const { query: queryText, limit = 5 } = req.body;
      const results = await EmbeddingService.searchSimilarProducts(queryText, limit);
      return res.status(200).json({
        success: true,
        data: results
      });
    } catch (err) {
      next(err);
    }
  }

  static async getLearningStats(req, res, next) {
    try {
      const stats = await ContinuousLearningEngine.getLearningStats();
      return res.status(200).json({
        success: true,
        data: stats
      });
    } catch (err) {
      next(err);
    }
  }

  static async getTrainingLogs(req, res, next) {
    try {
      const limit = parseInt(req.query.limit || '15', 10);
      const logs = await ContinuousLearningEngine.getTrainingLogs(limit);
      return res.status(200).json({
        success: true,
        data: logs
      });
    } catch (err) {
      next(err);
    }
  }

  static async triggerSelfTraining(req, res, next) {
    try {
      const sessionType = req.body.sessionType || 'MANUAL_TRIGGER';
      const result = await ContinuousLearningEngine.runDailySelfTraining({ sessionType });
      return res.status(200).json({
        success: true,
        data: result,
        message: 'Hoàn tất phiên tự học và huấn luyện toàn diện các mô hình AI.'
      });
    } catch (err) {
      next(err);
    }
  }

  static async recognizeProductImage(req, res, next) {
    try {
      const { image, imageBase64, hintText } = req.body;
      const targetImage = imageBase64 || image;

      if (!targetImage && !hintText) {
        throw new AppError('Vui lòng cung cấp hình ảnh sản phẩm hoặc gợi ý nhãn hàng.', 400, 'MISSING_IMAGE');
      }

      const result = await ProductVisionEngine.recognizeProduct({
        imageBase64: targetImage,
        hintText
      });

      return res.status(200).json({
        success: true,
        data: result
      });
    } catch (err) {
      next(err);
    }
  }

  static async transcribeAudio(req, res, next) {
    try {
      const { audioBase64, mimeType = 'audio/webm' } = req.body;
      if (!audioBase64) {
        throw new AppError('Dữ liệu âm thanh không được để trống.', 400, 'EMPTY_AUDIO');
      }

      const cleanBase64 = audioBase64.replace(/^data:audio\/[a-z0-9]+;base64,/, '');

      if (!config.geminiApiKey) {
        return res.status(200).json({
          success: false,
          message: 'Chưa cấu hình GEMINI_API_KEY để xử lý giọng nói đám mây.',
          text: ''
        });
      }

      const prompt = `Bạn là trợ lý nhận dạng giọng nói tiếng Việt cho ứng dụng bán hàng POS và quản lý siêu thị/tạp hóa.
Hãy nghe đoạn âm thanh này và xuất ra chính xác văn bản tiếng Việt người dùng vừa nói.
Ví dụ: "Hôm nay doanh thu thế nào", "Kiểm tra tồn kho mì Hảo Hảo", "Top 5 sản phẩm bán chạy nhất hôm nay", "Có hóa đơn nào chưa thanh toán không".
Yêu cầu: Chỉ trả về duy nhất văn bản tiếng Việt được chuyển đổi, không kèm giải thích hay từ ngữ thừa nào khác. Nếu không có tiếng nói hoặc chỉ là tiếng ồn ngẫu nhiên, trả về chuỗi rỗng.`;

      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${config.geminiApiKey}`;
      const payload = {
        contents: [
          {
            parts: [
              { text: prompt },
              {
                inline_data: {
                  mime_type: mimeType,
                  data: cleanBase64
                }
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.1
        }
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.warn('[AiController] Gemini Audio Transcribe warning:', errorText);
        return res.status(200).json({
          success: false,
          message: 'Không thể nhận diện âm thanh lúc này.',
          text: ''
        });
      }

      const data = await response.json();
      const transcribedText = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';

      return res.status(200).json({
        success: true,
        text: transcribedText
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = AiController;
