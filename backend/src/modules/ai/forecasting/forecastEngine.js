// Statistical Machine Learning & Time Series Forecasting Engine
// Interface: BaseForecastModel

class BaseForecastModel {
  constructor(name = 'BaseModel') {
    this.name = name;
    this.parameters = {};
    this.isTrained = false;
  }

  train(series) {
    throw new Error('train method must be implemented');
  }

  predict(stepsAhead = 1) {
    throw new Error('predict method must be implemented');
  }

  evaluate(actuals, predictions) {
    let sumSquaredError = 0;
    let sumAbsPercentageError = 0;
    let validPoints = 0;

    for (let i = 0; i < actuals.length; i++) {
      const act = actuals[i];
      const pred = predictions[i];
      if (act > 0 && pred !== undefined) {
        const err = act - pred;
        sumSquaredError += err * err;
        sumAbsPercentageError += Math.abs(err / act);
        validPoints++;
      }
    }

    const rmse = validPoints > 0 ? Math.sqrt(sumSquaredError / validPoints) : 0;
    const mape = validPoints > 0 ? (sumAbsPercentageError / validPoints) * 100 : 0;
    return { rmse, mape };
  }
}

/**
 * Holt-Winters / Trend & Seasonality Decomposition Model
 * Models revenue = (Level + Trend * t) * Seasonal_Index + Noise
 */
class TrendSeasonalityForecastModel extends BaseForecastModel {
  constructor() {
    super('TrendSeasonality_v1');
  }

  train(monthlyData) {
    // monthlyData: array of { monthIndex, revenue }
    if (!monthlyData || monthlyData.length < 3) {
      // Fallback baseline for small sample size
      const revenues = (monthlyData || []).map(d => d.revenue);
      const avg = revenues.length > 0 ? revenues.reduce((a, b) => a + b, 0) / revenues.length : 0;
      this.parameters = {
        intercept: avg,
        slope: 0,
        seasonalIndices: Array(12).fill(1.0),
        stdDev: avg * 0.1,
        sampleSize: revenues.length
      };
      this.isTrained = true;
      return;
    }

    const n = monthlyData.length;
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumXX = 0;

    for (let i = 0; i < n; i++) {
      const x = i + 1;
      const y = monthlyData[i].revenue;
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumXX += x * x;
    }

    // Linear Regression parameters
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX || 1);
    const intercept = (sumY - slope * sumX) / n;

    // Monthly seasonality calculation
    const seasonalBuckets = Array(12).fill(0).map(() => []);
    const residuals = [];

    for (let i = 0; i < n; i++) {
      const monthCal = monthlyData[i].calendarMonth; // 0 - 11
      const trendVal = intercept + slope * (i + 1);
      const actualVal = monthlyData[i].revenue;
      const ratio = trendVal > 0 ? actualVal / trendVal : 1.0;

      seasonalBuckets[monthCal].push(ratio);
      residuals.push(actualVal - trendVal);
    }

    // Average seasonal index per month, normalized to average 1.0
    let rawIndices = seasonalBuckets.map(b => b.length > 0 ? b.reduce((a, b) => a + b, 0) / b.length : 1.0);
    const avgIndex = rawIndices.reduce((a, b) => a + b, 0) / 12 || 1.0;
    const normalizedIndices = rawIndices.map(idx => idx / avgIndex);

    // Standard deviation of residuals for confidence intervals
    const variance = residuals.reduce((acc, r) => acc + r * r, 0) / (n || 1);
    const stdDev = Math.sqrt(variance);

    this.parameters = {
      slope,
      intercept,
      seasonalIndices: normalizedIndices,
      stdDev,
      sampleSize: n,
      lastStep: n
    };
    this.isTrained = true;
  }

  predict(stepsAhead = 1, targetCalendarMonth) {
    if (!this.isTrained) {
      throw new Error('Model is not trained yet.');
    }

    const futureStep = this.parameters.lastStep + stepsAhead;
    const baseTrend = Math.max(0, this.parameters.intercept + this.parameters.slope * futureStep);
    const seasonalFactor = this.parameters.seasonalIndices[targetCalendarMonth] || 1.0;
    const predictedRevenue = Math.round(baseTrend * seasonalFactor);

    // 95% Confidence Interval (~ 1.96 * standard error)
    const margin = Math.round(1.96 * this.parameters.stdDev * Math.sqrt(1 + stepsAhead * 0.1));
    const lowerBound = Math.max(0, predictedRevenue - margin);
    const upperBound = predictedRevenue + margin;

    return {
      predictedRevenue,
      lowerBound,
      upperBound,
      confidenceScore: Math.min(95, Math.max(70, Math.round(100 - (margin / (predictedRevenue || 1)) * 50)))
    };
  }
}

module.exports = {
  BaseForecastModel,
  TrendSeasonalityForecastModel
};
