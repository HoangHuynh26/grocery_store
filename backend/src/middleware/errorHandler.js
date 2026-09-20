const config = require('../config/env');

class AppError extends Error {
  constructor(message, statusCode = 400, errorCode = 'BAD_REQUEST') {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
  }
}

function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || (res.statusCode !== 200 ? res.statusCode : 500);
  const errorCode = err.errorCode || (statusCode === 500 ? 'INTERNAL_SERVER_ERROR' : 'BAD_REQUEST');
  
  // Clean, user-friendly message
  let message = err.message || 'Đã có lỗi xảy ra trên hệ thống.';
  if (statusCode === 500 && config.nodeEnv === 'production') {
    message = 'Lỗi hệ thống nội bộ. Vui lòng liên hệ quản trị viên.';
  }

  // Handle postgres specific constraints
  if (err.message && err.message.includes('violates check constraint "products_stock_quantity_check"')) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INSUFFICIENT_STOCK',
        message: 'Số lượng tồn kho không đủ để thực hiện giao dịch.'
      }
    });
  }

  if (err.message && err.message.includes('violates unique constraint')) {
    return res.status(409).json({
      success: false,
      error: {
        code: 'DUPLICATE_RESOURCE',
        message: 'Dữ liệu đã tồn tại trong hệ thống (mã sản phẩm, tên hoặc số hóa đơn trùng lặp).'
      }
    });
  }

  // Log server errors safely without leaking sensitive data
  if (statusCode >= 500) {
    console.error(`[Server Error] [${req.method}] ${req.originalUrl}:`, err.message);
  }

  return res.status(statusCode).json({
    success: false,
    error: {
      code: errorCode,
      message: message
    }
  });
}

module.exports = {
  AppError,
  errorHandler
};
