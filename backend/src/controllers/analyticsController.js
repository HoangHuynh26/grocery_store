const AnalyticsService = require('../services/analyticsService');

class AnalyticsController {
  static async getSummary(req, res, next) {
    try {
      const summary = await AnalyticsService.getDashboardSummary();
      return res.status(200).json({
        success: true,
        data: summary
      });
    } catch (err) {
      next(err);
    }
  }

  static async getChart(req, res, next) {
    try {
      const period = req.query.period || '7days';
      const startDate = req.query.startDate || null;
      const endDate = req.query.endDate || null;

      const chartData = await AnalyticsService.getChartData(period, startDate, endDate);
      return res.status(200).json({
        success: true,
        data: chartData
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = AnalyticsController;
