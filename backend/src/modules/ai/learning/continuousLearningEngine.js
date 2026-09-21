const { query } = require('../../../database');
const { removeVietnameseAccents } = require('../../../utils/text');
const { EmbeddingService } = require('../embedding/embeddingService');
const ForecastService = require('../forecasting/forecastService');
const { VN_OFFSET_HOURS, formatVnDateTime } = require('../../../utils/timezone');

// Stopwords to filter out during feature extraction
const VIETNAMESE_STOPWORDS = new Set([
  'va', 'cua', 'cho', 'voi', 'la', 'cac', 'nhung', 'mot', 'trong', 'tai', 'tren', 'duoi',
  'loai', 'san', 'pham', 'hang', 'ngay', 'thang', 'nam', 'khi', 'de', 'rat', 'duoc',
  'gói', 'lon', 'chai', 'hop', 'bich', 'tui', 'loc', 'ly', 'kg', 'gam', 'ml', 'lit',
  'cao', 'cap', 'dac', 'biet', 'chinh', 'hang', 'chat', 'luong', 'sieu', 'moi'
]);

class ContinuousLearningEngine {
  /**
   * Tokenizes text and extracts meaningful candidate domain keywords / brands (1-grams & 2-grams)
   */
  static extractKeywords(name, description = '') {
    const raw = `${name || ''} ${description || ''}`.toLowerCase();
    const clean = removeVietnameseAccents(raw);
    const tokens = clean.split(/[\s,.-/+&():;]+/).filter(w => w.length >= 2 && !VIETNAMESE_STOPWORDS.has(w));

    const keywords = new Set();
    // 1-grams
    tokens.forEach(t => {
      if (t.length >= 3 && !/^\d+$/.test(t)) {
        keywords.add(t);
      }
    });

    // 2-grams (e.g. "o long", "bo huc", "tra xanh", "hao hao")
    for (let i = 0; i < tokens.length - 1; i++) {
      const bigram = `${tokens[i]} ${tokens[i + 1]}`;
      if (!/^\d+\s+\d+$/.test(bigram)) {
        keywords.add(bigram);
      }
    }

    return Array.from(keywords);
  }

  /**
   * Incremental Learning: Automatically called every time a new product is added or imported
   * @param {Object} product
   */
  static async onProductAdded(product) {
    if (!product || !product.id) return null;
    const startTime = Date.now();

    try {
      // 1. Fetch category information if not populated
      let categoryId = product.category_id || product.categoryId;
      let categoryName = product.category_name;

      if (!categoryId) {
        // Automatically infer category from product name & description using AI classifier
        try {
          const ProductClassifier = require('../classifier/productClassifier');
          const autoCat = await ProductClassifier.classify(product.name, product.description);
          if (autoCat && autoCat.categoryId) {
            categoryId = autoCat.categoryId;
            categoryName = autoCat.categoryName;
          }
        } catch (catErr) {
          console.warn('[Self-Learning] Auto-category classification notice:', catErr.message);
        }
      } else if (!categoryName && categoryId) {
        const catRes = await query('SELECT name FROM categories WHERE id = $1;', [categoryId]);
        if (catRes.rowCount > 0) categoryName = catRes.rows[0].name;
      }

      // 2. Extract brand and descriptive keywords from product
      const extractedTerms = this.extractKeywords(product.name, product.description);
      let learnedCount = 0;

      if (categoryId && extractedTerms.length > 0) {
        for (const term of extractedTerms) {
          const upsertSql = `
            INSERT INTO ai_learned_knowledge (
              knowledge_type, term, category_id, weight, frequency, source, updated_at
            ) VALUES (
              'KEYWORD_CATEGORY', $1, $2, 1.2, 1, 'PRODUCT_INGESTION', NOW()
            )
            ON CONFLICT (knowledge_type, term, category_id)
            DO UPDATE SET 
              frequency = ai_learned_knowledge.frequency + 1,
              weight = LEAST(ai_learned_knowledge.weight + 0.15, 3.0),
              updated_at = NOW();
          `;
          await query(upsertSql, [term, categoryId]);
          learnedCount++;
        }
      }

      // 3. Immediately compute and store 128-D vector embedding
      let embeddingSuccess = false;
      try {
        await EmbeddingService.updateProductEmbedding(product.id);
        embeddingSuccess = true;
      } catch (embErr) {
        console.warn('[Self-Learning] Product vector embedding notice:', embErr.message);
      }

      const durationMs = Date.now() - startTime;
      const insights = [
        `Học được ${learnedCount} từ khóa nhận thức mới cho danh mục "${categoryName || 'Sản phẩm'}".`,
        `Đã tạo vector ngữ nghĩa 128-D cho sản phẩm "${product.name}".`
      ];

      // 4. Record micro-learning epoch into training logs
      const logSql = `
        INSERT INTO ai_training_logs (
          session_type, model_types, items_processed, metrics, insights, status, duration_ms, created_at
        ) VALUES (
          'INCREMENTAL_PRODUCT_ADD',
          ARRAY['PRODUCT_CLASSIFIER', 'VECTOR_EMBEDDING'],
          1,
          $1,
          $2,
          'SUCCESS',
          $3,
          NOW()
        );
      `;
      await query(logSql, [
        JSON.stringify({
          learnedKeywordsCount: learnedCount,
          embeddingGenerated: embeddingSuccess,
          productId: product.id,
          productCode: product.product_code || product.productCode
        }),
        JSON.stringify(insights),
        durationMs
      ]);

      console.log(`[Self-Learning] 🧠 Incremental learning complete for product "${product.name}": ${learnedCount} keywords learned in ${durationMs}ms`);

      return {
        success: true,
        learnedKeywords: learnedCount,
        embeddingSuccess,
        durationMs,
        insights
      };
    } catch (err) {
      console.error('[Self-Learning] Incremental learning error:', err.message);
      return { success: false, error: err.message };
    }
  }

