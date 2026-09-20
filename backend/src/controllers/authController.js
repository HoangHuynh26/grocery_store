const { findByUsernameOrEmail, recordLoginLog } = require('../repositories/userRepository');
const { verifyPassword } = require('../utils/password');
const { generateAccessToken, generateRefreshToken, verifyRefreshToken } = require('../utils/jwt');
const { createAuditLog } = require('../repositories/auditRepository');
const { AppError } = require('../middleware/errorHandler');

class AuthController {
  static async login(req, res, next) {
    const { identifier, password } = req.body;
    const clientIp = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'] || '';

    try {
      if (!identifier || !password) {
        throw new AppError('Vui lòng nhập tên đăng nhập/email và mật khẩu.', 400, 'MISSING_CREDENTIALS');
      }

      const user = await findByUsernameOrEmail(identifier);
      if (!user) {
        await recordLoginLog({
          userId: null,
          username: identifier,
          ipAddress: clientIp,
          userAgent,
          status: 'FAILED',
          failureReason: 'Tài khoản không tồn tại'
        });
        throw new AppError('Tài khoản hoặc mật khẩu không chính xác.', 401, 'INVALID_CREDENTIALS');
      }

      if (!user.is_active) {
        await recordLoginLog({
          userId: user.id,
          username: user.username,
          ipAddress: clientIp,
          userAgent,
          status: 'FAILED',
          failureReason: 'Tài khoản đã bị tạm khóa'
        });
        throw new AppError('Tài khoản đã bị tạm khóa. Vui lòng liên hệ Quản trị viên.', 403, 'ACCOUNT_LOCKED');
      }

      const isMatch = await verifyPassword(password, user.password_hash);
      if (!isMatch) {
        await recordLoginLog({
          userId: user.id,
          username: user.username,
          ipAddress: clientIp,
          userAgent,
          status: 'FAILED',
          failureReason: 'Mật khẩu sai'
        });
        throw new AppError('Tài khoản hoặc mật khẩu không chính xác.', 401, 'INVALID_CREDENTIALS');
      }

      // Record successful login
      await recordLoginLog({
        userId: user.id,
        username: user.username,
        ipAddress: clientIp,
        userAgent,
        status: 'SUCCESS',
        failureReason: null
      });

      const tokenPayload = {
        userId: user.id,
        username: user.username,
        role: user.role,
        fullName: user.full_name
      };

      const accessToken = generateAccessToken(tokenPayload);
      const refreshToken = generateRefreshToken(tokenPayload);

      // Audit Log
      await createAuditLog({
        userId: user.id,
        action: 'LOGIN',
        entityType: 'USER',
        entityId: user.id,
        newValues: { username: user.username, role: user.role },
        reason: 'Đăng nhập thành công vào hệ thống POS',
        ipAddress: clientIp,
        userAgent
      });

      // Set cookie for refresh token
      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000
      });

      return res.status(200).json({
        success: true,
        data: {
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            fullName: user.full_name,
            phone: user.phone,
            role: user.role
          },
          accessToken,
          refreshToken
        },
        message: 'Đăng nhập thành công.'
      });
    } catch (err) {
      next(err);
    }
  }

  static async refresh(req, res, next) {
    try {
      const refreshToken = req.body.refreshToken || (req.cookies && req.cookies.refreshToken);
      if (!refreshToken) {
        throw new AppError('Refresh token không tồn tại.', 401, 'NO_REFRESH_TOKEN');
      }

      const decoded = verifyRefreshToken(refreshToken);
      if (!decoded || !decoded.userId) {
        throw new AppError('Refresh token không hợp lệ hoặc đã hết hạn.', 401, 'INVALID_REFRESH_TOKEN');
      }

      const newAccessToken = generateAccessToken({
        userId: decoded.userId,
        username: decoded.username,
        role: decoded.role,
        fullName: decoded.fullName
      });

      return res.status(200).json({
        success: true,
        data: {
          accessToken: newAccessToken
        }
      });
    } catch (err) {
      next(err);
    }
  }

  static async logout(req, res, next) {
    try {
      const clientIp = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'] || '';

      if (req.user) {
        await createAuditLog({
          userId: req.user.id,
          action: 'LOGOUT',
          entityType: 'USER',
          entityId: req.user.id,
          reason: 'Đăng xuất khỏi hệ thống',
          ipAddress: clientIp,
          userAgent
        });
      }

      res.clearCookie('refreshToken');
      return res.status(200).json({
        success: true,
        message: 'Đăng xuất thành công.'
      });
    } catch (err) {
      next(err);
    }
  }

  static async getMe(req, res, next) {
    try {
      return res.status(200).json({
        success: true,
        data: {
          user: req.user
        }
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = AuthController;
