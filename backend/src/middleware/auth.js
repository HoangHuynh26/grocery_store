const { verifyAccessToken } = require('../utils/jwt');
const { query } = require('../database');
const { AppError } = require('./errorHandler');

async function authenticateToken(req, res, next) {
  try {
    let token = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.cookies && req.cookies.accessToken) {
      token = req.cookies.accessToken;
    }

    if (!token) {
      throw new AppError('Yêu cầu xác thực tài khoản để truy cập.', 401, 'UNAUTHORIZED');
    }

    const decoded = verifyAccessToken(token);
    if (!decoded || !decoded.userId) {
      throw new AppError('Phiên đăng nhập đã hết hạn hoặc không hợp lệ.', 401, 'TOKEN_EXPIRED');
    }

    // Verify user in database to ensure active status and actual role
    const userRes = await query(
      'SELECT id, username, email, full_name, role, is_active FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (userRes.rowCount === 0) {
      throw new AppError('Người dùng không tồn tại.', 401, 'USER_NOT_FOUND');
    }

    const user = userRes.rows[0];
    if (!user.is_active) {
      throw new AppError('Tài khoản này đã bị tạm khóa. Vui lòng liên hệ quản lý.', 403, 'ACCOUNT_DISABLED');
    }

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

function requireRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('Chưa xác thực người dùng.', 401, 'UNAUTHORIZED'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new AppError('Bạn không có quyền thực hiện thao tác này.', 403, 'FORBIDDEN')
      );
    }
    next();
  };
}

const requireSuperAdmin = requireRoles('SUPER_ADMIN');
const requireAdmin = requireRoles('SUPER_ADMIN', 'ADMIN');

module.exports = {
  authenticateToken,
  requireRoles,
  requireSuperAdmin,
  requireAdmin
};