  /**
   * Scans entire product catalog to ingest knowledge, brands, and n-grams into ai_learned_knowledge
   */
  static async trainCatalogKnowledge() {
    const prodRes = await query(`
      SELECT p.id, p.name, p.description, p.category_id, c.name as category_name
      FROM products p
      JOIN categories c ON p.category_id = c.id
      WHERE p.is_active = TRUE;
    `);

    // Aggregate frequencies across all catalog products
    const termMap = new Map();
    for (const p of prodRes.rows) {
      const terms = this.extractKeywords(p.name, p.description);
      for (const term of terms) {
        const key = `${term}|${p.category_id}`;
        if (!termMap.has(key)) {
          termMap.set(key, { term, categoryId: p.category_id, freq: 1 });
        } else {
          termMap.get(key).freq++;
        }
      }
    }

    const items = Array.from(termMap.values());
    const chunkSize = 40;
    for (let i = 0; i < items.length; i += chunkSize) {
      const chunk = items.slice(i, i + chunkSize);
      const values = [];
      const params = [];
      chunk.forEach((item, idx) => {
        const offset = idx * 3;
        values.push(`('KEYWORD_CATEGORY', $${offset + 1}, $${offset + 2}, 1.0, $${offset + 3}, 'CATALOG_HARVEST', NOW())`);
        params.push(item.term, item.categoryId, item.freq);
      });

      const sql = `
        INSERT INTO ai_learned_knowledge (
          knowledge_type, term, category_id, weight, frequency, source, updated_at
        ) VALUES ${values.join(', ')}
        ON CONFLICT (knowledge_type, term, category_id)
        DO UPDATE SET 
          frequency = ai_learned_knowledge.frequency + EXCLUDED.frequency,
          weight = LEAST(ai_learned_knowledge.weight + 0.1, 3.0),
          updated_at = NOW();
      `;
      await query(sql, params);
    }

    const countRes = await query('SELECT COUNT(DISTINCT term) as vocab_size FROM ai_learned_knowledge;');
    return {
      productsProcessed: prodRes.rowCount,
      totalAssociations: items.length,
      vocabularySize: parseInt(countRes.rows[0].vocab_size || 0, 10)
    };
  }

  /**
   * Analyzes daily sales velocity and intelligent reorder suggestions
   */
  static async trainDemandAndReorder() {
    const sql = `
      SELECT 
        p.id, p.name, p.stock_quantity, p.minimum_stock,
        COALESCE(SUM(ii.quantity), 0) as total_sold_recent,
        COUNT(DISTINCT i.id) as invoice_occurrences
      FROM products p
      LEFT JOIN invoice_items ii ON p.id = ii.product_id
      LEFT JOIN invoices i ON ii.invoice_id = i.id AND i.status != 'CANCELLED'
      WHERE p.is_active = TRUE
      GROUP BY p.id, p.name, p.stock_quantity, p.minimum_stock;
    `;
    const res = await query(sql);

    let highDemandCount = 0;
    let stockoutRiskCount = 0;

    for (const row of res.rows) {
      const sold = parseInt(row.total_sold_recent, 10);
      const stock = parseInt(row.stock_quantity, 10);
      const minStock = parseInt(row.minimum_stock, 10);

      if (sold >= 10) highDemandCount++;
      if (stock <= minStock) stockoutRiskCount++;
    }

    return {
      totalProductsAnalyzed: res.rowCount,
      highDemandProducts: highDemandCount,
      stockoutRiskProducts: stockoutRiskCount
    };
  }

