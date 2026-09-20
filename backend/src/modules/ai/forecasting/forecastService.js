const { query } = require('../../../database');
const { TrendSeasonalityForecastModel } = require('./forecastEngine');
const { VN_OFFSET_HOURS } = require('../../../utils/timezone');

class ForecastService {
  /**
   * Fetch historical monthly revenues from database
   */
  static async getMonthlyRevenues() {
    const sql = `
      SELECT 
        TO_CHAR(created_at + INTERVAL '${VN_OFFSET_HOURS} hours', 'YYYY-MM') as month_str,
        COALESCE(SUM(total_amount), 0) as revenue,
        COUNT(id) as invoice_count
      FROM invoices
      WHERE status != 'CANCELLED'
      GROUP BY month_str
      ORDER BY month_str ASC;
    `;
    const res = await query(sql);
    return res.rows.map(r => ({
      monthStr: r.month_str,
      revenue: parseFloat(r.revenue),
      invoiceCount: parseInt(r.invoice_count, 10),
      calendarMonth: parseInt(r.month_str.split('-')[1], 10) - 1
    }));
  }

  /**
   * Run training pipeline, evaluate past models, and predict next month
   */
  static async trainAndForecast() {
    const historical = await this.getMonthlyRevenues();
    
    // Evaluate past pending forecasts
    await this.evaluatePendingForecasts(historical);

    const model = new TrendSeasonalityForecastModel();
    model.train(historical);

    // Predict for next month
    const now = new Date();
    const currentYear = now.getUTCFullYear();
    const currentMonth = now.getUTCMonth(); // 0-11
    
    let nextMonth = currentMonth + 1;
    let nextYear = currentYear;
    if (nextMonth > 11) {
      nextMonth = 0;
      nextYear += 1;
    }
    const nextMonthStr = `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}`;

    const prediction = model.predict(1, nextMonth);

    // In-sample evaluation
    const actuals = historical.map(h => h.revenue);
    const predictions = historical.map((h, idx) => {
      try {
        return model.predict(idx - historical.length + 1, h.calendarMonth).predictedRevenue;
      } catch (e) {
        return h.revenue;
      }
    });
    const evalMetrics = model.evaluate(actuals, predictions);

    // Persist model in forecast_models
    const modelVersion = `TS_V${Date.now()}`;
    const modelSql = `
      INSERT INTO forecast_models (
        model_version, algorithm, training_start_date, training_end_date,
        rmse_error, mape_error, is_active, parameters, created_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, TRUE, $7, NOW()
      ) RETURNING id;
    `;
    const startDate = historical.length > 0 ? `${historical[0].monthStr}-01` : '2026-01-01';
    const endDate = historical.length > 0 ? `${historical[historical.length - 1].monthStr}-28` : '2026-09-20';

    // Deactivate previous models
    await query(`UPDATE forecast_models SET is_active = FALSE WHERE is_active = TRUE;`);

    const modelRes = await query(modelSql, [
      modelVersion,
      'TREND_SEASONALITY',
      startDate,
      endDate,
      evalMetrics.rmse,
      evalMetrics.mape,
      JSON.stringify(model.parameters)
    ]);
    const modelId = modelRes.rows[0].id;

    // Save forecast
    const forecastSql = `
      INSERT INTO revenue_forecasts (
        model_id, forecast_month, predicted_revenue, lower_bound, upper_bound,
        status, created_at
      ) VALUES ($1, $2, $3, $4, $5, 'PENDING_EVALUATION', NOW())
      RETURNING *;
    `;
    const forecastRes = await query(forecastSql, [
      modelId,
      nextMonthStr,
      prediction.predictedRevenue,
      prediction.lowerBound,
      prediction.upperBound
    ]);

    return {
      model: {
        id: modelId,
        version: modelVersion,
        algorithm: 'TREND_SEASONALITY',
        mape: evalMetrics.mape,
        rmse: evalMetrics.rmse
      },
      forecast: forecastRes.rows[0],
      historical
    };
  }

  /**
   * Update actual revenue for previous forecasts and compute errors
   */
  static async evaluatePendingForecasts(historical) {
    const historicalMap = new Map(historical.map(h => [h.monthStr, h.revenue]));
    const pendingRes = await query(
      `SELECT * FROM revenue_forecasts WHERE status = 'PENDING_EVALUATION';`
    );

    for (const f of pendingRes.rows) {
      if (historicalMap.has(f.forecast_month)) {
        const actual = historicalMap.get(f.forecast_month);
        const predicted = parseFloat(f.predicted_revenue);
        const errPercent = actual > 0 ? Math.abs((actual - predicted) / actual) * 100 : 0;

        await query(
          `UPDATE revenue_forecasts 
           SET actual_revenue = $1, evaluation_error = $2, status = 'EVALUATED'
           WHERE id = $3;`,
          [actual, errPercent, f.id]
        );
      }
    }
  }

  /**
   * Get latest forecast and history for Dashboard
   */
  static async getLatestForecast() {
    const latestRes = await query(
      `SELECT rf.*, fm.model_version, fm.algorithm, fm.mape_error, fm.rmse_error
       FROM revenue_forecasts rf
       LEFT JOIN forecast_models fm ON rf.model_id = fm.id
       ORDER BY rf.created_at DESC
       LIMIT 1;`
    );

    const historyRes = await query(
      `SELECT rf.*, fm.model_version
       FROM revenue_forecasts rf
       LEFT JOIN forecast_models fm ON rf.model_id = fm.id
       ORDER BY rf.forecast_month DESC
       LIMIT 12;`
    );

    let latest = latestRes.rows[0] || null;
    if (!latest) {
      // If no model trained yet, run training pipeline now
      const initial = await this.trainAndForecast();
      latest = initial.forecast;
    }

    const historical = await this.getMonthlyRevenues();

    return {
      currentForecast: latest,
      pastForecasts: historyRes.rows,
      historicalRevenues: historical
    };
  }
}

module.exports = ForecastService;
