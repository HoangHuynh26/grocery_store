const QRCode = require('qrcode');
const { 
  listProducts, 
  findById, 
  findByCode, 
  findByQrToken, 
  createProduct, 
  updateProduct, 
  softDeleteProduct 
} = require('../repositories/productRepository');
const { generateQrToken } = require('../utils/idGenerator');
const { createAuditLog } = require('../repositories/auditRepository');
const { AppError } = require('../middleware/errorHandler');

class ProductService {
  static async getProducts(filters) {
    return await listProducts(filters);
  }

  static async getProductById(id) {
    const product = await findById(id);
    if (!product) {
      throw new AppError('Không tìm thấy sản phẩm.', 404, 'PRODUCT_NOT_FOUND');
    }
    // If product has QR, generate data URL for client display/printing
    if (product.has_qr && product.qr_code_token) {
      try {
        product.qr_image_data_url = await QRCode.toDataURL(product.qr_code_token, {
          width: 300,
          margin: 2
        });
      } catch (e) {
        console.warn('QR Code generation failed:', e.message);
      }
    }
    return product;
  }

  static async checkCodeUniqueness(productCode, excludeId = null) {
    if (!productCode || !productCode.trim()) {
      return { available: false, message: 'Mã sản phẩm không được để trống.' };
    }
    const cleanCode = productCode.trim().toUpperCase();
    const existing = await findByCode(cleanCode);
    if (existing && existing.id !== excludeId) {
      return {
        available: false,
        productCode: cleanCode,
        existingProduct: { id: existing.id, name: existing.name },
        message: `Mã sản phẩm "${cleanCode}" đã tồn tại (Sản phẩm: "${existing.name}"). Vui lòng chọn hoặc đổi mã khác.`
      };
    }
    return {
      available: true,
      productCode: cleanCode,
      message: 'Mã sản phẩm hợp lệ, có thể sử dụng.'
    };
  }

  static async getProductByQrToken(token) {
    const product = await findByQrToken(token);
    if (!product) {
      throw new AppError('Mã QR không khớp với sản phẩm nào trong hệ thống.', 404, 'QR_NOT_FOUND');
    }
    return product;
  }

  static async createNewProduct({
    productCode,
    name,
    categoryId,
    description,
    imageUrl,
    costPrice,
    sellingPrice,
    stockQuantity = 0,
    minimumStock = 5,
    unit = 'cái',
    hasQr = true,
    userId,
    clientIp,
    userAgent
  }) {
    // Check for duplicate product code
    const existing = await findByCode(productCode);
    if (existing) {
      throw new AppError(`Mã sản phẩm "${productCode}" đã tồn tại. Vui lòng chọn mã khác.`, 409, 'DUPLICATE_CODE');
    }

    let qrCodeToken = null;
    if (hasQr) {
      qrCodeToken = generateQrToken();
    }

    const created = await createProduct({
      productCode,
      name,
      categoryId,
      description,
      imageUrl,
      costPrice: parseFloat(costPrice || 0),
      sellingPrice: parseFloat(sellingPrice || 0),
      stockQuantity: parseInt(stockQuantity || 0, 10),
      minimumStock: parseInt(minimumStock || 5, 10),
      unit,
      qrCodeToken,
      hasQr,
      userId
    });

    await createAuditLog({
      userId,
      action: 'CREATE_PRODUCT',
      entityType: 'PRODUCT',
      entityId: created.id,
      newValues: {
        productCode: created.product_code,
        name: created.name,
        costPrice: created.cost_price,
        sellingPrice: created.selling_price,
        stockQuantity: created.stock_quantity,
        hasQr: created.has_qr
      },
      reason: 'Thêm mới sản phẩm',
      ipAddress: clientIp,
      userAgent
    });

    return created;
  }

  static async updateExistingProduct(id, updateFields, userId, clientIp, userAgent) {
    const existing = await findById(id);
    if (!existing) {
      throw new AppError('Không tìm thấy sản phẩm.', 404, 'PRODUCT_NOT_FOUND');
    }

    // If changing product_code, check for duplicate
    if (updateFields.product_code && updateFields.product_code !== existing.product_code) {
      const dup = await findByCode(updateFields.product_code);
      if (dup && dup.id !== id) {
        throw new AppError(`Mã sản phẩm "${updateFields.product_code}" đã tồn tại.`, 409, 'DUPLICATE_CODE');
      }
    }

    // If enabling QR and previously didn't have one
    if (updateFields.has_qr && !existing.qr_code_token) {
      updateFields.qr_code_token = generateQrToken();
    }

    const updated = await updateProduct(id, updateFields, userId);

    await createAuditLog({
      userId,
      action: 'UPDATE_PRODUCT',
      entityType: 'PRODUCT',
      entityId: id,
      oldValues: {
        productCode: existing.product_code,
        name: existing.name,
        costPrice: existing.cost_price,
        sellingPrice: existing.selling_price,
        minimumStock: existing.minimum_stock
      },
      newValues: updateFields,
      reason: 'Cập nhật thông tin sản phẩm',
      ipAddress: clientIp,
      userAgent
    });

    return updated;
  }

  static async deleteProduct(id, userId, clientIp, userAgent) {
    const existing = await findById(id);
    if (!existing) {
      throw new AppError('Không tìm thấy sản phẩm.', 404, 'PRODUCT_NOT_FOUND');
    }

    const deleted = await softDeleteProduct(id, userId);

    await createAuditLog({
      userId,
      action: 'DELETE_PRODUCT',
      entityType: 'PRODUCT',
      entityId: id,
      oldValues: {
        productCode: existing.product_code,
        name: existing.name,
        stockQuantity: existing.stock_quantity
      },
      newValues: { is_active: false },
      reason: 'Xóa mềm sản phẩm (chuyển sang ngưng kinh doanh)',
      ipAddress: clientIp,
      userAgent
    });

    return deleted;
  }
}

module.exports = ProductService;
