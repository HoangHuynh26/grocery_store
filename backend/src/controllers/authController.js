const { findByUsernameOrEmail, recordLoginLog } = require('../repositories/userRepository');
const { verifyPassword } = require('../utils/password');
const { generateAccessToken, generateRefreshToken, verifyRefreshToken } = require('../utils/jwt');
const { createAuditLog } = require('../repositories/auditRepository');
const { AppError } = require('../middleware/errorHandler');
const { extractClientIp, lookupIpLocation } = require('../utils/ipGeo');

class AuthController {
  static async login(req, res, next) {
    const { identifier, password } = req.body;
    const clientIp = extractClientIp(req);
    const userAgent = req.headers['user-agent'] || '';

    try {
      if (!identifier || !password) {
        throw new AppError('Vui lòng nhập tên đăng nhập/email và mật khẩu.', 400, 'MISSING_CREDENTIALS');
      }

      // Lookup IP location (asynchronous with cache & failover)
      const geoInfo = await lookupIpLocation(clientIp);

      const user = await findByUsernameOrEmail(identifier);
      if (!user) {
        await recordLoginLog({
          userId: null,
          username: identifier,
          ipAddress: clientIp,
          userAgent,
          status: 'FAILED',
          failureReason: 'Tài khoản không tồn tại',
          locationRegion: geoInfo.region,
          locationCity: geoInfo.city,
          locationCountry: geoInfo.country,
          locationDetails: geoInfo.details
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
          failureReason: 'Tài khoản đã bị tạm khóa',
          locationRegion: geoInfo.region,
          locationCity: geoInfo.city,
          locationCountry: geoInfo.country,
          locationDetails: geoInfo.details
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
          failureReason: 'Mật khẩu sai',
          locationRegion: geoInfo.region,
          locationCity: geoInfo.city,
          locationCountry: geoInfo.country,
          locationDetails: geoInfo.details
        });
        throw new AppError('Tài khoản hoặc mật khẩu không chính xác.', 401, 'INVALID_CREDENTIALS');
      }

      // Record successful login with geolocation
      await recordLoginLog({
        userId: user.id,
        username: user.username,
        ipAddress: clientIp,
        userAgent,
        status: 'SUCCESS',
        failureReason: null,
        locationRegion: geoInfo.region,
        locationCity: geoInfo.city,
        locationCountry: geoInfo.country,
        locationDetails: geoInfo.details
      });

      const tokenPayload = {
        userId: user.id,
        username: user.username,
        role: user.role,
        fullName: user.full_name
      };

      const accessToken = generateAccessToken(tokenPayload);
      const refreshToken = generateRefreshToken(tokenPayload);

      // Audit Log with location context
      await createAuditLog({
        userId: user.id,
        action: 'LOGIN',
        entityType: 'USER',
        entityId: user.id,
        newValues: {
          username: user.username,
          role: user.role,
          location: geoInfo.locationText,
          isLocal: geoInfo.isLocal
        },
        reason: `Đăng nhập thành công từ [${clientIp}] - ${geoInfo.locationText}`,
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
          refreshToken,
          clientLocation: {
            ip: clientIp,
            region: geoInfo.region,
            city: geoInfo.city,
            country: geoInfo.country,
            locationText: geoInfo.locationText,
            flag: geoInfo.flag,
            isLocal: geoInfo.isLocal
          }
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
      const clientIp = extractClientIp(req);
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
