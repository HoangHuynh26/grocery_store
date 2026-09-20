const { getClient } = require('../database');
const { getInventoryList, createTransaction, listTransactions } = require('../repositories/inventoryRepository');
const { createAuditLog } = require('../repositories/auditRepository');
const { broadcastStockUpdate, broadcastLowStockAlert } = require('./socketService');
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
}

module.exports = InventoryService;
