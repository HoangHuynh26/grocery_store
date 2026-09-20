const { getClient, query } = require('../database');
const { getInventoryList, createTransaction, listTransactions } = require('../repositories/inventoryRepository');
const { createAuditLog } = require('../repositories/auditRepository');
const { broadcastStockUpdate, broadcastLowStockAlert } = require('./socketService');
const ProductClassifier = require('../modules/ai/classifier/productClassifier');
const { generateProductCode } = require('../utils/text');
const { AppError } = require('../middleware/errorHandler');

class InventoryService {
  static async getInventoryStatus(filters) {
    return await getInventoryList(filters);
  }

  static async getInventoryHistory(filters) {
    return await listTransactions(filters);
  }

  /**
   * Import goods into stock
   */
  static async importStock({
    productId,
    quantity,
    costPrice,
    referenceId = null,
    reason = 'Nhập hàng mới vào kho',
    userId,
    clientIp,
    userAgent
  }) {
    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty <= 0) {
      throw new AppError('Số lượng nhập hàng phải lớn hơn 0.', 400, 'INVALID_QUANTITY');
    }

    const client = await getClient();
    try {
      await client.query('BEGIN;');

      // Lock product row
      const prodRes = await client.query(
        `SELECT id, product_code, name, stock_quantity, minimum_stock, cost_price, unit, is_active
         FROM products WHERE id = $1 FOR UPDATE;`,
        [productId]
      );

      if (prodRes.rowCount === 0) {
        throw new AppError('Không tìm thấy sản phẩm.', 404, 'PRODUCT_NOT_FOUND');
      }

      const product = prodRes.rows[0];
      const currentStock = parseInt(product.stock_quantity, 10);
      const newStock = currentStock + qty;
      const unitCost = costPrice !== undefined ? parseFloat(costPrice) : parseFloat(product.cost_price);

      // Update product stock and optionally cost_price
      await client.query(
        `UPDATE products SET stock_quantity = $1, cost_price = $2, updated_at = NOW(), updated_by = $3 WHERE id = $4;`,
        [newStock, unitCost, userId, productId]
      );

      // Record inventory transaction
      const tx = await createTransaction({
        productId,
        transactionType: 'IMPORT',
        quantityBefore: currentStock,
        quantityChange: qty,
        quantityAfter: newStock,
        unitCost,
        userId,
        referenceId,
        reason,
        dbClient: client
      });

      // Write Audit Log
      await createAuditLog({
        userId,
        action: 'IMPORT_STOCK',
        entityType: 'INVENTORY',
        entityId: productId,
        oldValues: { stockQuantity: currentStock, costPrice: product.cost_price },
        newValues: { stockQuantity: newStock, importedQty: qty, costPrice: unitCost },
        reason,
        ipAddress: clientIp,
        userAgent,
        dbClient: client
      });

      await client.query('COMMIT;');

      broadcastStockUpdate([{
        productId: product.id,
        productCode: product.product_code,
        name: product.name,
        currentStock: newStock,
        minimumStock: product.minimum_stock,
        isLowStock: newStock <= product.minimum_stock
      }]);

      return {
        product: {
          id: product.id,
          name: product.name,
          previousStock: currentStock,
          newStock,
          unit: product.unit
        },
        transaction: tx
      };
    } catch (err) {
      await client.query('ROLLBACK;');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Adjust stock manually (Stock count discrepancy, damage, return)
   */
  static async adjustStock({
    productId,
    newQuantity,
    type = 'ADJUSTMENT',
    reason,
    userId,
    clientIp,
    userAgent
  }) {
    const targetQty = parseInt(newQuantity, 10);
    if (isNaN(targetQty) || targetQty < 0) {
      throw new AppError('Số lượng tồn kho sau điều chỉnh không được nhỏ hơn 0.', 400, 'INVALID_QUANTITY');
    }

    if (!reason || reason.trim().length < 5) {
      throw new AppError('Bắt buộc phải ghi rõ lý do khi điều chỉnh tồn kho.', 400, 'REASON_REQUIRED');
    }

    const client = await getClient();
    try {
      await client.query('BEGIN;');

      const prodRes = await client.query(
        `SELECT id, product_code, name, stock_quantity, minimum_stock, cost_price, unit, is_active
         FROM products WHERE id = $1 FOR UPDATE;`,
        [productId]
      );

      if (prodRes.rowCount === 0) {
        throw new AppError('Không tìm thấy sản phẩm.', 404, 'PRODUCT_NOT_FOUND');
      }

      const product = prodRes.rows[0];
      const currentStock = parseInt(product.stock_quantity, 10);
      const diff = targetQty - currentStock;

      if (diff === 0) {
        throw new AppError('Số lượng mới trùng với số lượng hiện tại.', 400, 'NO_CHANGE');
      }

      // Update product stock
      await client.query(
        `UPDATE products SET stock_quantity = $1, updated_at = NOW(), updated_by = $2 WHERE id = $3;`,
        [targetQty, userId, productId]
      );

      // Record transaction
      const tx = await createTransaction({
        productId,
        transactionType: type,
        quantityBefore: currentStock,
        quantityChange: diff,
        quantityAfter: targetQty,
        unitCost: product.cost_price,
        userId,
        reason,
        dbClient: client
      });

      // Write Audit Log
      await createAuditLog({
        userId,
        action: 'ADJUST_STOCK',
        entityType: 'INVENTORY',
        entityId: productId,
        oldValues: { stockQuantity: currentStock },
        newValues: { stockQuantity: targetQty, change: diff, type },
        reason,
        ipAddress: clientIp,
        userAgent,
        dbClient: client
      });

      await client.query('COMMIT;');

      const updateInfo = {
        productId: product.id,
        productCode: product.product_code,
        name: product.name,
        currentStock: targetQty,
        minimumStock: product.minimum_stock,
        isLowStock: targetQty <= product.minimum_stock
      };
      broadcastStockUpdate([updateInfo]);
      if (updateInfo.isLowStock) {
        broadcastLowStockAlert(updateInfo);
      }

      return {
        product: updateInfo,
        transaction: tx
      };
    } catch (err) {
      await client.query('ROLLBACK;');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Import a new product directly into inventory with automatic AI classification and SKU code generation.
   */
  static async importNewProduct({
    name,
    productCode,
    categoryId,
    description = '',
    imageUrl = null,
    costPrice = 0,
    sellingPrice = 0,
    quantity,
    minimumStock = 5,
    unit,
    referenceId = null,
    reason = 'Nhập mặt hàng mới vào kho qua AI',
    autoClassify = true,
    userId,
    clientIp,
    userAgent
  }) {
    const rawName = (name || '').trim();
    if (!rawName) {
      throw new AppError('Tên sản phẩm không được để trống.', 400, 'MISSING_NAME');
    }

    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty <= 0) {
      throw new AppError('Số lượng nhập hàng phải lớn hơn 0.', 400, 'INVALID_QUANTITY');
    }

    const cPrice = costPrice !== undefined && costPrice !== '' ? parseFloat(costPrice) : 0;
    const sPrice = sellingPrice !== undefined && sellingPrice !== '' ? parseFloat(sellingPrice) : Math.round(cPrice * 1.25);
    const minStock = minimumStock !== undefined && minimumStock !== '' ? parseInt(minimumStock, 10) : 5;

    // AI Classification if category is not provided or autoClassify is requested
    let classification = null;
    let finalCategoryId = categoryId;
    let finalUnit = unit || 'cái';

    if (!finalCategoryId || autoClassify) {
      classification = await ProductClassifier.classify(rawName, description);
      if (!finalCategoryId && classification.categoryId) {
        finalCategoryId = classification.categoryId;
      }
      if ((!unit || unit === 'cái') && classification.suggestedUnit) {
        finalUnit = classification.suggestedUnit;
      }
    }

    if (!finalCategoryId) {
      const firstCatRes = await query('SELECT id FROM categories WHERE is_active = TRUE ORDER BY name ASC LIMIT 1;');
      if (firstCatRes.rowCount > 0) {
        finalCategoryId = firstCatRes.rows[0].id;
      } else {
        throw new AppError('Không tìm thấy danh mục hợp lệ trong hệ thống.', 400, 'CATEGORY_NOT_FOUND');
      }
    }

    // Determine unique productCode
    let finalCode = (productCode || '').trim().toUpperCase();
    if (!finalCode) {
      finalCode = generateProductCode(rawName);
    }

    // Ensure uniqueness of product code
    let codeCandidate = finalCode;
    let suffix = 1;
    while (true) {
      const existing = await query('SELECT id FROM products WHERE LOWER(product_code) = LOWER($1);', [codeCandidate]);
      if (existing.rowCount === 0) {
        finalCode = codeCandidate;
        break;
      }
      codeCandidate = `${finalCode}-${String(suffix).padStart(2, '0')}`;
      suffix++;
    }

    const client = await getClient();
    try {
      await client.query('BEGIN;');

      // Insert new product
      const insertSql = `
        INSERT INTO products (
          product_code, name, category_id, description, image_url,
          cost_price, selling_price, stock_quantity, minimum_stock, unit,
          has_qr, is_active, created_by, updated_by, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9, $10,
          TRUE, TRUE, $11, $11, NOW(), NOW()
        ) RETURNING *;
      `;
      const prodRes = await client.query(insertSql, [
        finalCode,
        rawName,
        finalCategoryId,
        description,
        imageUrl,
        cPrice,
        sPrice,
        qty,
        minStock,
        finalUnit,
        userId
      ]);

      const product = prodRes.rows[0];

      // Record transaction
      const tx = await createTransaction({
        productId: product.id,
        transactionType: 'IMPORT',
        quantityBefore: 0,
        quantityChange: qty,
        quantityAfter: qty,
        unitCost: cPrice,
        userId,
        referenceId,
        reason: reason || 'Nhập mặt hàng mới vào kho qua AI',
        dbClient: client
      });

      // Write Audit Log
      await createAuditLog({
        userId,
        action: 'IMPORT_NEW_PRODUCT',
        entityType: 'INVENTORY',
        entityId: product.id,
        newValues: {
          productCode: finalCode,
          name: rawName,
          categoryId: finalCategoryId,
          stockQuantity: qty,
          costPrice: cPrice,
          sellingPrice: sPrice,
          unit: finalUnit,
          classification: classification ? {
            categoryName: classification.categoryName,
            confidence: classification.confidence,
            reason: classification.reason
          } : null
        },
        reason: reason || 'Nhập mặt hàng mới có phân loại tự động bằng AI',
        ipAddress: clientIp,
        userAgent,
        dbClient: client
      });

      await client.query('COMMIT;');

      const updateInfo = {
        productId: product.id,
        productCode: product.product_code,
        name: product.name,
        currentStock: qty,
        minimumStock: product.minimum_stock,
        isLowStock: qty <= product.minimum_stock
      };
      broadcastStockUpdate([updateInfo]);

      return {
        product: {
          id: product.id,
          productCode: product.product_code,
          name: product.name,
          categoryId: product.category_id,
          stockQuantity: product.stock_quantity,
          costPrice: product.cost_price,
          sellingPrice: product.selling_price,
          unit: product.unit,
          imageUrl: product.image_url
        },
        transaction: tx,
        classification
      };
    } catch (err) {
      await client.query('ROLLBACK;');
      throw err;
    } finally {
      client.release();
    }
  }
}

module.exports = InventoryService;
