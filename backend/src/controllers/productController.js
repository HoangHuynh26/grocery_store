const ProductService = require('../services/productService');
const { AppError } = require('../middleware/errorHandler');

class ProductController {
  static async list(req, res, next) {
    try {
      const page = parseInt(req.query.page || '1', 10);
      const limit = parseInt(req.query.limit || '20', 10);
      const search = req.query.search || '';
      const categoryId = req.query.categoryId || null;
      const lowStockOnly = req.query.lowStock === 'true';
      const sortBy = req.query.sortBy || 'name';
      const sortOrder = req.query.sortOrder || 'ASC';

      const products = await ProductService.getProducts({
        search,
        categoryId,
        lowStockOnly,
        onlyActive: req.query.all !== 'true',
        page,
        limit,
        sortBy,
        sortOrder
      });

      return res.status(200).json({
        success: true,
        data: products
      });
    } catch (err) {
      next(err);
    }
  }

  static async getById(req, res, next) {
    try {
      const product = await ProductService.getProductById(req.params.id);
      return res.status(200).json({
        success: true,
        data: product
      });
    } catch (err) {
      next(err);
    }
  }

  static async getByQrToken(req, res, next) {
    try {
      const product = await ProductService.getProductByQrToken(req.params.token);
      return res.status(200).json({
        success: true,
        data: product
      });
    } catch (err) {
      next(err);
    }
  }

  static async create(req, res, next) {
    const clientIp = req.ip || req.headers['x-forwarded-for'];
    const userAgent = req.headers['user-agent'];

    try {
      const {
        productCode,
        name,
        categoryId,
        description,
        imageUrl,
        costPrice,
        sellingPrice,
        stockQuantity,
        minimumStock,
        unit,
        hasQr
      } = req.body;

      if (!productCode || !name || sellingPrice === undefined) {
        throw new AppError('Vui lòng điền mã sản phẩm, tên và giá bán.', 400, 'MISSING_FIELDS');
      }

      const created = await ProductService.createNewProduct({
        productCode,
        name,
        categoryId,
        description,
        imageUrl,
        costPrice,
        sellingPrice,
        stockQuantity,
        minimumStock,
        unit,
        hasQr: hasQr !== false,
        userId: req.user.id,
        clientIp,
        userAgent
      });

      return res.status(201).json({
        success: true,
        data: created,
        message: 'Thêm sản phẩm mới thành công.'
      });
    } catch (err) {
      next(err);
    }
  }

  static async update(req, res, next) {
    const clientIp = req.ip || req.headers['x-forwarded-for'];
    const userAgent = req.headers['user-agent'];

    try {
      const updated = await ProductService.updateExistingProduct(
        req.params.id,
        req.body,
        req.user.id,
        clientIp,
        userAgent
      );

      return res.status(200).json({
        success: true,
        data: updated,
        message: 'Cập nhật thông tin sản phẩm thành công.'
      });
    } catch (err) {
      next(err);
    }
  }

  static async remove(req, res, next) {
    const clientIp = req.ip || req.headers['x-forwarded-for'];
    const userAgent = req.headers['user-agent'];

    try {
      const deleted = await ProductService.deleteProduct(
        req.params.id,
        req.user.id,
        clientIp,
        userAgent
      );

      return res.status(200).json({
        success: true,
        data: deleted,
        message: 'Đã chuyển sản phẩm sang trạng thái ngưng kinh doanh.'
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = ProductController;
