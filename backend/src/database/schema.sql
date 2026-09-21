-- Grocery Store Management System Database Schema (PostgreSQL 16+)
-- Timezone: Asia/Ho_Chi_Minh

-- Users table (RBAC: SUPER_ADMIN, ADMIN, STAFF)
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

-- Refresh Tokens table (For secure JWT token rotation)
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Login Logs table
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

-- Categories table
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Products table (Business Code vs UUID Primary Key)
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    category_id UUID REFERENCES categories(id) ON DELETE RESTRICT,
    description TEXT,
    image_url TEXT,
    cost_price NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (cost_price >= 0),
    selling_price NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (selling_price >= 0),
    stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
    minimum_stock INTEGER NOT NULL DEFAULT 5 CHECK (minimum_stock >= 0),
    unit VARCHAR(30) NOT NULL DEFAULT 'cái',
    qr_code_token VARCHAR(100) UNIQUE,
    has_qr BOOLEAN NOT NULL DEFAULT TRUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    embedding JSONB,
    embedding_updated_at TIMESTAMPTZ,
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Migration safety for existing tables
ALTER TABLE products ADD COLUMN IF NOT EXISTS embedding JSONB;
ALTER TABLE products ADD COLUMN IF NOT EXISTS embedding_updated_at TIMESTAMPTZ;

-- Inventory Transactions table (Stock History)
CREATE TABLE IF NOT EXISTS inventory_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    transaction_type VARCHAR(30) NOT NULL CHECK (transaction_type IN ('IMPORT', 'SALE', 'ADJUSTMENT', 'RETURN', 'DAMAGE', 'CORRECTION')),
    quantity_before INTEGER NOT NULL,
    quantity_change INTEGER NOT NULL,
    quantity_after INTEGER NOT NULL,
    unit_cost NUMERIC(15,2),
    user_id UUID REFERENCES users(id),
    reference_id VARCHAR(100),
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Invoices table (Immutable Financial Record with Idempotency)
CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number VARCHAR(50) UNIQUE NOT NULL,
    idempotency_key VARCHAR(100) UNIQUE,
    user_id UUID NOT NULL REFERENCES users(id),
    subtotal NUMERIC(15,2) NOT NULL CHECK (subtotal >= 0),
    discount_amount NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
    total_amount NUMERIC(15,2) NOT NULL CHECK (total_amount >= 0),
    status VARCHAR(20) NOT NULL DEFAULT 'COMPLETED' CHECK (status IN ('COMPLETED', 'ADJUSTED', 'CANCELLED')),
    notes TEXT,
    client_ip VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Invoice Items table (Snapshot of product information at sale time)
CREATE TABLE IF NOT EXISTS invoice_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE RESTRICT,
    product_id UUID REFERENCES products(id) ON DELETE RESTRICT,
    product_code VARCHAR(50) NOT NULL,
    product_name VARCHAR(255) NOT NULL,
    unit VARCHAR(30) NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(15,2) NOT NULL CHECK (unit_price >= 0),
    total_price NUMERIC(15,2) NOT NULL CHECK (total_price >= 0),
    cost_price NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (cost_price >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Payments table
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    payment_method VARCHAR(30) NOT NULL CHECK (payment_method IN ('CASH', 'TRANSFER', 'MOMO')),
    amount_due NUMERIC(15,2) NOT NULL CHECK (amount_due >= 0),
    amount_paid NUMERIC(15,2) NOT NULL CHECK (amount_paid >= 0),
    change_amount NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (change_amount >= 0),
    payment_status VARCHAR(20) NOT NULL DEFAULT 'PAID' CHECK (payment_status IN ('PAID', 'PENDING', 'REFUNDED')),
    transaction_reference VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Audit Logs table (Compliance & Accountability)
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(60) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(100) NOT NULL,
    old_values JSONB,
    new_values JSONB,
    reason TEXT,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- AI Forecasting Models table
CREATE TABLE IF NOT EXISTS forecast_models (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_version VARCHAR(50) NOT NULL,
    algorithm VARCHAR(50) NOT NULL,
    training_start_date DATE NOT NULL,
    training_end_date DATE NOT NULL,
    rmse_error NUMERIC(15,4),
    mape_error NUMERIC(15,4),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    parameters JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- AI Revenue Forecasts table
CREATE TABLE IF NOT EXISTS revenue_forecasts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_id UUID REFERENCES forecast_models(id) ON DELETE SET NULL,
    forecast_month VARCHAR(7) NOT NULL, -- Format: YYYY-MM
    predicted_revenue NUMERIC(15,2) NOT NULL,
    lower_bound NUMERIC(15,2),
    upper_bound NUMERIC(15,2),
    actual_revenue NUMERIC(15,2),
    evaluation_error NUMERIC(15,4),
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING_EVALUATION' CHECK (status IN ('PENDING_EVALUATION', 'EVALUATED', 'ARCHIVED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Chat Sessions table (AI Assistant)
CREATE TABLE IF NOT EXISTS chat_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL DEFAULT 'Phiên tư vấn mới',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Chat Messages table
CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    tool_calls JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_products_code ON products(product_code);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_qr ON products(qr_code_token);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active);

CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON invoices(created_at);
CREATE INDEX IF NOT EXISTS idx_invoices_number ON invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoices_user ON invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_idempotency ON invoices(idempotency_key);

CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_product ON invoice_items(product_id);

CREATE INDEX IF NOT EXISTS idx_inventory_tx_product ON inventory_transactions(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_tx_created ON inventory_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_inventory_tx_type ON inventory_transactions(transaction_type);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);

CREATE INDEX IF NOT EXISTS idx_login_logs_created ON login_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_login_logs_user ON login_logs(user_id);

-- Geolocation columns migration for login_logs
ALTER TABLE login_logs ADD COLUMN IF NOT EXISTS location_region VARCHAR(100);
ALTER TABLE login_logs ADD COLUMN IF NOT EXISTS location_city VARCHAR(100);
ALTER TABLE login_logs ADD COLUMN IF NOT EXISTS location_country VARCHAR(50);
ALTER TABLE login_logs ADD COLUMN IF NOT EXISTS location_details JSONB;

-- AI Continuous Learning Logs table
CREATE TABLE IF NOT EXISTS ai_training_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_type VARCHAR(50) NOT NULL,
    model_types TEXT[] NOT NULL,
    items_processed INT NOT NULL DEFAULT 0,
    metrics JSONB,
    insights JSONB,
    status VARCHAR(20) NOT NULL DEFAULT 'SUCCESS' CHECK (status IN ('SUCCESS', 'FAILED', 'IN_PROGRESS')),
    error_message TEXT,
    duration_ms INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- AI Learned Knowledge & Brand Associations table
CREATE TABLE IF NOT EXISTS ai_learned_knowledge (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    knowledge_type VARCHAR(50) NOT NULL,
    term VARCHAR(100) NOT NULL,
    category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
    weight NUMERIC(8,4) NOT NULL DEFAULT 1.0,
    frequency INT NOT NULL DEFAULT 1,
    source VARCHAR(50) NOT NULL DEFAULT 'PRODUCT_INGESTION',
    metadata JSONB,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(knowledge_type, term, category_id)
);

CREATE INDEX IF NOT EXISTS idx_ai_training_logs_created ON ai_training_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_learned_term ON ai_learned_knowledge(term);
CREATE INDEX IF NOT EXISTS idx_ai_learned_category ON ai_learned_knowledge(category_id);