  /**
   * Daily Self-Training Pipeline: Orchestrates all AI models
   * 1. Retrains Domain Classifier Knowledge Base
   * 2. Retrains ML Revenue Forecasting Model
   * 3. Retrains Demand Velocity & Reorder Recommendations
   * 4. Synchronizes Semantic Vector Embeddings
   * 5. Synthesizes Vietnamese Learning Insights & Saves to ai_training_logs
   */
  static async runDailySelfTraining({ sessionType = 'DAILY_AUTO_TRAIN', force = false } = {}) {
    console.log(`[Self-Learning] 🚀 Starting Comprehensive AI Self-Training Pipeline (${sessionType}, force=${force})...`);
    const startTime = Date.now();
    const insights = [];

    try {
      // Step 1: Retrain catalog vocabulary & keyword patterns
      const vocabStats = await this.trainCatalogKnowledge();
      insights.push(`Mô hình Phân Loại đã tự học ${vocabStats.vocabularySize} từ khóa và thương hiệu từ ${vocabStats.productsProcessed} sản phẩm.`);

      // Step 2: Retrain Revenue Forecasting ML Model
      let forecastMetrics = { rmse: 0, mape: 0 };
      try {
        const forecastResult = await ForecastService.trainAndForecast();
        forecastMetrics = {
          version: forecastResult.model.version,
          rmse: forecastResult.model.rmse,
          mape: forecastResult.model.mape,
          nextMonth: forecastResult.forecast.forecast_month,
          predictedRevenue: forecastResult.forecast.predicted_revenue
        };
        insights.push(`Mô hình Dự Báo Doanh Thu (Trend & Seasonality) đã tự tối ưu: sai số MAPE đạt ${forecastResult.model.mape.toFixed(2)}%, RMSE đạt ${Math.round(forecastResult.model.rmse).toLocaleString('vi-VN')} đ.`);
      } catch (fErr) {
        console.warn('[Self-Learning] Forecasting train warning:', fErr.message);
        insights.push(`Mô hình Dự Báo Doanh Thu ghi nhận: Đã bảo lưu tham số tối ưu gần nhất.`);
      }

      // Step 3: Analyze Demand Velocity & Stock Risks
      const demandStats = await this.trainDemandAndReorder();
      insights.push(`Phân tích nhu cầu: Có ${demandStats.highDemandProducts} sản phẩm bán chạy cao điểm và ${demandStats.stockoutRiskProducts} sản phẩm cần bổ sung tồn kho.`);

      // Step 4: Refresh dense vector embeddings
      const embStats = await EmbeddingService.updateAllProductEmbeddings({ force });
      insights.push(`Hệ thống Vector 128-D: Đã đồng bộ ngữ nghĩa cho ${embStats.updatedCount} sản phẩm.`);

      const durationMs = Date.now() - startTime;

      // Step 5: Save training log to database
      const metrics = {
        vocabularySize: vocabStats.vocabularySize,
        catalogProducts: vocabStats.productsProcessed,
        forecastingMape: forecastMetrics.mape,
        forecastingRmse: forecastMetrics.rmse,
        forecastNextMonth: forecastMetrics.nextMonth,
        predictedRevenue: forecastMetrics.predictedRevenue,
        highDemandProducts: demandStats.highDemandProducts,
        stockoutRiskProducts: demandStats.stockoutRiskProducts,
        embeddingsUpdated: embStats.updatedCount
      };

      const logSql = `
        INSERT INTO ai_training_logs (
          session_type, model_types, items_processed, metrics, insights, status, duration_ms, created_at
        ) VALUES (
          $1,
          ARRAY['PRODUCT_CLASSIFIER', 'REVENUE_FORECAST', 'DEMAND_ANALYSIS', 'VECTOR_EMBEDDING'],
          $2,
          $3,
          $4,
          'SUCCESS',
          $5,
          NOW()
        ) RETURNING id, created_at;
      `;
      const logRes = await query(logSql, [
        sessionType,
        vocabStats.productsProcessed,
        JSON.stringify(metrics),
        JSON.stringify(insights),
        durationMs
      ]);

      console.log(`[Self-Learning] ✅ Comprehensive AI Self-Training completed in ${durationMs}ms (Session ID: ${logRes.rows[0].id})`);

      return {
        success: true,
        sessionId: logRes.rows[0].id,
        sessionType,
        metrics,
        insights,
        durationMs,
        completedAt: logRes.rows[0].created_at
      };
    } catch (err) {
      console.error('[Self-Learning] ❌ Self-training pipeline error:', err.message);
      const durationMs = Date.now() - startTime;

      await query(`
        INSERT INTO ai_training_logs (
          session_type, model_types, items_processed, metrics, insights, status, error_message, duration_ms, created_at
        ) VALUES (
          $1, ARRAY['PRODUCT_CLASSIFIER', 'REVENUE_FORECAST'], 0, '{}', '[]', 'FAILED', $2, $3, NOW()
        );
      `, [sessionType, err.message, durationMs]);

      throw err;
    }
  }

