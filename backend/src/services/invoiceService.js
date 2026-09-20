const { getClient } = require('../database');
const { findById, listInvoices } = require('../repositories/invoiceRepository');
const { createAuditLog } = require('../repositories/auditRepository');
const { broadcastStockUpdate } = require('./socketService');
const { AppError } = require('../middleware/errorHandler');

class InvoiceService {
  static async getInvoiceDetails(id) {
    const invoice = await findById(id);
    if (!invoice) {
      throw new AppError('Không tìm thấy hóa đơn.', 404, 'INVOICE_NOT_FOUND');
    }
    return invoice;
  }

  static async getInvoicesList(filters) {
    return await listInvoices(filters);
  }

  /**
   * Super Admin only: Adjust invoice quantities with complete audit trail and stock adjustment
   */
  static async adjustInvoice({
    invoiceId,
    itemAdjustments, // [{ itemId, newQuantity }]
    reason,
    userId,
    clientIp,
    userAgent
  }) {
    if (!reason || reason.trim().length < 5) {
      throw new AppError('Bắt buộc phải nhập lý do rõ ràng khi điều chỉnh hóa đơn tài chính.', 400, 'REASON_REQUIRED');
    }

    const currentInvoice = await findById(invoiceId);
    if (!currentInvoice) {
      throw new AppError('Không tìm thấy hóa đơn cần điều chỉnh.', 404, 'INVOICE_NOT_FOUND');
    }

    if (currentInvoice.status === 'CANCELLED') {
      throw new AppError('Hóa đơn đã bị hủy, không thể điều chỉnh.', 400, 'INVOICE_CANCELLED');
    }

    const client = await getClient();
    const stockUpdatesForBroadcast = [];

    try {
      await client.query('BEGIN;');

      const oldValues = {
        invoiceNumber: currentInvoice.invoice_number,
        totalAmount: currentInvoice.total_amount,
        items: currentInvoice.items.map(i => ({
          itemId: i.id,
          productId: i.product_id,
          productName: i.product_name,
          quantity: i.quantity,
          unitPrice: i.unit_price,
          totalPrice: i.total_price
        }))
      };

      const newItemsSnapshot = [];
      let newTotal = 0;

      for (const adj of itemAdjustments) {
        const item = currentInvoice.items.find(i => i.id === adj.itemId);
        if (!item) continue;

        const oldQty = parseInt(item.quantity, 10);
        const newQty = parseInt(adj.newQuantity, 10);
        if (newQty <= 0) {
          throw new AppError(`Số lượng món "${item.product_name}" sau điều chỉnh phải lớn hơn 0.`, 400, 'INVALID_QUANTITY');
        }

        const qtyDiff = newQty - oldQty; // If positive: customer bought more (need more stock). If negative: returned (return to stock).
        const unitPrice = parseFloat(item.unit_price);
        const newTotalPrice = unitPrice * newQty;
        newTotal += newTotalPrice;

        if (qtyDiff !== 0) {
          // Lock product row to verify and update stock
          const prodRes = await client.query(
            `SELECT id, product_code, name, stock_quantity, minimum_stock, cost_price FROM products WHERE id = $1 FOR UPDATE;`,
            [item.product_id]
          );
          if (prodRes.rowCount > 0) {
            const prod = prodRes.rows[0];
            const currentProdStock = parseInt(prod.stock_quantity, 10);
            const newProdStock = currentProdStock - qtyDiff;

            if (newProdStock < 0) {
              throw new AppError(`Kho không đủ hàng để tăng số lượng món "${item.product_name}" (hiện còn ${currentProdStock}).`, 400, 'INSUFFICIENT_STOCK');
            }

            // Update product stock
            await client.query(
              `UPDATE products SET stock_quantity = $1, updated_at = NOW(), updated_by = $2 WHERE id = $3;`,
              [newProdStock, userId, prod.id]
            );

            // Record inventory transaction
            await client.query(
              `INSERT INTO inventory_transactions (
                product_id, transaction_type, quantity_before, quantity_change, quantity_after,
                unit_cost, user_id, reference_id, reason, created_at
              ) VALUES ($1, 'CORRECTION', $2, $3, $4, $5, $6, $7, $8, NOW());`,
              [
                prod.id,
                currentProdStock,
                -qtyDiff,
                newProdStock,
                prod.cost_price,
                userId,
                currentInvoice.invoice_number,
                `Điều chỉnh hóa đơn: ${reason}`
              ]
            );

            stockUpdatesForBroadcast.push({
              productId: prod.id,
              currentStock: newProdStock,
              name: prod.name
            });
          }

          // Update invoice item
          await client.query(
            `UPDATE invoice_items SET quantity = $1, total_price = $2 WHERE id = $3;`,
            [newQty, newTotalPrice, item.id]
          );
        }

        newItemsSnapshot.push({
          itemId: item.id,
          productId: item.product_id,
          productName: item.product_name,
          quantity: newQty,
          unitPrice,
          totalPrice: newTotalPrice
        });
      }

      // Update invoice total and status to ADJUSTED
      await client.query(
        `UPDATE invoices SET subtotal = $1, total_amount = $1, status = 'ADJUSTED', updated_at = NOW() WHERE id = $2;`,
        [newTotal, invoiceId]
      );

      // Update payment amount due
      await client.query(
        `UPDATE payments SET amount_due = $1 WHERE invoice_id = $2;`,
        [newTotal, invoiceId]
      );

      // Write Audit Log
      await createAuditLog({
        userId,
        action: 'UPDATE_INVOICE',
        entityType: 'INVOICE',
        entityId: invoiceId,
        oldValues,
        newValues: {
          invoiceNumber: currentInvoice.invoice_number,
          totalAmount: newTotal,
          items: newItemsSnapshot
        },
        reason,
        ipAddress: clientIp,
        userAgent,
        dbClient: client
      });

      await client.query('COMMIT;');

      if (stockUpdatesForBroadcast.length > 0) {
        broadcastStockUpdate(stockUpdatesForBroadcast);
      }

      return await findById(invoiceId);
    } catch (err) {
      await client.query('ROLLBACK;');
      throw err;
    } finally {
      client.release();
    }
  }
}

module.exports = InvoiceService;
