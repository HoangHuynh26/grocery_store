const PosService = require('../services/posService');
const { AppError } = require('../middleware/errorHandler');

class PosController {
  static async validateStock(req, res, next) {
    try {
      const { items } = req.body;
      const result = await PosService.validateCartStock(items);
      return res.status(200).json({
        success: true,
        data: result
      });
    } catch (err) {
      next(err);
    }
  }

  static async checkout(req, res, next) {
    const clientIp = req.ip || req.headers['x-forwarded-for'];
    const userAgent = req.headers['user-agent'];
    const idempotencyKey = req.headers['idempotency-key'] || req.body.idempotencyKey;

    try {
      const { items, paymentMethod, amountPaid, notes } = req.body;

      if (!items || !Array.isArray(items) || items.length === 0) {
        throw new AppError('Giỏ hàng trống.', 400, 'EMPTY_CART');
      }

      const result = await PosService.checkout({
        userId: req.user.id,
        items,
        paymentMethod: paymentMethod || 'CASH',
        amountPaid,
        notes,
        idempotencyKey,
        clientIp,
        userAgent
      });

      return res.status(200).json({
        success: true,
        data: result.invoice,
        isDuplicate: result.isDuplicate,
        message: result.message
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = PosController;
