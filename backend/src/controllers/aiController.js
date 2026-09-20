const LangGraphAgent = require('../modules/ai/assistant/langGraphAgent');
const ForecastService = require('../modules/ai/forecasting/forecastService');
const { query } = require('../database');
const { createAuditLog } = require('../repositories/auditRepository');
const { AppError } = require('../middleware/errorHandler');

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
}

module.exports = AiController;
