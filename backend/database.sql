-- ==============================================================================
-- GROCERY STORE MANAGEMENT SYSTEM & POS
-- NEON POSTGRESQL COMPLETE DATABASE INITIALIZATION SCRIPT
-- ==============================================================================
-- Hướng dẫn: Bạn có thể copy toàn bộ nội dung file này và paste vào
-- mục "SQL Editor" trên trang quản trị Neon Console (https://console.neon.tech)
-- rồi bấm nút "RUN" để khởi tạo toàn bộ CSDL và dữ liệu mẫu trong 1 giây.
-- ==============================================================================

-- 1. Bật Extension hỗ trợ sinh mã UUID ngẫu nhiên
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 2. TẠO CÁC BẢNG DỮ LIỆU CỐT LÕI (CORE TABLES)
-- ==============================================================================

-- Bảng Người dùng & Phân quyền (RBAC: SUPER_ADMIN, ADMIN, STAFF)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    role VARCHAR(20) NOT NULL CHECK (role IN ('SUPER_ADMIN', 'ADMIN', 'STAFF')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Bảng Refresh Tokens (Quản lý phiên đăng nhập an toàn)
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Bảng Nhật ký Đăng nhập
CREATE TABLE IF NOT EXISTS login_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    username VARCHAR(50) NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    status VARCHAR(20) NOT NULL CHECK (status IN ('SUCCESS', 'FAILED')),
    failure_reason TEXT,
    location_region VARCHAR(100),
    location_city VARCHAR(100),
    location_country VARCHAR(50),
    location_details JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Bảng Danh mục Hàng hóa
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Bảng Sản phẩm (Hỗ trợ hình ảnh rõ nét, mã vạch và QR)
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    category_id UUID REFERENCES categories(id) ON DELETE RESTRICT,
    description TEXT,
    image_url TEXT,
    cost_price NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (cost_price >= 0),
    selling_price NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (selling_price >= 0),
    stock_quantity INT NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0), -- CHẶN ÂM KHO
    minimum_stock INT NOT NULL DEFAULT 5 CHECK (minimum_stock >= 0),
    unit VARCHAR(50) NOT NULL DEFAULT 'cái',
    barcode VARCHAR(100) UNIQUE,
    qr_code_token VARCHAR(255) UNIQUE,
    has_qr BOOLEAN NOT NULL DEFAULT TRUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Bảng Hóa đơn bán hàng (Immutable Invoices với Idempotency Key)
CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_code VARCHAR(50) UNIQUE NOT NULL,
    cashier_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    subtotal NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
    discount_amount NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
    tax_amount NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
    final_amount NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (final_amount >= 0),
    payment_method VARCHAR(20) NOT NULL CHECK (payment_method IN ('CASH', 'TRANSFER', 'OTHER')),
    cash_received NUMERIC(15,2) DEFAULT 0,
    cash_returned NUMERIC(15,2) DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'COMPLETED' CHECK (status IN ('COMPLETED', 'ADJUSTED', 'CANCELLED')),
    idempotency_key VARCHAR(100) UNIQUE, -- Chống tạo trùng đơn hàng
    notes TEXT,
    adjusted_reason TEXT,
    adjusted_by UUID REFERENCES users(id) ON DELETE SET NULL,
    adjusted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Bảng Chi tiết từng món trong hóa đơn
CREATE TABLE IF NOT EXISTS invoice_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    product_code VARCHAR(50) NOT NULL,
    product_name VARCHAR(255) NOT NULL,
    unit VARCHAR(50) NOT NULL,
    unit_cost NUMERIC(15,2) NOT NULL DEFAULT 0,
    unit_price NUMERIC(15,2) NOT NULL DEFAULT 0,
    quantity INT NOT NULL CHECK (quantity > 0),
    total_price NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (total_price >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Bảng Sổ cái biến động kho hàng (Double-Entry Inventory Ledger)
CREATE TABLE IF NOT EXISTS inventory_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('IMPORT', 'SALE', 'ADJUSTMENT', 'DAMAGE', 'RETURN')),
    quantity_before INT NOT NULL,
    quantity_change INT NOT NULL,
    quantity_after INT NOT NULL,
    unit_cost NUMERIC(15,2) DEFAULT 0,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    reference_id VARCHAR(100),
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Bảng Nhật ký kiểm toán bất biến (Audit Logs)
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(100) NOT NULL,
    old_values JSONB,
    new_values JSONB,
    reason TEXT,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 3. THIẾT LẬP CHỈ MỤC TỐI ƯU TÌM KIẾM (INDEXES)
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode) WHERE barcode IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_qr_token ON products(qr_code_token) WHERE qr_code_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_name_trgm ON products(name);
CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON invoices(created_at);
CREATE INDEX IF NOT EXISTS idx_invoices_cashier ON invoices(cashier_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_product ON invoice_items(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_product_date ON inventory_transactions(product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- ==============================================================================
-- 4. KHỞI TẠO DỮ LIỆU BAN ĐẦU (SEED DATA CHO NEON)
-- ==============================================================================

-- 4.1 Tạo tài khoản quản trị mặc định (Mật khẩu đã mã hóa Argon2id an toàn)
-- Tài khoản 1: admin / Admin@123 (Role: SUPER_ADMIN)
-- Tài khoản 2: nhanvien1 / Admin@123 (Role: ADMIN / Cashier)
INSERT INTO users (id, username, email, password_hash, full_name, phone, role, is_active)
VALUES 
    ('a0000000-0000-0000-0000-000000000001', 'admin', 'admin@grocerystore.vn', '$argon2id$v=19$m=19456,t=2,p=1$HiuSGX25YHExggD4Jj+UQg$/SOaxLVrf71OzCKOUxmDHxmENMHE5to26uhTfaSCszw', 'Quản Trị Viên Cửa Hàng', '0901234567', 'SUPER_ADMIN', TRUE),
    ('a0000000-0000-0000-0000-000000000002', 'nhanvien1', 'staff1@grocerystore.vn', '$argon2id$v=19$m=19456,t=2,p=1$HiuSGX25YHExggD4Jj+UQg$/SOaxLVrf71OzCKOUxmDHxmENMHE5to26uhTfaSCszw', 'Nguyễn Văn Bán Hàng', '0987654321', 'ADMIN', TRUE)
ON CONFLICT (username) DO NOTHING;

-- 4.2 Tạo Danh mục hàng hóa mẫu
INSERT INTO categories (id, name, slug, description, is_active)
VALUES
    ('c0000000-0000-0000-0000-000000000001', 'Nước giải khát', 'nuoc-giai-khat', 'Các loại nước ngọt, nước tăng lực, nước suối', TRUE),
    ('c0000000-0000-0000-0000-000000000002', 'Mì & Bún khô', 'mi-bun-kho', 'Mì tôm, bún, miến ăn liền', TRUE),
    ('c0000000-0000-0000-0000-000000000003', 'Bánh kẹo & Snack', 'banh-keo-snack', 'Snack khoai tây, bánh quy, kẹo ngậm', TRUE),
    ('c0000000-0000-0000-0000-000000000004', 'Sữa & Sản phẩm từ sữa', 'sua', 'Sữa chua, sữa tươi, phô mai', TRUE),
    ('c0000000-0000-0000-0000-000000000005', 'Gia vị & Dầu ăn', 'gia-vi-dau-an', 'Hạt nêm, nước mắm, dầu ăn thực vật', TRUE),
    ('c0000000-0000-0000-0000-000000000006', 'Đồ uống tươi pha chế', 'do-uong-tuoi', 'Nước mía, nước cam ép trực tiếp tại quầy', TRUE)
ON CONFLICT (name) DO NOTHING;

-- 4.3 Tạo Danh mục sản phẩm có hình ảnh rõ nét và mã QR bảo mật
INSERT INTO products (
    id, product_code, name, category_id, description, image_url,
    cost_price, selling_price, stock_quantity, minimum_stock, unit,
    qr_code_token, has_qr, is_active, created_by
)
VALUES
    (
        'b0000000-0000-0000-0000-000000000001',
        'NUOC-COCA-330',
        'Coca Cola lon 330ml',
        'c0000000-0000-0000-0000-000000000001',
        'Nước ngọt có ga giải khát vị nguyên bản',
        'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=500&auto=format&fit=crop&q=80',
        8000, 10000, 50, 10, 'lon',
        'QR_COCA_330_DEFAULT', TRUE, TRUE, 'a0000000-0000-0000-0000-000000000001'
    ),
    (
        'b0000000-0000-0000-0000-000000000002',
        'NUOC-PEPSI-330',
        'Pepsi lon 330ml',
        'c0000000-0000-0000-0000-000000000001',
        'Nước ngọt Pepsi vị sảng khoái',
        'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=500&auto=format&fit=crop&q=80',
        8000, 10000, 45, 10, 'lon',
        'QR_PEPSI_330_DEFAULT', TRUE, TRUE, 'a0000000-0000-0000-0000-000000000001'
    ),
    (
        'b0000000-0000-0000-0000-000000000003',
        'NUOC-AQUAFINA-500',
        'Nước khoáng Aquafina 500ml',
        'c0000000-0000-0000-0000-000000000001',
        'Nước uống tinh khiết Aquafina đóng chai',
        'https://images.unsplash.com/photo-1548839140-29a749e1bc4e?w=500&auto=format&fit=crop&q=80',
        4000, 6000, 80, 15, 'chai',
        'QR_AQUAFINA_500_DEFAULT', TRUE, TRUE, 'a0000000-0000-0000-0000-000000000001'
    ),
    (
        'b0000000-0000-0000-0000-000000000004',
        'MI-HAOHAO-001',
        'Mì Hảo Hảo tôm chua cay',
        'c0000000-0000-0000-0000-000000000002',
        'Mì ăn liền Hảo Hảo vị chua cay truyền thống',
        'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=500&auto=format&fit=crop&q=80',
        3500, 4500, 120, 20, 'gói',
        'QR_HAOHAO_001_DEFAULT', TRUE, TRUE, 'a0000000-0000-0000-0000-000000000001'
    ),
    (
        'b0000000-0000-0000-0000-000000000005',
        'MI-OMACHI-SGB',
        'Mì Omachi xốt bò hầm',
        'c0000000-0000-0000-0000-000000000002',
        'Mì khoai tây Omachi cao cấp vị xốt bò',
        'https://images.unsplash.com/photo-1612927601601-6638404737ce?w=500&auto=format&fit=crop&q=80',
        6800, 8500, 60, 15, 'gói',
        'QR_OMACHI_SGB_DEFAULT', TRUE, TRUE, 'a0000000-0000-0000-0000-000000000001'
    ),
    (
        'b0000000-0000-0000-0000-000000000006',
        'SUA-VINAMILK-180',
        'Lốc sữa tươi Vinamilk có đường 180ml',
        'c0000000-0000-0000-0000-000000000004',
        'Lốc 4 hộp sữa tươi tiệt trùng Vinamilk 180ml',
        'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=500&auto=format&fit=crop&q=80',
        27000, 32000, 35, 8, 'lốc',
        'QR_VINAMILK_180_DEFAULT', TRUE, TRUE, 'a0000000-0000-0000-0000-000000000001'
    ),
    (
        'b0000000-0000-0000-0000-000000000007',
        'BANH-CHOCORIE-01',
        'Bánh ChocoPie Orion hộp 6 cái',
        'c0000000-0000-0000-0000-000000000003',
        'Bánh phủ socola mềm nhân dẻo marshmallow',
        'https://images.unsplash.com/photo-1587314168485-3236d6710814?w=500&auto=format&fit=crop&q=80',
        29000, 35000, 25, 5, 'hộp',
        'QR_CHOCOPIE_01_DEFAULT', TRUE, TRUE, 'a0000000-0000-0000-0000-000000000001'
    ),
    (
        'b0000000-0000-0000-0000-000000000008',
        'SNACK-LAY-NATURAL',
        'Snack khoai tây Lay''s tự nhiên 54g',
        'c0000000-0000-0000-0000-000000000003',
        'Bim bim khoai tây giòn tan',
        'https://images.unsplash.com/photo-1566478989037-eec170784d0b?w=500&auto=format&fit=crop&q=80',
        9500, 12000, 40, 10, 'gói',
        'QR_LAYS_NATURAL_DEFAULT', TRUE, TRUE, 'a0000000-0000-0000-0000-000000000001'
    ),
    (
        'b0000000-0000-0000-0000-000000000009',
        'GIAVI-KNORR-400',
        'Hạt nêm Knorr thịt thăn 400g',
        'c0000000-0000-0000-0000-000000000005',
        'Hạt nêm từ thịt thăn, xương ống và tủy',
        'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=500&auto=format&fit=crop&q=80',
        32000, 38000, 20, 5, 'gói',
        'QR_KNORR_400_DEFAULT', TRUE, TRUE, 'a0000000-0000-0000-0000-000000000001'
    ),
    (
        'b0000000-0000-0000-0000-000000000010',
        'DAUAN-TUONGAN-1L',
        'Dầu ăn Tường An Cooking Oil 1L',
        'c0000000-0000-0000-0000-000000000005',
        'Dầu thực vật tinh luyện Tường An',
        'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=500&auto=format&fit=crop&q=80',
        42000, 48000, 4, 10, 'chai',
        'QR_TUONGAN_1L_DEFAULT', TRUE, TRUE, 'a0000000-0000-0000-0000-000000000001'
    ),
    -- Nhóm sản phẩm pha chế không dùng mã QR
    (
        'b0000000-0000-0000-0000-000000000011',
        'MON-NUOC-MIA-01',
        'Nước mía tươi ép ly lớn',
        'c0000000-0000-0000-0000-000000000006',
        'Nước mía tươi nguyên chất ép tại chỗ',
        'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=500&auto=format&fit=crop&q=80',
        4000, 12000, 100, 20, 'ly',
        NULL, FALSE, TRUE, 'a0000000-0000-0000-0000-000000000001'
    ),
    (
        'b0000000-0000-0000-0000-000000000012',
        'MON-CAM-VAT-01',
        'Nước cam vắt mật ong ly',
        'c0000000-0000-0000-0000-000000000006',
        'Cam sành tươi vắt kết hợp mật ong ngọt dịu',
        'https://images.unsplash.com/photo-1613478223719-2ab802602423?w=500&auto=format&fit=crop&q=80',
        9000, 20000, 50, 10, 'ly',
        NULL, FALSE, TRUE, 'a0000000-0000-0000-0000-000000000001'
    )
ON CONFLICT (product_code) DO UPDATE 
SET 
    image_url = EXCLUDED.image_url,
    name = EXCLUDED.name,
    selling_price = EXCLUDED.selling_price,
    cost_price = EXCLUDED.cost_price;

-- Migration columns for login_logs geolocation
ALTER TABLE login_logs ADD COLUMN IF NOT EXISTS location_region VARCHAR(100);
ALTER TABLE login_logs ADD COLUMN IF NOT EXISTS location_city VARCHAR(100);
ALTER TABLE login_logs ADD COLUMN IF NOT EXISTS location_country VARCHAR(50);
ALTER TABLE login_logs ADD COLUMN IF NOT EXISTS location_details JSONB;

-- ==============================================================================
-- HOÀN TẤT KHỞI TẠO CƠ SỞ DỮ LIỆU NEON POSTGRESQL!
-- ==============================================================================

