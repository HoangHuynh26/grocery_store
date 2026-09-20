const { 
  listCategories, 
  findById, 
  findByNameOrSlug, 
  createCategory, 
  updateCategory, 
  countProductsInCategory 
} = require('../repositories/categoryRepository');
const { createAuditLog } = require('../repositories/auditRepository');
const { AppError } = require('../middleware/errorHandler');

class CategoryController {
  static async list(req, res, next) {
    try {
      const onlyActive = req.query.all !== 'true';
      const categories = await listCategories(onlyActive);
      return res.status(200).json({
        success: true,
        data: categories
      });
    } catch (err) {
      next(err);
    }
  }

  static async create(req, res, next) {
    const { name, slug, description } = req.body;
    const clientIp = req.ip || req.headers['x-forwarded-for'];
    const userAgent = req.headers['user-agent'];

    try {
      if (!name) {
        throw new AppError('Tên danh mục là bắt buộc.', 400, 'MISSING_NAME');
      }

      const generatedSlug = slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      const existing = await findByNameOrSlug(name, generatedSlug);
      if (existing) {
        throw new AppError('Tên danh mục hoặc slug đã tồn tại.', 409, 'DUPLICATE_CATEGORY');
      }

      const created = await createCategory({ name, slug: generatedSlug, description });

      await createAuditLog({
        userId: req.user.id,
        action: 'CREATE_CATEGORY',
        entityType: 'CATEGORY',
        entityId: created.id,
        newValues: { name: created.name, slug: created.slug },
        reason: 'Thêm mới danh mục hàng',
        ipAddress: clientIp,
        userAgent
      });

      return res.status(201).json({
        success: true,
        data: created,
        message: 'Thêm danh mục thành công.'
      });
    } catch (err) {
      next(err);
    }
  }

  static async update(req, res, next) {
    const { id } = req.params;
    const { name, slug, description, isActive } = req.body;
    const clientIp = req.ip || req.headers['x-forwarded-for'];
    const userAgent = req.headers['user-agent'];

    try {
      const existing = await findById(id);
      if (!existing) {
        throw new AppError('Không tìm thấy danh mục.', 404, 'CATEGORY_NOT_FOUND');
      }

      const updated = await updateCategory(id, { name, slug, description, isActive });

      await createAuditLog({
        userId: req.user.id,
        action: 'UPDATE_CATEGORY',
        entityType: 'CATEGORY',
        entityId: id,
        oldValues: { name: existing.name, isActive: existing.is_active },
        newValues: { name: updated.name, isActive: updated.is_active },
        reason: 'Cập nhật thông tin danh mục',
        ipAddress: clientIp,
        userAgent
      });

      return res.status(200).json({
        success: true,
        data: updated,
        message: 'Cập nhật danh mục thành công.'
      });
    } catch (err) {
      next(err);
    }
  }

  static async remove(req, res, next) {
    const { id } = req.params;
    const clientIp = req.ip || req.headers['x-forwarded-for'];
    const userAgent = req.headers['user-agent'];

    try {
      const existing = await findById(id);
      if (!existing) {
        throw new AppError('Không tìm thấy danh mục.', 404, 'CATEGORY_NOT_FOUND');
      }

      const activeProductCount = await countProductsInCategory(id);
      if (activeProductCount > 0) {
        throw new AppError(
          `Không thể xóa danh mục này vì đang có ${activeProductCount} sản phẩm thuộc danh mục. Vui lòng chuyển các sản phẩm sang danh mục khác trước.`,
          400,
          'CATEGORY_IN_USE'
        );
      }

      // Soft disable category
      const updated = await updateCategory(id, { isActive: false });

      await createAuditLog({
        userId: req.user.id,
        action: 'DISABLE_CATEGORY',
        entityType: 'CATEGORY',
        entityId: id,
        oldValues: { isActive: true },
        newValues: { isActive: false },
        reason: 'Vô hiệu hóa danh mục không còn sử dụng',
        ipAddress: clientIp,
        userAgent
      });

      return res.status(200).json({
        success: true,
        data: updated,
        message: 'Đã tạm ngưng sử dụng danh mục.'
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = CategoryController;
