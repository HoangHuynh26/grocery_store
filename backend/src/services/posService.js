const { getClient, query } = require('../database');
const { generateInvoiceNumber } = require('../utils/idGenerator');
const { PaymentService } = require('./paymentService');
const { createAuditLog } = require('../repositories/auditRepository');
const { broadcastStockUpdate, broadcastInvoiceCreated, broadcastLowStockAlert } = require('./socketService');
const { AppError } = require('../middleware/errorHandler');

class PosService {
  /**
   * Validate stock availability before final checkout confirmation
   */
  static async validateCartStock(items) {
    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new AppError('Giỏ hàng trống.', 400, 'EMPTY_CART');
    }

    const productIds = items.map(i => i.productId);
    const sql = `
      SELECT id, product_code, name, selling_price, stock_quantity, minimum_stock, unit, is_active
      FROM products
      WHERE id = ANY($1);
    `;
    const res = await query(sql, [productIds]);
    const dbProductMap = new Map(res.rows.map(p => [p.id, p]));

    const validationResults = [];
    let isValid = true;

    for (const item of items) {
      const product = dbProductMap.get(item.productId);
      if (!product || !product.is_active) {
        validationResults.push({
          productId: item.productId,
          available: false,
          error: 'Sản phẩm không tồn tại hoặc đã ngừng kinh doanh.'
        });
        isValid = false;
        continue;
      }

      if (product.stock_quantity < item.quantity) {
        validationResults.push({
          productId: item.productId,
          productName: product.name,
          requested: item.quantity,
          availableStock: product.stock_quantity,
          available: false,
          error: `Số lượng tồn kho không đủ (Hiện còn ${product.stock_quantity} ${product.unit}).`
        });
        isValid = false;
      } else {
        validationResults.push({
          productId: item.productId,
          productName: product.name,
          currentPrice: parseFloat(product.selling_price),
          availableStock: product.stock_quantity,
          available: true
        });
      }
    }

