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

  // Successful Super Admin login
  const adminLogin = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ identifier: 'admin', password: 'Admin@123456' })
  });
  assert(adminLogin.status === 200 && adminLogin.data.data.user.role === 'SUPER_ADMIN', 'Super Admin login success');
  const adminToken = adminLogin.data.data.accessToken;

  // Successful Cashier login
  const staffLogin = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ identifier: 'nhanvien1', password: 'Staff@123456' })
  });
  assert(staffLogin.status === 200 && staffLogin.data.data.user.role === 'ADMIN', 'Cashier Admin login success');
  const staffToken = staffLogin.data.data.accessToken;

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
  const testIdempKey = `IDEMP_DOUBLE_CLICK_${Date.now()}`;
  const firstReq = await request('/pos/checkout', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}`, 'idempotency-key': testIdempKey },
    body: JSON.stringify({
      items: [{ productId: sampleProduct.id, quantity: 1 }],
      paymentMethod: 'CASH',
      amountPaid: 100000
    })
  });
  assert(firstReq.status === 200, 'First checkout with idempotency key succeeded');
  const firstInvoiceId = firstReq.data.data.id;

  // Immediate second duplicate submission with identical key
  const secondReq = await request('/pos/checkout', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}`, 'idempotency-key': testIdempKey },
    body: JSON.stringify({
      items: [{ productId: sampleProduct.id, quantity: 1 }],
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
  assert(chat1.status === 200 && chat1.data.data.reply.includes('Doanh thu:'), 'AI Assistant answered today revenue query');

  const chat2 = await request('/ai/chat', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ message: 'Dự đoán doanh thu tháng tới?' })
  });
  assert(chat2.status === 200 && chat2.data.data.reply.includes('Dự báo doanh thu'), 'AI Assistant answered revenue forecast query');

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
