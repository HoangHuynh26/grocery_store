const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

async function setupNeon() {
  const databaseUrl = process.env.DATABASE_URL;

  console.log('====================================================');
  console.log(' NEON POSTGRESQL AUTOMATED DATABASE SETUP           ');
  console.log('====================================================');

  if (!databaseUrl || (!databaseUrl.startsWith('postgres://') && !databaseUrl.startsWith('postgresql://'))) {
    console.error('\n❌ LỖI: Chưa cấu hình biến DATABASE_URL trong backend/.env!');
    console.error('👉 Vui lòng mở file backend/.env và gắn chuỗi kết nối Neon:');
    console.error('   DATABASE_URL=postgresql://user:password@ep-xyz.ap-southeast-1.aws.neon.tech/neondb?sslmode=require\n');
    process.exit(1);
  }

  const maskedUrl = databaseUrl.replace(/:[^:@]+@/, ':****@');
  console.log(`\n🔗 Kết nối tới Neon PostgreSQL: ${maskedUrl}`);

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  });

  try {
    const client = await pool.connect();
    console.log('✅ Đã kết nối thành công tới máy chủ Neon Cloud!');

    // Read root database.sql
    const sqlPath = path.resolve(__dirname, '../../database.sql');
    console.log(`📖 Đang đọc file cấu trúc database.sql: ${sqlPath}`);
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');

    console.log('🚀 Đang thực thi khởi tạo bảng, ràng buộc và dữ liệu mẫu trên Neon...');
    await client.query(sqlContent);
    console.log('✅ Thực thi SQL hoàn tất thành công!');

    // Verification queries
    const userCount = await client.query('SELECT COUNT(*) FROM users;');
    const prodCount = await client.query('SELECT COUNT(*) FROM products;');
    const catCount = await client.query('SELECT COUNT(*) FROM categories;');

    console.log('\n📊 THỐNG KÊ CƠ SỞ DỮ LIỆU TRÊN NEON:');
    console.log(`- Tài khoản người dùng : ${userCount.rows[0].count} (admin & nhanvien1)`);
    console.log(`- Danh mục hàng hóa    : ${catCount.rows[0].count} danh mục`);
    console.log(`- Sản phẩm kèm hình ảnh: ${prodCount.rows[0].count} sản phẩm`);

    client.release();
    await pool.end();

    console.log('\n🎉 CHÚC MỪNG: CƠ SỞ DỮ LIỆU NEON ĐÃ SẴN SÀNG CHO HỆ THỐNG POS!');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Lỗi trong quá trình khởi tạo Neon:', err.message);
    await pool.end();
    process.exit(1);
  }
}

setupNeon();