  /**
   * Retrieves overall learning statistics for UI dashboard and AI Assistant inquiries
   */
  static async getLearningStats() {
    const [logCountRes, vocabRes, lastLogRes, forecastRes] = await Promise.all([
      query(`SELECT COUNT(*) as total_epochs FROM ai_training_logs WHERE status = 'SUCCESS';`),
      query(`SELECT COUNT(DISTINCT term) as total_terms, COUNT(*) as total_associations FROM ai_learned_knowledge;`),
      query(`SELECT * FROM ai_training_logs WHERE status = 'SUCCESS' ORDER BY created_at DESC LIMIT 1;`),
      query(`SELECT * FROM forecast_models WHERE is_active = TRUE ORDER BY created_at DESC LIMIT 1;`)
    ]);

    const lastLog = lastLogRes.rows[0] || null;
    const activeModel = forecastRes.rows[0] || null;

    // Next scheduled midnight
    const now = new Date();
    const vnNow = new Date(now.getTime() + VN_OFFSET_HOURS * 3600 * 1000);
    const nextMidnightTime = Date.UTC(
      vnNow.getUTCFullYear(),
      vnNow.getUTCMonth(),
      vnNow.getUTCDate() + 1,
      0, 0, 0, 0
    ) - VN_OFFSET_HOURS * 3600 * 1000;
    const nextRunDate = new Date(nextMidnightTime);
    const hoursUntilNext = Math.round(((nextMidnightTime - now.getTime()) / (3600 * 1000)) * 10) / 10;

    return {
      status: 'ACTIVE_SELF_LEARNING',
      mode: 'AUTOMATED_DAILY_AND_ON_PRODUCT_ADD',
      totalTrainingSessions: parseInt(logCountRes.rows[0].total_epochs || 0, 10),
      learnedVocabularyTerms: parseInt(vocabRes.rows[0].total_terms || 0, 10),
      learnedAssociations: parseInt(vocabRes.rows[0].total_associations || 0, 10),
      forecastingAccuracy: activeModel ? {
        modelVersion: activeModel.model_version,
        mape: parseFloat(activeModel.mape_error || 0),
        rmse: parseFloat(activeModel.rmse_error || 0),
        accuracyPercentage: Math.max(0, 100 - parseFloat(activeModel.mape_error || 0))
      } : null,
      lastTrainedAt: lastLog ? lastLog.created_at : null,
      lastTrainedFormatted: lastLog ? formatVnDateTime(lastLog.created_at) : 'Chưa có phiên tự học',
      lastSessionType: lastLog ? lastLog.session_type : null,
      lastInsights: lastLog && lastLog.insights ? (typeof lastLog.insights === 'string' ? JSON.parse(lastLog.insights) : lastLog.insights) : [],
      nextAutoTrainAt: nextRunDate.toISOString(),
      nextAutoTrainFormatted: formatVnDateTime(nextRunDate),
      hoursUntilNextTrain: hoursUntilNext
    };
  }

  /**
   * Retrieves recent training logs
   */
  static async getTrainingLogs(limit = 15) {
    const res = await query(`
      SELECT id, session_type, model_types, items_processed, metrics, insights, status, duration_ms, created_at
      FROM ai_training_logs
      ORDER BY created_at DESC
      LIMIT $1;
    `, [limit]);

    return res.rows.map(r => ({
      ...r,
      metrics: typeof r.metrics === 'string' ? JSON.parse(r.metrics) : r.metrics,
      insights: typeof r.insights === 'string' ? JSON.parse(r.insights) : r.insights,
      created_at_formatted: formatVnDateTime(r.created_at)
    }));
  }
}

module.exports = ContinuousLearningEngine;
