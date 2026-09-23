const { query } = require('./index');
const { hashPassword } = require('../utils/password');
const { generateQrToken } = require('../utils/idGenerator');
const ForecastService = require('../modules/ai/forecasting/forecastService');

async function seedDatabase() {
  console.log('[Seed] Checking database for initial data...');

  // 1. Check if users already exist
  const userCheck = await query('SELECT COUNT(*) as count FROM users;');
  const userCount = parseInt(userCheck.rows[0]?.count || '0', 10);

  if (userCount > 0) {
    console.log('[Seed] Database already seeded. Skipping initial creation.');
    return;
  }

  console.log('[Seed] Seeding default accounts, categories, products, and historical data...');

  // Create Super Admin & Admin users (Password: Admin@123)
  const adminPass = await hashPassword('Admin@123');
  const staffPass = await hashPassword('Admin@123');

  const superAdminRes = await query(`
    INSERT INTO users (username, email, password_hash, full_name, phone, role, is_active, created_at, updated_at)
    VALUES ($1, $2, $3, $4, $5, 'SUPER_ADMIN', TRUE, NOW(), NOW())
    RETURNING id;
  `, ['admin', 'admin@grocerystore.vn', adminPass, 'Quản Trị Viên Cửa Hàng', '0901234567']);
  const superAdminId = superAdminRes.rows[0].id;

  const adminRes = await query(`
    INSERT INTO users (username, email, password_hash, full_name, phone, role, is_active, created_at, updated_at)
    VALUES ($1, $2, $3, $4, $5, 'ADMIN', TRUE, NOW(), NOW())
    RETURNING id;
  `, ['nhanvien1', 'staff1@grocerystore.vn', staffPass, 'Nguyễn Văn Bán Hàng', '0987654321']);
  const adminId = adminRes.rows[0].id;

  console.log('[Seed] Default users created: admin (SUPER_ADMIN) & nhanvien1 (ADMIN)');

  // 2. Create Categories
  const categoriesData = [
    { name: 'Nước giải khát', slug: 'nuoc-giai-khat', desc: 'Các loại nước ngọt, nước tăng lực, nước suối' },
    { name: 'Mì & Bún khô', slug: 'mi-bun-kho', desc: 'Mì tôm, bún, miến ăn liền' },
    { name: 'Bánh kẹo & Snack', slug: 'banh-keo-snack', desc: 'Snack khoai tây, bánh quy, kẹo ngậm' },
    { name: 'Sữa & Sản phẩm từ sữa', slug: 'sua', desc: 'Sữa chua, sữa tươi, phô mai' },
    { name: 'Gia vị & Dầu ăn', slug: 'gia-vi-dau-an', desc: 'Hạt nêm, nước mắm, dầu ăn thực vật' },
    { name: 'Đồ uống tươi pha chế', slug: 'do-uong-tuoi', desc: 'Nước mía, nước cam ép trực tiếp tại quầy' }
  ];

  const catMap = new Map();
  for (const cat of categoriesData) {
    const res = await query(`
      INSERT INTO categories (name, slug, description, is_active, created_at, updated_at)
      VALUES ($1, $2, $3, TRUE, NOW(), NOW())
      RETURNING id, slug;
    `, [cat.name, cat.slug, cat.desc]);
    catMap.set(res.rows[0].slug, res.rows[0].id);
  }

  // 3. Create Products (With realistic codes, prices, stocks, QR tokens and high quality images)
  const productsData = [
    {
      code: 'NUOC-COCA-330',
      name: 'Coca Cola lon 330ml',
      categorySlug: 'nuoc-giai-khat',
      desc: 'Nước ngọt có ga giải khát vị nguyên bản',
      cost: 8000,
      price: 10000,
      stock: 50,
      minStock: 10,
      unit: 'lon',
      hasQr: true,
      imageUrl: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=500&auto=format&fit=crop&q=80'
    },
    {
      code: 'NUOC-PEPSI-330',
      name: 'Pepsi lon 330ml',
      categorySlug: 'nuoc-giai-khat',
      desc: 'Nước ngọt Pepsi vị sảng khoái',
      cost: 8000,
      price: 10000,
      stock: 45,
      minStock: 10,
      unit: 'lon',
      hasQr: true,
      imageUrl: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=500&auto=format&fit=crop&q=80'
    },
    {
      code: 'NUOC-AQUAFINA-500',
      name: 'Nước khoáng Aquafina 500ml',
      categorySlug: 'nuoc-giai-khat',
      desc: 'Nước uống tinh khiết Aquafina đóng chai',
      cost: 4000,
      price: 6000,
      stock: 80,
      minStock: 15,
      unit: 'chai',
      hasQr: true,
      imageUrl: 'https://images.unsplash.com/photo-1548839140-29a749e1bc4e?w=500&auto=format&fit=crop&q=80'
    },
    {
      code: 'MI-HAOHAO-001',
      name: 'Mì Hảo Hảo tôm chua cay',
      categorySlug: 'mi-bun-kho',
      desc: 'Mì ăn liền Hảo Hảo vị chua cay truyền thống',
      cost: 3500,
      price: 4500,
      stock: 120,
      minStock: 20,
      unit: 'gói',
      hasQr: true,
      imageUrl: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=500&auto=format&fit=crop&q=80'
    },
    {
      code: 'MI-OMACHI-SGB',
      name: 'Mì Omachi xốt bò hầm',
      categorySlug: 'mi-bun-kho',
      desc: 'Mì khoai tây Omachi cao cấp vị xốt bò',
      cost: 6800,
      price: 8500,
      stock: 60,
      minStock: 15,
      unit: 'gói',
      hasQr: true,
      imageUrl: 'https://images.unsplash.com/photo-1612927601601-6638404737ce?w=500&auto=format&fit=crop&q=80'
    },
    {
      code: 'SUA-VINAMILK-180',
      name: 'Lốc sữa tươi Vinamilk có đường 180ml',
      categorySlug: 'sua',
      desc: 'Lốc 4 hộp sữa tươi tiệt trùng Vinamilk 180ml',
      cost: 27000,
      price: 32000,
      stock: 35,
      minStock: 8,
      unit: 'lốc',
      hasQr: true,
      imageUrl: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=500&auto=format&fit=crop&q=80'
    },
    {
      code: 'BANH-CHOCORIE-01',
      name: 'Bánh ChocoPie Orion hộp 6 cái',
      categorySlug: 'banh-keo-snack',
      desc: 'Bánh phủ socola mềm nhân dẻo marshmallow',
      cost: 29000,
      price: 35000,
      stock: 25,
      minStock: 5,
      unit: 'hộp',
      hasQr: true,
      imageUrl: 'https://images.unsplash.com/photo-1587314168485-3236d6710814?w=500&auto=format&fit=crop&q=80'
    },
    {
      code: 'SNACK-LAY-NATURAL',
      name: "Snack khoai tây Lay's tự nhiên 54g",
      categorySlug: 'banh-keo-snack',
      desc: 'Bim bim khoai tây giòn tan',
      cost: 9500,
      price: 12000,
      stock: 40,
      minStock: 10,
      unit: 'gói',
      hasQr: true,
      imageUrl: 'https://images.unsplash.com/photo-1566478989037-eec170784d0b?w=500&auto=format&fit=crop&q=80'
    },
    {
      code: 'GIAVI-KNORR-400',
      name: 'Hạt nêm Knorr thịt thăn 400g',
      categorySlug: 'gia-vi-dau-an',
      desc: 'Hạt nêm từ thịt thăn, xương ống và tủy',
      cost: 32000,
      price: 38000,
      stock: 20,
      minStock: 5,
      unit: 'gói',
      hasQr: true,
      imageUrl: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=500&auto=format&fit=crop&q=80'
    },
    {
      code: 'DAUAN-TUONGAN-1L',
      name: 'Dầu ăn Tường An Cooking Oil 1L',
      categorySlug: 'gia-vi-dau-an',
      desc: 'Dầu thực vật tinh luyện Tường An',
      cost: 42000,
      price: 48000,
      stock: 4, // Intentionally LOW STOCK (<= minStock 10) to test warning
      minStock: 10,
      unit: 'chai',
      hasQr: true,
      imageUrl: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=500&auto=format&fit=crop&q=80'
    },
    // Products without QR code (Option 2: No QR for custom/made-to-order items)
    {
      code: 'MON-NUOC-MIA-01',
      name: 'Nước mía tươi ép ly lớn',
      categorySlug: 'do-uong-tuoi',
      desc: 'Nước mía tươi nguyên chất ép tại chỗ',
      cost: 4000,
      price: 12000,
      stock: 100,
      minStock: 20,
      unit: 'ly',
      hasQr: false,
      imageUrl: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=500&auto=format&fit=crop&q=80'
    },
    {
      code: 'MON-CAM-VAT-01',
      name: 'Nước cam vắt mật ong ly',
      categorySlug: 'do-uong-tuoi',
      desc: 'Cam sành tươi vắt kết hợp mật ong ngọt dịu',
      cost: 9000,
      price: 20000,
      stock: 50,
      minStock: 10,
      unit: 'ly',
      hasQr: false,
      imageUrl: 'https://images.unsplash.com/photo-1613478223719-2ab802602423?w=500&auto=format&fit=crop&q=80'
    }
  ];

  const createdProducts = [];
  for (const p of productsData) {
    const qrToken = p.hasQr ? generateQrToken() : null;
    const catId = catMap.get(p.categorySlug);

    const res = await query(`
      INSERT INTO products (
        product_code, name, category_id, description, image_url,
        cost_price, selling_price, stock_quantity, minimum_stock, unit,
        qr_code_token, has_qr, is_active, created_by, updated_by, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10,
        $11, $12, TRUE, $13, $13, NOW(), NOW()
      ) RETURNING *;
    `, [
      p.code, p.name, catId, p.desc, p.imageUrl,
      p.cost, p.price, p.stock, p.minStock, p.unit,
      qrToken, p.hasQr, superAdminId
    ]);

    const createdProd = res.rows[0];
    createdProducts.push(createdProd);

    // Initial stock import transaction
    await query(`
      INSERT INTO inventory_transactions (
        product_id, transaction_type, quantity_before, quantity_change, quantity_after,
        unit_cost, user_id, reference_id, reason, created_at
      ) VALUES ($1, 'IMPORT', 0, $2, $2, $3, $4, 'INITIAL_SEED', 'Khởi tạo kho ban đầu', NOW());
    `, [createdProd.id, p.stock, p.cost, superAdminId]);
  }

  console.log(`[Seed] Seeded ${createdProducts.length} products with initial inventory transactions.`);

  // 4. Seed Historical Sales Invoices for Past Months to train AI Forecasting
  // Months: May, June, July, August 2026
  console.log('[Seed] Generating historical sales data for AI Model training...');
  const monthlyPlans = [
    { year: 2026, month: 5, targetRevenue: 52000000, count: 85 },
    { year: 2026, month: 6, targetRevenue: 56500000, count: 92 },
    { year: 2026, month: 7, targetRevenue: 61800000, count: 98 },
    { year: 2026, month: 8, targetRevenue: 65400000, count: 104 },
    { year: 2026, month: 9, targetRevenue: 42300000, count: 68 } // Current month progress
  ];

  let invoiceSeq = 1;
  for (const plan of monthlyPlans) {
    const daysInMonth = plan.month === 9 ? 20 : 30; // Up to Sep 20
    const invoicesPerDay = Math.floor(plan.count / daysInMonth);

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `2026-${String(plan.month).padStart(2, '0')}-${String(day).padStart(2, '0')} 14:30:00+07`;
      const numInvoices = invoicesPerDay + (day % 3 === 0 ? 1 : 0);

      for (let k = 0; k < numInvoices; k++) {
        const invNum = `INV-2026${String(plan.month).padStart(2, '0')}${String(day).padStart(2, '0')}-${String(invoiceSeq++).padStart(4, '0')}`;
        // Random pick 2-4 products
        const sampleProd1 = createdProducts[invoiceSeq % createdProducts.length];
        const sampleProd2 = createdProducts[(invoiceSeq + 2) % createdProducts.length];
        const qty1 = (invoiceSeq % 3) + 1;
        const qty2 = (invoiceSeq % 2) + 1;
        const totalAmount = (qty1 * parseFloat(sampleProd1.selling_price)) + (qty2 * parseFloat(sampleProd2.selling_price));

        const invRes = await query(`
          INSERT INTO invoices (
            invoice_number, idempotency_key, user_id, subtotal, discount_amount,
            total_amount, status, notes, client_ip, user_agent, created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, 0,
            $4, 'COMPLETED', 'Đơn hàng bán lẻ', '127.0.0.1', 'POS Terminal', $5, $5
          ) RETURNING id;
        `, [invNum, `SEED_KEY_${invoiceSeq}`, adminId, totalAmount, dateStr]);
        const invId = invRes.rows[0].id;

        // Invoice items
        await query(`
          INSERT INTO invoice_items (
            invoice_id, product_id, product_code, product_name, unit,
            quantity, unit_price, total_price, cost_price, created_at
          ) VALUES 
          ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10),
          ($1, $11, $12, $13, $14, $15, $16, $17, $18, $10);
        `, [
          invId, sampleProd1.id, sampleProd1.product_code, sampleProd1.name, sampleProd1.unit,
          qty1, sampleProd1.selling_price, qty1 * sampleProd1.selling_price, sampleProd1.cost_price, dateStr,
          sampleProd2.id, sampleProd2.product_code, sampleProd2.name, sampleProd2.unit,
          qty2, sampleProd2.selling_price, qty2 * sampleProd2.selling_price, sampleProd2.cost_price
        ]);

        // Payment
        const method = invoiceSeq % 3 === 0 ? 'TRANSFER' : 'CASH';
        await query(`
          INSERT INTO payments (
            invoice_id, payment_method, amount_due, amount_paid, change_amount,
            payment_status, transaction_reference, created_at
          ) VALUES ($1, $2, $3, $3, 0, 'PAID', $4, $5);
        `, [invId, method, totalAmount, `TX_${invoiceSeq}`, dateStr]);
      }
    }
  }

  console.log(`[Seed] Successfully seeded ${invoiceSeq - 1} historical sales invoices.`);

  // 5. Train Initial AI Forecasting Model
  console.log('[Seed] Training initial ML revenue forecasting model...');
  try {
    const forecastResult = await ForecastService.trainAndForecast();
    console.log(`[Seed] Initial Forecast Model trained: ${forecastResult.model.version} (MAPE: ${forecastResult.model.mape.toFixed(2)}%). Next month forecast: ${forecastResult.forecast.forecast_month} -> ${forecastResult.forecast.predicted_revenue}`);
  } catch (err) {
    console.warn('[Seed] Forecasting initial train warning:', err.message);
  }

  console.log('[Seed] Database initialization completed successfully!');
}

module.exports = { seedDatabase };
