const InventoryService = require('../services/inventoryService');
const { AppError } = require('../middleware/errorHandler');

class InventoryController {
  static async getStatus(req, res, next) {
    try {
      const page = parseInt(req.query.page || '1', 10);
      const limit = parseInt(req.query.limit || '20', 10);
      const search = req.query.search || '';
      const lowStockOnly = req.query.lowStock === 'true';

      const status = await InventoryService.getInventoryStatus({
        search,
        lowStockOnly,
        page,
        limit
      });

      return res.status(200).json({
        success: true,
        data: status
      });
    } catch (err) {
      next(err);
    }
  }

  static async importGoods(req, res, next) {
    const clientIp = req.ip || req.headers['x-forwarded-for'];
    const userAgent = req.headers['user-agent'];

    try {
      const { productId, quantity, costPrice, referenceId, reason } = req.body;
      if (!productId || !quantity) {
        throw new AppError('Vui lòng cung cấp ID sản phẩm và số lượng nhập.', 400, 'MISSING_FIELDS');
      }

      const result = await InventoryService.importStock({
        productId,
        quantity,
        costPrice,
        referenceId,
        reason,
        userId: req.user.id,
        clientIp,
        userAgent
      });

      return res.status(200).json({
        success: true,
        data: result,
        message: 'Nhập kho thành công.'
      });
    } catch (err) {
      next(err);
    }
  }

  static async adjust(req, res, next) {
    const clientIp = req.ip || req.headers['x-forwarded-for'];
    const userAgent = req.headers['user-agent'];

    try {
      const { productId, newQuantity, type, reason } = req.body;
      if (!productId || newQuantity === undefined || !reason) {
        throw new AppError('Vui lòng nhập ID sản phẩm, số lượng mới và lý do điều chỉnh.', 400, 'MISSING_FIELDS');
      }

      const result = await InventoryService.adjustStock({
        productId,
        newQuantity,
        type: type || 'ADJUSTMENT',
        reason,
        userId: req.user.id,
        clientIp,
        userAgent
      });

      return res.status(200).json({
        success: true,
        data: result,
        message: 'Điều chỉnh số lượng tồn kho thành công.'
      });
    } catch (err) {
      next(err);
    }
  }

  static async getHistory(req, res, next) {
    try {
      const page = parseInt(req.query.page || '1', 10);
      const limit = parseInt(req.query.limit || '20', 10);
      const productId = req.query.productId || null;
      const transactionType = req.query.type || null;
      const startDate = req.query.startDate || null;
      const endDate = req.query.endDate || null;

      const history = await InventoryService.getInventoryHistory({
        productId,
        transactionType,
        startDate,
        endDate,
        page,
        limit
      });

      return res.status(200).json({
        success: true,
        data: history
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = InventoryController;
