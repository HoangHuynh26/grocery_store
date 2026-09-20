const { listUsers, createUser, updateUser, findById, findByUsernameOrEmail, getLoginLogs } = require('../repositories/userRepository');
const { hashPassword } = require('../utils/password');
const { createAuditLog } = require('../repositories/auditRepository');
const { AppError } = require('../middleware/errorHandler');

class UserController {
  static async list(req, res, next) {
    try {
      const page = parseInt(req.query.page || '1', 10);
      const limit = parseInt(req.query.limit || '20', 10);
      const search = req.query.search || '';

      const users = await listUsers({ page, limit, search });
      return res.status(200).json({
        success: true,
        data: users
      });
    } catch (err) {
      next(err);
    }
  }

  static async create(req, res, next) {
    const { username, email, password, fullName, phone, role } = req.body;
    const clientIp = req.ip || req.headers['x-forwarded-for'];
    const userAgent = req.headers['user-agent'];

    try {
      if (!username || !email || !password || !fullName) {
        throw new AppError('Vui lòng điền đầy đủ thông tin tài khoản bắt buộc.', 400, 'MISSING_FIELDS');
      }

      const existing = await findByUsernameOrEmail(username);
      if (existing) {
        throw new AppError('Tên đăng nhập hoặc email đã được sử dụng.', 409, 'DUPLICATE_USER');
      }

      const passwordHash = await hashPassword(password);
      const created = await createUser({
        username,
        email,
        passwordHash,
        fullName,
        phone: phone || '',
        role: role || 'ADMIN'
      });

      await createAuditLog({
        userId: req.user.id,
        action: 'CREATE_USER',
        entityType: 'USER',
        entityId: created.id,
        newValues: { username: created.username, role: created.role, fullName: created.full_name },
        reason: 'Super Admin tạo tài khoản quản trị mới',
        ipAddress: clientIp,
        userAgent
      });

      return res.status(201).json({
        success: true,
        data: created,
        message: 'Tạo tài khoản quản trị thành công.'
      });
    } catch (err) {
      next(err);
    }
  }

  static async update(req, res, next) {
    const { id } = req.params;
    const { fullName, phone, role, isActive, password } = req.body;
    const clientIp = req.ip || req.headers['x-forwarded-for'];
    const userAgent = req.headers['user-agent'];

    try {
      const existing = await findById(id);
      if (!existing) {
        throw new AppError('Không tìm thấy người dùng.', 404, 'USER_NOT_FOUND');
      }

      const updateFields = { fullName, phone, role, isActive };
      if (password && password.trim().length >= 6) {
        updateFields.passwordHash = await hashPassword(password);
      }

      const updated = await updateUser(id, updateFields);

      await createAuditLog({
        userId: req.user.id,
        action: 'UPDATE_USER',
        entityType: 'USER',
        entityId: id,
        oldValues: { role: existing.role, isActive: existing.is_active, fullName: existing.full_name },
        newValues: { role: updated.role, isActive: updated.is_active, fullName: updated.full_name },
        reason: 'Super Admin cập nhật tài khoản',
        ipAddress: clientIp,
        userAgent
      });

      return res.status(200).json({
        success: true,
        data: updated,
        message: 'Cập nhật tài khoản thành công.'
      });
    } catch (err) {
      next(err);
    }
  }

  static async getLoginHistory(req, res, next) {
    try {
      const logs = await getLoginLogs({ limit: 50 });
      return res.status(200).json({
        success: true,
        data: logs
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = UserController;
