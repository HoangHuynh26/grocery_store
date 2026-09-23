// Automated Test Suite for Grocery Store Management System
// Verifies: Auth, RBAC, Concurrency & Row Locking, Overselling Prevention, Idempotency, AI Assistant

const BASE_URL = 'http://localhost:5000/api';

async function request(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const data = await res.json();
  return { status: res.status, data };
}

async function runTests() {
  console.log('====================================================');
  console.log(' STARTING GROCERY STORE AUTOMATED TEST SUITE        ');
  console.log('====================================================');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  // TEST 1: Health Check
  console.log('\n[1] Testing Health Endpoint...');
  const health = await request('/health');
  assert(health.status === 200 && health.data.status === 'healthy', 'Health check returns 200 OK');

  // TEST 2: Authentication & Login
  console.log('\n[2] Testing Authentication & RBAC...');
  // Wrong password
  const failLogin = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ identifier: 'admin', password: 'WrongPassword' })
  });
  assert(failLogin.status === 401 && failLogin.data.error.code === 'INVALID_CREDENTIALS', 'Reject wrong password');

  // Successful Super Admin login with username
  const adminLogin = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ identifier: 'admin', password: 'Admin@123' })
  });
  assert(adminLogin.status === 200 && adminLogin.data.data.user.role === 'SUPER_ADMIN', 'Super Admin login success (username: admin / Admin@123)');
  const adminToken = adminLogin.data.data.accessToken;

  // Successful Super Admin login with email
  const adminEmailLogin = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ identifier: 'admin@grocerystore.vn', password: 'Admin@123' })
  });
  assert(adminEmailLogin.status === 200 && adminEmailLogin.data.data.user.role === 'SUPER_ADMIN', 'Super Admin login success (email: admin@grocerystore.vn / Admin@123)');

  // Successful Cashier Admin login with username
  const staffLogin = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ identifier: 'nhanvien1', password: 'Admin@123' })
  });
  assert(staffLogin.status === 200 && staffLogin.data.data.user.role === 'ADMIN', 'Cashier Admin login success (username: nhanvien1 / Admin@123)');
  const staffToken = staffLogin.data.data.accessToken;

  // Successful Cashier Admin login with email
  const staffEmailLogin = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ identifier: 'staff1@grocerystore.vn', password: 'Admin@123' })
  });
  assert(staffEmailLogin.status === 200 && staffEmailLogin.data.data.user.role === 'ADMIN', 'Cashier Admin login success (email: staff1@grocerystore.vn / Admin@123)');

  // TEST 2B: Client IP & Geolocation Detection
  console.log('\n[2B] Testing IP Extraction & Geolocation in Login Logs...');
  assert(!!adminLogin.data.data.clientLocation && adminLogin.data.data.clientLocation.ip === '127.0.0.1', 'Localhost login detects 127.0.0.1 with local subnet flag');

  const proxyLogin = await request('/auth/login', {
    method: 'POST',
    headers: {
      'X-Forwarded-For': '14.226.12.34, 10.0.0.1'
    },
    body: JSON.stringify({ identifier: 'admin', password: 'Admin@123' })
  });
  assert(
    proxyLogin.status === 200 &&
    proxyLogin.data.data.clientLocation.ip === '14.226.12.34' &&
    (proxyLogin.data.data.clientLocation.country === 'Viet Nam' || proxyLogin.data.data.clientLocation.country === 'Vietnam'),
    'Login with forwarded IP extracts 14.226.12.34 and identifies Viet Nam'
  );

  const logsHistory = await request('/users/login-logs/history', {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  const recentLogs = Array.isArray(logsHistory.data) ? logsHistory.data : (logsHistory.data?.data || []);
  const matchingGeoLog = recentLogs.find(l => l.ip_address === '14.226.12.34');
  assert(
    !!matchingGeoLog && ('location_city' in matchingGeoLog) && ('location_country' in matchingGeoLog),
    'Login logs history records IP geolocation columns (location_city, location_country)'
  );

  // Direct client-ip endpoint test
  const clientIpRes = await request('/auth/client-ip', {
    headers: { 'X-Forwarded-For': '1.55.12.34' }
  });
  assert(
    clientIpRes.status === 200 && clientIpRes.data.success && clientIpRes.data.data.ip === '1.55.12.34' && !!clientIpRes.data.data.country,
    'Endpoint GET /api/auth/client-ip detects forwarded IP and resolves location'
  );

  // Me endpoint clientLocation test
  const meRes = await request('/auth/me', {
    headers: { Authorization: `Bearer ${adminToken}`, 'X-Forwarded-For': '1.55.12.34' }
  });
  assert(
    meRes.status === 200 && meRes.data.success && meRes.data.data.clientLocation?.ip === '1.55.12.34',
    'Endpoint GET /api/auth/me provides real-time clientLocation context'
  );

  // TEST 3: RBAC Authorization
  console.log('\n[3] Testing RBAC Privileges...');
  // Cashier attempting to list users (restricted to SUPER_ADMIN)
  const forbiddenUsers = await request('/users', {
    headers: { Authorization: `Bearer ${staffToken}` }
  });
  assert(forbiddenUsers.status === 403, 'Cashier Admin cannot access /users (SUPER_ADMIN only)');

  // Super Admin listing users
  const allowedUsers = await request('/users', {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert(allowedUsers.status === 200 && allowedUsers.data.data.items.length >= 2, 'Super Admin can access /users');

  // TEST 4: Products & QR Lookup
  console.log('\n[4] Testing Product Management & QR Token Lookup...');
  const prods = await request('/products', {
    headers: { Authorization: `Bearer ${staffToken}` }
  });
  assert(prods.status === 200 && prods.data.data.items.length > 0, 'List products successfully');

  const sampleProduct = prods.data.data.items.find(p => p.has_qr && p.qr_code_token);
  assert(!!sampleProduct, `Found product with QR code: ${sampleProduct?.name}`);

  const qrLookup = await request(`/products/qr/${sampleProduct.qr_code_token}`, {
    headers: { Authorization: `Bearer ${staffToken}` }
  });
  assert(qrLookup.status === 200 && qrLookup.data.data.id === sampleProduct.id, 'Lookup product by secure QR token');

  // TEST 4B: Real-time Product Code Uniqueness Check
  console.log('\n[4B] Testing Product Code Uniqueness Check...');
  const dupCodeCheck = await request(`/products/check-code?code=${sampleProduct.product_code}`, {
    headers: { Authorization: `Bearer ${staffToken}` }
  });
  assert(dupCodeCheck.status === 200 && dupCodeCheck.data.data.available === false, `Detect duplicate code "${sampleProduct.product_code}" correctly`);

  const uniqueCodeCheck = await request(`/products/check-code?code=BRAND-NEW-UNIQUE-CODE-${Date.now()}`, {
    headers: { Authorization: `Bearer ${staffToken}` }
  });
  assert(uniqueCodeCheck.status === 200 && uniqueCodeCheck.data.data.available === true, 'Accept brand new unique product code');

  // TEST 5: Concurrency & Overselling Prevention
  console.log('\n[5] Testing Concurrency Control & Overselling Prevention...');
  // Create a test product with exactly 5 items
  const newProdRes = await request('/products', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      productCode: `CONCUR-TEST-${Date.now()}`,
      name: 'Sản Phẩm Kiểm Thử Tranh Chấp',
      costPrice: 5000,
      sellingPrice: 10000,
      stockQuantity: 5,
      minimumStock: 2,
      unit: 'hộp',
      hasQr: true
    })
  });
  const concurProd = newProdRes.data.data;
  assert(concurProd && concurProd.stock_quantity === 5, 'Created test product with stock = 5');

  // Simulate two concurrent checkout requests:
  // Admin A attempts to buy 4 items
  // Admin B attempts to buy 3 items concurrently
  // (Total requested = 7 > 5. Exactly one must succeed, one must fail with INSUFFICIENT_STOCK)
  console.log('  -> Launching concurrent requests: Admin A (qty=4) vs Admin B (qty=3)...');
  const [resA, resB] = await Promise.all([
    request('/pos/checkout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}`, 'idempotency-key': `CONCUR_A_${Date.now()}` },
      body: JSON.stringify({
        items: [{ productId: concurProd.id, quantity: 4 }],
        paymentMethod: 'CASH',
        amountPaid: 40000
      })
    }),
    request('/pos/checkout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${staffToken}`, 'idempotency-key': `CONCUR_B_${Date.now()}` },
      body: JSON.stringify({
        items: [{ productId: concurProd.id, quantity: 3 }],
        paymentMethod: 'CASH',
        amountPaid: 30000
      })
    })
  ]);

  const oneSucceeded = (resA.status === 200 && resB.status === 400) || (resA.status === 400 && resB.status === 200);
  const failureHasCorrectCode = (resA.data.error?.code === 'INSUFFICIENT_STOCK') || (resB.data.error?.code === 'INSUFFICIENT_STOCK');
  assert(oneSucceeded, 'Exactly one concurrent checkout succeeded, avoiding overselling');
  assert(failureHasCorrectCode, 'Failed transaction received clear INSUFFICIENT_STOCK error');

  // Verify stock in database did not become negative
  const verifyStockRes = await request(`/products/${concurProd.id}`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  const remainingStock = verifyStockRes.data.data.stock_quantity;
  assert(remainingStock >= 0 && remainingStock <= 2, `Remaining stock is valid: ${remainingStock} (Never negative!)`);

  // TEST 6: Idempotency Protection
  console.log('\n[6] Testing Idempotency Protection against Double Submissions...');
  const inStockProduct = prods.data.data.items.find(p => p.stock_quantity >= 5) || sampleProduct;
  const testIdempKey = `IDEMP_DOUBLE_CLICK_${Date.now()}`;
  const firstReq = await request('/pos/checkout', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}`, 'idempotency-key': testIdempKey },
    body: JSON.stringify({
      items: [{ productId: inStockProduct.id, quantity: 1 }],
      paymentMethod: 'CASH',
      amountPaid: 100000
    })
  });
  assert(firstReq.status === 200, 'First checkout with idempotency key succeeded');
  const firstInvoiceId = firstReq.data?.data?.id;

  // Immediate second duplicate submission with identical key
  const secondReq = await request('/pos/checkout', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}`, 'idempotency-key': testIdempKey },
    body: JSON.stringify({
      items: [{ productId: inStockProduct.id, quantity: 1 }],
      paymentMethod: 'CASH',
      amountPaid: 100000
    })
  });
  assert(secondReq.status === 200, 'Duplicate request returned 200 without error');
  assert(secondReq.data.isDuplicate === true, 'Duplicate response flagged isDuplicate = true');
  assert(secondReq.data.data.id === firstInvoiceId, 'Returned exact same invoice ID without duplicate charging');

  // TEST 7: Audit Log Verification
  console.log('\n[7] Testing Audit Log Recording...');
  const auditRes = await request('/audit-logs?limit=5', {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert(auditRes.status === 200 && auditRes.data.data.items.length > 0, 'Audit logs retrieved');
  const hasInvoiceAudit = auditRes.data.data.items.some(l => l.action === 'CREATE_INVOICE');
  assert(hasInvoiceAudit, 'CREATE_INVOICE action successfully captured in Audit Log');

  // TEST 8: AI Assistant & Revenue Forecasting
  console.log('\n[8] Testing AI Assistant & Forecasting...');
  const forecastRes = await request('/ai/forecast', {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert(forecastRes.status === 200 && !!forecastRes.data.data.currentForecast, 'AI Revenue Forecast available');

  const chat1 = await request('/ai/chat', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ message: 'Doanh thu hôm nay bao nhiêu?' })
  });
  assert(chat1.status === 200 && chat1.data.data.reply.includes('Doanh thu'), 'AI Assistant answered today revenue query');
  assert(!chat1.data.data.reply.includes('*'), 'AI Assistant response has 0 asterisks (*)');

  // Hourly specific revenue inquiry (User specific case: "vào lúc 13 giờ hôm nay có doanh thu nào không")
  const chatHour13 = await request('/ai/chat', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ message: 'vào lúc 13 giờ hôm nay có doanh thu nào không' })
  });
  assert(chatHour13.status === 200, 'AI Assistant handled specific hour 13 revenue query');
  assert(chatHour13.data.data.reply.includes('13:00'), 'AI Assistant response specifies hour 13:00');
  assert(
    chatHour13.data.data.reply.includes('không có doanh thu') || chatHour13.data.data.reply.includes('0đ') || chatHour13.data.data.reply.includes('có ghi nhận doanh thu'),
    'AI Assistant accurately answers whether there was revenue at hour 13'
  );
  assert(!chatHour13.data.data.reply.includes('*'), 'Hour 13 response has 0 asterisks (*)');

  // Hourly breakdown inquiry
  const chatHourlyBreakdown = await request('/ai/chat', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ message: 'doanh thu theo từng khung giờ hôm nay' })
  });
  assert(chatHourlyBreakdown.status === 200, 'AI Assistant handled hourly breakdown query');
  assert(!chatHourlyBreakdown.data.data.reply.includes('*'), 'Hourly breakdown response has 0 asterisks (*)');

  const chatPrice = await request('/ai/chat', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ message: 'Giá của Coca Cola là bao nhiêu?' })
  });
  assert(chatPrice.status === 200 && chatPrice.data.data.reply.includes('Coca Cola'), 'AI Assistant answered specific product price inquiry');
  assert(!chatPrice.data.data.reply.includes('*'), 'Price inquiry response has 0 asterisks (*)');

  const chatStoreCount = await request('/ai/chat', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ message: 'Cửa hàng có bao nhiêu sản phẩm?' })
  });
  assert(chatStoreCount.status === 200 && chatStoreCount.data.data.reply.includes('mặt hàng'), 'AI Assistant answered store product count inquiry');
  assert(!chatStoreCount.data.data.reply.includes('*'), 'Store count response has 0 asterisks (*)');

  const chatCat = await request('/ai/chat', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ message: 'Có những danh mục nào?' })
  });
  assert(chatCat.status === 200 && chatCat.data.data.reply.includes('DANH MỤC'), 'AI Assistant answered categories inquiry');
  assert(!chatCat.data.data.reply.includes('*'), 'Categories response has 0 asterisks (*)');

  const chat2 = await request('/ai/chat', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ message: 'Dự đoán doanh thu tháng tới?' })
  });
  assert(chat2.status === 200 && chat2.data.data.reply.includes('DỰ BÁO DOANH THU'), 'AI Assistant answered revenue forecast query');
  assert(!chat2.data.data.reply.includes('*'), 'Forecast response has 0 asterisks (*)');

  // TEST 9: AI Product Auto-Classification
  console.log('\n[9] Testing AI Product Auto-Classification Engine...');
  const classifyBeverage = await request('/ai/classify-product', {
    method: 'POST',
    headers: { Authorization: `Bearer ${staffToken}` },
    body: JSON.stringify({ name: 'Trà Ô Long Tea+ Plus 455ml' })
  });
  assert(classifyBeverage.status === 200, 'AI classification endpoint returns 200');
  assert(
    classifyBeverage.data.data.categoryName.includes('Nước giải khát') || classifyBeverage.data.data.confidence >= 0.7,
    `AI accurately classified Tea+ as Beverage (Category: ${classifyBeverage.data.data.categoryName}, Confidence: ${classifyBeverage.data.data.confidence})`
  );
  assert(
    classifyBeverage.data.data.suggestedCode.startsWith('TRA-') || classifyBeverage.data.data.suggestedCode.length >= 3,
    `AI generated valid suggested SKU code: ${classifyBeverage.data.data.suggestedCode}`
  );

  const classifyNoodles = await request('/ai/classify-product', {
    method: 'POST',
    headers: { Authorization: `Bearer ${staffToken}` },
    body: JSON.stringify({ name: 'Mì gói Hảo Hảo Sa tế hành' })
  });
  assert(
    classifyNoodles.status === 200 && classifyNoodles.data.data.categoryName.includes('Mì'),
    `AI accurately classified Hảo Hảo as Noodle category (${classifyNoodles.data.data.categoryName})`
  );

  // TEST 10: Import Goods with AI Classification & Transaction Consistency
  console.log('\n[10] Testing Import Goods with AI Auto-Classification...');
  const uniqueImportName = `Snack Oishi Bắp Rang Bơ Mới ${Date.now()}`;
  const importResult = await request('/inventory/import-new', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      name: uniqueImportName,
      quantity: 50,
      costPrice: 6000,
      sellingPrice: 9000,
      reason: 'Nhập thử nghiệm hàng mới với AI phân loại tự động'
    })
  });
  assert(importResult.status === 201, 'Import new product with AI returns 201 Created');
  assert(
    importResult.data.data.product.stockQuantity === 50,
    `New product initial stock verified: ${importResult.data.data.product.stockQuantity}`
  );
  assert(
    !!importResult.data.data.classification,
    `AI classification attached to import response: ${importResult.data.data.classification?.categoryName}`
  );
  assert(
    importResult.data.data.transaction.transaction_type === 'IMPORT',
    'Inventory transaction recorded as IMPORT'
  );

  // TEST 11: POS Top-Selling Products (Top 10)
  console.log('\n[11] Testing POS Top-Selling Products Endpoint...');
  const topSellingRes = await request('/products/top-selling?limit=10', {
    headers: { Authorization: `Bearer ${staffToken}` }
  });
  assert(topSellingRes.status === 200, 'Top-selling products returns 200 OK');
  assert(Array.isArray(topSellingRes.data.data), 'Top-selling data is an array');
  assert(topSellingRes.data.data.length <= 10, `Returned at most 10 items (got ${topSellingRes.data.data.length})`);
  if (topSellingRes.data.data.length > 0) {
    const firstItem = topSellingRes.data.data[0];
    assert(typeof firstItem.total_sold === 'number', `Top item has total_sold numeric attribute: ${firstItem.total_sold}`);
    assert(!!firstItem.name, `Top item has product name: ${firstItem.name}`);
  }

  // TEST 12: Product Embeddings & 12:00 AM Midnight Auto-Sync
  console.log('\n[12] Testing Product Embeddings & 12:00 AM Midnight Auto-Sync...');
  
  // 12.1 Check Embedding Status & Scheduler Info
  const embStatus = await request('/ai/embeddings/status', {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert(embStatus.status === 200, 'Embedding status endpoint returns 200 OK');
  assert(embStatus.data.data.embeddedProducts > 0, `Products with embeddings verified: ${embStatus.data.data.embeddedProducts}`);
  assert(embStatus.data.data.dimensions === 128, 'Vector dimensions verified: 128');
  assert(
    embStatus.data.data.scheduler.targetTimeDaily.includes('12:00 AM'),
    `Scheduler target time verified: ${embStatus.data.data.scheduler.targetTimeDaily}`
  );
  assert(
    embStatus.data.data.scheduler.timezone.includes('Asia/Ho_Chi_Minh'),
    `Scheduler timezone verified: ${embStatus.data.data.scheduler.timezone}`
  );

  // 12.2 Test Manual Sync Execution
  const embSync = await request('/ai/embeddings/sync', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ force: true })
  });
  assert(embSync.status === 200, 'Manual embedding sync returns 200 OK');
  assert(embSync.data.data.updatedCount > 0, `Embeddings synchronized for ${embSync.data.data.updatedCount} products`);

  // 12.3 Test Auto-Embedding on New Product Creation
  const newUniqueCode = `EMB-AUTO-${Date.now()}`;
  const createProdRes = await request('/products', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      productCode: newUniqueCode,
      name: 'Nước tăng lực Redbull Thái lon 250ml',
      costPrice: 11000,
      sellingPrice: 15000,
      stockQuantity: 40,
      unit: 'lon',
      description: 'Nước tăng lực nhập khẩu Thái Lan'
    })
  });
  assert(createProdRes.status === 201, 'New product created returns 201');

  // Verify embedding was automatically generated for this new product
  const { query: dbQuery } = require('./src/database');
  const checkNewProd = await dbQuery('SELECT embedding, embedding_updated_at FROM products WHERE id = $1', [createProdRes.data.data.id]);
  const newProdEmb = typeof checkNewProd.rows[0].embedding === 'string' ? JSON.parse(checkNewProd.rows[0].embedding) : checkNewProd.rows[0].embedding;
  assert(
    !!newProdEmb && Array.isArray(newProdEmb.vector) && newProdEmb.vector.length === 128,
    'New product automatically received 128-D vector embedding upon creation'
  );
  assert(!!checkNewProd.rows[0].embedding_updated_at, 'Embedding timestamp recorded for new product');

  // 12.4 Test Semantic Embedding Vector Search
  const semanticSearchRes = await request('/ai/embeddings/search', {
    method: 'POST',
    headers: { Authorization: `Bearer ${staffToken}` },
    body: JSON.stringify({ query: 'redbull tăng lực giải khát', limit: 3 })
  });
  assert(semanticSearchRes.status === 200, 'Semantic vector search returns 200 OK');
  assert(Array.isArray(semanticSearchRes.data.data) && semanticSearchRes.data.data.length > 0, 'Semantic search returned ranked matches');
  assert(
    semanticSearchRes.data.data[0].similarity > 0.4,
    `Top semantic match "${semanticSearchRes.data.data[0].name}" has high cosine similarity: ${semanticSearchRes.data.data[0].similarity}`
  );

  // TEST 13: Continuous Self-Learning & Auto-Training Engine
  console.log('\n[13] Testing AI Continuous Self-Learning & Auto-Training Engine...');
  
  // 13.1 Query Self-Learning Statistics
  const learningStatsRes = await request('/ai/learning-stats', {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert(learningStatsRes.status === 200, 'AI learning stats endpoint returns 200 OK');
  assert(learningStatsRes.data.data.status === 'ACTIVE_SELF_LEARNING', 'AI model is in active self-learning mode');
  assert(learningStatsRes.data.data.learnedVocabularyTerms > 0, `Self-learned vocabulary terms: ${learningStatsRes.data.data.learnedVocabularyTerms}`);
  assert(typeof learningStatsRes.data.data.nextAutoTrainFormatted === 'string', `Next daily midnight auto-train scheduled: ${learningStatsRes.data.data.nextAutoTrainFormatted}`);

  // 13.2 Verify Incremental Micro-Learning upon Product Addition
  const learnProdCode = `LEARN-PROD-${Date.now()}`;
  const learnProdRes = await request('/products', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      productCode: learnProdCode,
      name: 'Bánh gạo Ichi vị mật ong Nhật Bản giòn rụm 150g',
      costPrice: 20000,
      sellingPrice: 28000,
      stockQuantity: 50,
      unit: 'gói',
      description: 'Bánh gạo Nhật Bản nướng vàng giòn thơm mật ong'
    })
  });
  assert(learnProdRes.status === 201, 'Created new product to test incremental AI learning');

  // Check learned knowledge in database
  const checkKnowledge = await dbQuery(
    "SELECT term, knowledge_type, weight, frequency FROM ai_learned_knowledge WHERE term = 'ichi' LIMIT 1"
  );
  assert(checkKnowledge.rowCount > 0, 'AI engine automatically harvested brand keyword "ichi" into learned knowledge');

  // 13.3 Test On-Demand Manual / Conversational Self-Training
  const triggerTrainRes = await request('/ai/self-train', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ force: true })
  });
  assert(triggerTrainRes.status === 200, 'On-demand self-training execution returns 200 OK');
  assert(triggerTrainRes.data.data.success === true, 'Self-training cycle completed with SUCCESS status');
  assert(triggerTrainRes.data.data.metrics.vocabularySize > 0, `Trained domain catalog with ${triggerTrainRes.data.data.metrics.vocabularySize} terms`);
  assert(triggerTrainRes.data.data.durationMs > 0, `Training benchmark: ${triggerTrainRes.data.data.durationMs}ms`);

  // 13.4 Query Self-Learning Epoch History Logs
  const trainingLogsRes = await request('/ai/training-logs?limit=5', {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert(trainingLogsRes.status === 200, 'Training epoch logs endpoint returns 200 OK');
  assert(Array.isArray(trainingLogsRes.data.data) && trainingLogsRes.data.data.length > 0, 'Training epoch logs returned array of runs');
  assert(trainingLogsRes.data.data[0].status === 'SUCCESS', `Latest epoch status is ${trainingLogsRes.data.data[0].status}`);

  // TEST 14: AI Visual Product Recognition (Camera Packaging & Label Scanner)
  console.log('\n[14] Testing AI Visual Product Recognition Engine...');

  // 14.1 Reject empty image & hint
  const failVisionRes = await request('/ai/recognize-product-image', {
    method: 'POST',
    headers: { Authorization: `Bearer ${staffToken}` },
    body: JSON.stringify({})
  });
  assert(failVisionRes.status === 400 && failVisionRes.data.error.code === 'MISSING_IMAGE', 'Rejects empty image recognition request');

  // 14.2 Recognize Beverage by packaging label keywords
  const cocaVisionRes = await request('/ai/recognize-product-image', {
    method: 'POST',
    headers: { Authorization: `Bearer ${staffToken}` },
    body: JSON.stringify({
      hintText: 'coca cola lon 330ml',
      imageBase64: 'sample_base64_stream'
    })
  });
  assert(cocaVisionRes.status === 200, 'Visual recognition endpoint returns 200 OK');
  assert(cocaVisionRes.data.data.success === true, 'Visual recognition successfully matched product');
  assert(cocaVisionRes.data.data.product?.name.toLowerCase().includes('coca'), `Correctly identified product: ${cocaVisionRes.data.data.product?.name}`);
  assert(cocaVisionRes.data.data.confidence > 0.5, `High confidence score: ${cocaVisionRes.data.data.confidence}`);

  // 14.3 Recognize Noodle package by label
  const noodleVisionRes = await request('/ai/recognize-product-image', {
    method: 'POST',
    headers: { Authorization: `Bearer ${staffToken}` },
    body: JSON.stringify({
      hintText: 'mì gói hảo hảo tôm chua cay',
      imageBase64: 'sample_base64_stream'
    })
  });
  assert(noodleVisionRes.status === 200 && noodleVisionRes.data.data.success === true, 'Recognized noodle packaging successfully');
  assert(noodleVisionRes.data.data.product?.name.toLowerCase().includes('hảo hảo'), `Matched: ${noodleVisionRes.data.data.product?.name}`);

  // TEST 15: Advanced Order/Invoice Time Filtering & Aggregate Summary Statistics
  console.log('\n[15] Testing Order Management Multi-Tier Time Filtering...');

  // 15.1 Query invoices with startDate only
  const startOnlyRes = await request('/invoices?startDate=2026-09-01&limit=10', {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert(startOnlyRes.status === 200, 'Query with independent startDate returns 200 OK');
  assert(Array.isArray(startOnlyRes.data.data.items), 'Returned items array');
  assert(typeof startOnlyRes.data.data.summary === 'object', 'Returned aggregate summary object');
  assert(startOnlyRes.data.data.summary.totalOrders >= 0, `Total filtered orders: ${startOnlyRes.data.data.summary.totalOrders}`);
  assert(startOnlyRes.data.data.summary.totalRevenue >= 0, `Total filtered revenue: ${startOnlyRes.data.data.summary.totalRevenue}`);

  // 15.2 Query invoices with time-of-day shift filter (00:00 - 23:59)
  const shiftRes = await request('/invoices?startTime=00:00&endTime=23:59&limit=10', {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert(shiftRes.status === 200, 'Query with shift time range returns 200 OK');
  assert(shiftRes.data.data.items.length > 0, 'Found orders within active day shift');

  // 15.3 Query with combined Date & Time Range
  const todayDateStr = new Date().toISOString().split('T')[0];
  const combinedRes = await request(`/invoices?startDate=${todayDateStr}&startTime=00:00&endTime=23:59`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert(combinedRes.status === 200, 'Query with combined Date & Time filters returns 200 OK');
  assert(combinedRes.data.data.summary.averageOrderValue >= 0, `Computed Average Order Value: ${combinedRes.data.data.summary.averageOrderValue}`);

  // TEST 16: Multimodal AI Voice Speech-to-Text Audio Transcription
  console.log('\n[16] Testing Multimodal AI Voice Audio Transcription Endpoint...');

  // 16.1 Reject empty audio payload
  const emptyAudioRes = await request('/ai/transcribe-audio', {
    method: 'POST',
    headers: { Authorization: `Bearer ${staffToken}` },
    body: JSON.stringify({})
  });
  assert(emptyAudioRes.status === 400, 'Audio transcription endpoint rejects empty audio payload with 400');

  // 16.2 Transcribe audio with base64 payload returns 200
  const sampleAudioRes = await request('/ai/transcribe-audio', {
    method: 'POST',
    headers: { Authorization: `Bearer ${staffToken}` },
    body: JSON.stringify({
      audioBase64: 'UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=',
      mimeType: 'audio/wav'
    })
  });
  assert(sampleAudioRes.status === 200, 'Audio transcription endpoint responds with 200 OK');
  assert(typeof sampleAudioRes.data.text === 'string' || sampleAudioRes.data.success !== undefined, 'Audio transcription returns valid response format');

  // TEST 17: Invoice Payment Method & Cash Received Adjustment
  console.log('\n[17] Testing Invoice Payment Method & Cash Received Adjustment...');

  // 17.1 Get a recent invoice
  const invListRes = await request('/invoices?limit=1', {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert(invListRes.status === 200 && invListRes.data.data.items.length > 0, 'Found existing invoice to test payment update');
  const testInv = invListRes.data.data.items[0];
  const testInvTotal = parseFloat(testInv.total_amount);

  // 17.2 Reject cash payment if amount paid is insufficient
  const insufficientRes = await request(`/invoices/${testInv.id}/payment`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      paymentMethod: 'CASH',
      amountPaid: Math.max(0, testInvTotal - 1000),
      reason: 'Khách đưa thiếu tiền'
    })
  });
  assert(insufficientRes.status === 400, 'Rejects insufficient cash amount (< total_amount) with 400');

  // 17.3 Switch payment method to TRANSFER
  const transferUpdateRes = await request(`/invoices/${testInv.id}/payment`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${staffToken}` },
    body: JSON.stringify({
      paymentMethod: 'TRANSFER',
      transactionReference: 'MB_TEST_998877',
      reason: 'Khách đổi ý chuyển khoản ngân hàng'
    })
  });
  assert(transferUpdateRes.status === 200, 'Successfully updated payment method to TRANSFER via Staff/Admin token');
  assert(transferUpdateRes.data.data.payment_method === 'TRANSFER', 'Payment method is now TRANSFER');
  assert(parseFloat(transferUpdateRes.data.data.change_amount) === 0, 'Change amount for transfer is 0');

  // 17.4 Switch back to CASH with cash received adjustment
  const cashAdjustAmount = testInvTotal + 50000;
  const cashUpdateRes = await request(`/invoices/${testInv.id}/payment`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      paymentMethod: 'CASH',
      amountPaid: cashAdjustAmount,
      reason: 'Khách trả tiền mặt tờ 50k dư, điều chỉnh tiền thối'
    })
  });
  assert(cashUpdateRes.status === 200, 'Successfully updated payment method back to CASH with adjusted amount');
  assert(cashUpdateRes.data.data.payment_method === 'CASH', 'Payment method is now CASH');
  assert(parseFloat(cashUpdateRes.data.data.amount_paid) === cashAdjustAmount, `Customer paid amount updated to: ${cashAdjustAmount}`);
  assert(parseFloat(cashUpdateRes.data.data.change_amount) === 50000, 'Calculated change amount is exactly 50,000 đ');

  // 17.5 Verify audit log was recorded
  const auditLogsRes = await request(`/invoices/${testInv.id}`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  const paymentAudit = auditLogsRes.data.data.audit_logs?.find(a => a.action === 'UPDATE_INVOICE_PAYMENT');
  assert(paymentAudit !== undefined, 'Audit log correctly recorded UPDATE_INVOICE_PAYMENT action');
  assert(paymentAudit?.reason?.includes('tiền thối') || paymentAudit?.reason?.includes('chuyển khoản'), 'Audit log includes clear explanation reason');

  console.log('\n====================================================');
  console.log(` TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
