const rateLimit = require('express-rate-limit');

const loginLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 15, // limit each IP to 15 login requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false },
  message: {
    success: false,
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Bạn đã đăng nhập sai quá nhiều lần. Vui lòng thử lại sau 5 phút.'
    }
  }
});

const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 300, // limit each IP to 300 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false },
  message: {
    success: false,
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Quá nhiều yêu cầu gửi tới máy chủ. Vui lòng thao tác chậm lại.'
    }
  }
});

module.exports = {
  loginLimiter,
  apiLimiter
};