    return { isValid, items: validationResults };
  }

  /**
   * Complete atomic checkout transaction
   */
  static async checkout({
    userId,
    items,
    paymentMethod = 'CASH',
    amountPaid,
    notes = '',
    idempotencyKey = null,
    clientIp = null,
    userAgent = null
  }) {
    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new AppError('Giỏ hàng không có sản phẩm nào.', 400, 'EMPTY_CART');
    }

    // 1. Idempotency Check: if request was already executed, return original invoice
    if (idempotencyKey) {
      const existingRes = await query(
        `SELECT i.*, p.payment_method, p.payment_status, p.amount_due, p.amount_paid, p.change_amount
         FROM invoices i
         LEFT JOIN payments p ON i.id = p.invoice_id
         WHERE i.idempotency_key = $1;`,
        [idempotencyKey]
      );
      if (existingRes.rowCount > 0) {
        console.log(`[POS Idempotency] Request duplicate detected with key: ${idempotencyKey}. Returning existing invoice.`);
        const invoice = existingRes.rows[0];
        const itemsRes = await query(`SELECT * FROM invoice_items WHERE invoice_id = $1;`, [invoice.id]);
        invoice.items = itemsRes.rows;
        return {
          invoice,
          isDuplicate: true,
          message: 'Hóa đơn đã được xử lý trước đó.'
        };
      }
    }

    // Sort product IDs in ascending order to prevent deadlocks across concurrent transactions
    const uniqueItemsMap = new Map();
    for (const item of items) {
      if (item.quantity <= 0) {
        throw new AppError('Số lượng sản phẩm trong giỏ hàng phải lớn hơn 0.', 400, 'INVALID_QUANTITY');
      }
      const existingQty = uniqueItemsMap.get(item.productId) || 0;
      uniqueItemsMap.set(item.productId, existingQty + item.quantity);
    }

    const sortedProductIds = Array.from(uniqueItemsMap.keys()).sort();

    const client = await getClient();
    const stockUpdatesForBroadcast = [];

    try {
      await client.query('BEGIN;');

      // 2. Lock products row-level with SELECT ... FOR UPDATE in ascending ID order
      const lockSql = `
        SELECT id, product_code, name, selling_price, cost_price, stock_quantity, minimum_stock, unit, is_active
        FROM products
        WHERE id = ANY($1)
        ORDER BY id ASC
        FOR UPDATE;
      `;
      const lockedRes = await client.query(lockSql, [sortedProductIds]);
      const dbProductMap = new Map(lockedRes.rows.map(p => [p.id, p]));

      // 3. Verify existence and stock availability
      let subtotal = 0;
      const verifiedItems = [];

      for (const [productId, requestedQty] of uniqueItemsMap.entries()) {
        const product = dbProductMap.get(productId);

        if (!product || !product.is_active) {
          throw new AppError(`Sản phẩm không tồn tại hoặc đã ngừng kinh doanh (ID: ${productId}).`, 400, 'PRODUCT_INACTIVE');
        }

        const currentStock = parseInt(product.stock_quantity, 10);
        if (currentStock < requestedQty) {
          throw new AppError(
            `Sản phẩm "${product.name}" chỉ còn ${currentStock} ${product.unit}, không đủ để bán ${requestedQty} ${product.unit}. Vui lòng kiểm tra lại.`,
            400,
            'INSUFFICIENT_STOCK'
          );
        }

        const unitPrice = parseFloat(product.selling_price);
        const costPrice = parseFloat(product.cost_price);
        const totalPrice = unitPrice * requestedQty;
        subtotal += totalPrice;

        verifiedItems.push({
          product,
          requestedQty,
          currentStock,
          newStock: currentStock - requestedQty,
          unitPrice,
          costPrice,
          totalPrice
        });
      }

      const totalAmount = subtotal; // Can add tax/discount computation here if needed

      // 4. Process payment strategy
      const paymentResult = await PaymentService.process(paymentMethod, {
        amountDue: totalAmount,
        amountPaid: amountPaid !== undefined ? parseFloat(amountPaid) : totalAmount
      });

      // 5. Generate unique invoice number
      const countRes = await client.query(`SELECT COUNT(*) as count FROM invoices;`);
      const seq = parseInt(countRes.rows[0]?.count || '0', 10) + 1;
      const invoiceNumber = generateInvoiceNumber(seq);

      // 6. Insert invoice record
      const invoiceSql = `
        INSERT INTO invoices (
          invoice_number, idempotency_key, user_id, subtotal, discount_amount,
          total_amount, status, notes, client_ip, user_agent, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, 0,
          $5, 'COMPLETED', $6, $7, $8, NOW(), NOW()
        ) RETURNING *;
      `;
      const invoiceRes = await client.query(invoiceSql, [
        invoiceNumber,
        idempotencyKey,
        userId,
        subtotal,
        totalAmount,
        notes,
        clientIp,
        userAgent
      ]);
      const invoice = invoiceRes.rows[0];

      // 7. Insert invoice items, update stock, and insert inventory transactions
      const createdItems = [];

      for (const item of verifiedItems) {
        // Insert invoice item
        const itemSql = `
          INSERT INTO invoice_items (
            invoice_id, product_id, product_code, product_name, unit,
            quantity, unit_price, total_price, cost_price, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
          RETURNING *;
        `;
        const itemRes = await client.query(itemSql, [
          invoice.id,
          item.product.id,
          item.product.product_code,
          item.product.name,
          item.product.unit,
          item.requestedQty,
          item.unitPrice,
          item.totalPrice,
          item.costPrice
        ]);
        createdItems.push(itemRes.rows[0]);

        // Deduct stock quantity in products
        await client.query(
          `UPDATE products SET stock_quantity = $1, updated_at = NOW(), updated_by = $2 WHERE id = $3;`,
          [item.newStock, userId, item.product.id]
        );

        // Record inventory transaction
        await client.query(
          `INSERT INTO inventory_transactions (
            product_id, transaction_type, quantity_before, quantity_change, quantity_after,
            unit_cost, user_id, reference_id, reason, created_at
          ) VALUES ($1, 'SALE', $2, $3, $4, $5, $6, $7, 'Bán hàng tại quầy POS', NOW());`,
          [
            item.product.id,
            item.currentStock,
            -item.requestedQty,
            item.newStock,
            item.costPrice,
            userId,
            invoice.invoice_number
          ]
        );

        stockUpdatesForBroadcast.push({
          productId: item.product.id,
          productCode: item.product.product_code,
          name: item.product.name,
          previousStock: item.currentStock,
          currentStock: item.newStock,
          minimumStock: item.product.minimum_stock,
          isLowStock: item.newStock <= item.product.minimum_stock
        });
      }

      // 8. Insert payment record
      const paymentSql = `
        INSERT INTO payments (
          invoice_id, payment_method, amount_due, amount_paid, change_amount,
          payment_status, transaction_reference, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        RETURNING *;
      `;
      const paymentRes = await client.query(paymentSql, [
        invoice.id,
        paymentResult.paymentMethod,
        paymentResult.amountDue,
        paymentResult.amountPaid,
        paymentResult.changeAmount,
        paymentResult.paymentStatus,
        paymentResult.transactionReference
      ]);
      invoice.payment = paymentRes.rows[0];
      invoice.items = createdItems;

      // 9. Write Audit Log
      await createAuditLog({
        userId,
        action: 'CREATE_INVOICE',
        entityType: 'INVOICE',
        entityId: invoice.id,
        newValues: {
          invoiceNumber: invoice.invoice_number,
          totalAmount: invoice.total_amount,
          paymentMethod: paymentResult.paymentMethod,
          itemsCount: createdItems.length
        },
        reason: 'Tạo hóa đơn thanh toán thành công',
        ipAddress: clientIp,
        userAgent,
        dbClient: client
      });

      // 10. COMMIT transaction
      await client.query('COMMIT;');

      // 11. Realtime Broadcast after successful commit
      broadcastInvoiceCreated(invoice);
      broadcastStockUpdate(stockUpdatesForBroadcast);
      for (const s of stockUpdatesForBroadcast) {
        if (s.isLowStock) {
          broadcastLowStockAlert(s);
        }
      }

      return {
        invoice,
        isDuplicate: false,
        message: 'Thanh toán và tạo hóa đơn thành công.'
      };
    } catch (err) {
      await client.query('ROLLBACK;');
      throw err;
    } finally {
      client.release();
    }
  }
}

module.exports = PosService;
