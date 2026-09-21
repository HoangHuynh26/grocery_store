const InvoiceService = require('../services/invoiceService');
const { AppError } = require('../middleware/errorHandler');

class InvoiceController {
  static async list(req, res, next) {
    try {
      const page = parseInt(req.query.page || '1', 10);
      const limit = parseInt(req.query.limit || '20', 10);
      const search = req.query.search || '';
      const startDate = req.query.startDate || null;
      const endDate = req.query.endDate || null;
      const startTime = req.query.startTime || null;
      const endTime = req.query.endTime || null;
      const userId = req.query.userId || null;
      const paymentMethod = req.query.paymentMethod || null;
      const status = req.query.status || null;

      const invoices = await InvoiceService.getInvoicesList({
        search,
        startDate,
        endDate,
        startTime,
        endTime,
        userId,
        paymentMethod,
        status,
        page,
        limit
      });

      return res.status(200).json({
        success: true,
        data: invoices
      });
    } catch (err) {
      next(err);
    }
  }

  static async getById(req, res, next) {
    try {
      const invoice = await InvoiceService.getInvoiceDetails(req.params.id);
      return res.status(200).json({
        success: true,
        data: invoice
      });
    } catch (err) {
      next(err);
    }
  }

  static async adjust(req, res, next) {
    const clientIp = req.ip || req.headers['x-forwarded-for'];
    const userAgent = req.headers['user-agent'];

    try {
      const { itemAdjustments, reason } = req.body;
      if (!itemAdjustments || !Array.isArray(itemAdjustments) || itemAdjustments.length === 0) {
        throw new AppError('Danh sách điều chỉnh không hợp lệ.', 400, 'INVALID_ADJUSTMENT');
      }

      const updated = await InvoiceService.adjustInvoice({
        invoiceId: req.params.id,
        itemAdjustments,
        reason,
        userId: req.user.id,
        clientIp,
        userAgent
      });

      return res.status(200).json({
        success: true,
        data: updated,
        message: 'Điều chỉnh hóa đơn thành công và đã ghi vết kiểm toán (Audit Log).'
      });
    } catch (err) {
      next(err);
    }
  }

  static async updatePayment(req, res, next) {
    const clientIp = req.ip || req.headers['x-forwarded-for'];
    const userAgent = req.headers['user-agent'];

    try {
      const { paymentMethod, amountPaid, transactionReference, reason } = req.body;

      if (!paymentMethod) {
        throw new AppError('Hình thức thanh toán không được để trống.', 400, 'PAYMENT_METHOD_REQUIRED');
      }

      const updated = await InvoiceService.updateInvoicePayment({
        invoiceId: req.params.id,
        paymentMethod,
        amountPaid,
        transactionReference,
        reason,
        userId: req.user.id,
        clientIp,
        userAgent
      });

      return res.status(200).json({
        success: true,
        data: updated,
        message: 'Cập nhật hình thức thanh toán và số tiền khách đưa thành công.'
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = InvoiceController;
