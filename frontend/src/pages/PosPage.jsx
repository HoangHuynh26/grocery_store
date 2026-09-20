import React, { useState, useEffect, useCallback } from 'react';
import { useCart } from '../contexts/CartContext';
import { useSocket } from '../contexts/SocketContext';
import { formatCurrency } from '../utils/formatters';
import api from '../services/api';
import confetti from 'canvas-confetti';
import { QrCode, Search, ShoppingBag, Plus, AlertTriangle, Check, RefreshCw, Package } from 'lucide-react';
import QrScannerModal from '../components/pos/QrScannerModal';
import CartDrawer from '../components/pos/CartDrawer';
import ReceiptModal from '../components/pos/ReceiptModal';

export default function PosPage() {
  const { addToCart, totalUnits, totalAmount } = useCart();
  const { lastStockUpdate } = useSocket();

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);
  const [completedInvoice, setCompletedInvoice] = useState(null);
  const [addedAnimationId, setAddedAnimationId] = useState(null);

  // Fetch products and categories
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [prodRes, catRes] = await Promise.all([
        api.get('/products?limit=100'),
        api.get('/categories')
      ]);
      setProducts(prodRes.data?.items || []);
      setCategories(catRes.data || []);
    } catch (err) {
      console.error('Load POS data error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Realtime stock synchronization when another admin sells or imports
  useEffect(() => {
    if (lastStockUpdate?.data) {
      const updates = Array.isArray(lastStockUpdate.data) ? lastStockUpdate.data : [lastStockUpdate.data];
      const updateMap = new Map(updates.map(u => [u.productId, u.currentStock]));

      setProducts(prev => prev.map(p => {
        if (updateMap.has(p.id)) {
          return {
            ...p,
            stock_quantity: updateMap.get(p.id)
          };
        }
        return p;
      }));
    }
  }, [lastStockUpdate]);

  const handleProductAdd = (product) => {
    if (product.stock_quantity <= 0) return;
    addToCart(product, 1);

    // Quick visual feedback
    setAddedAnimationId(product.id);
    setTimeout(() => setAddedAnimationId(null), 500);
  };

  const handleQrFound = (product) => {
    handleProductAdd(product);
  };

  const handleCheckoutSuccess = (invoice, isDuplicate) => {
    setCompletedInvoice(invoice);
    setIsMobileCartOpen(false);

    if (!isDuplicate) {
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 }
        });
      } catch (e) {
        // Ignore
      }
    }
    loadData(); // Refresh product stock list
  };

  const filteredProducts = products.filter((p) => {
    const matchesCat = selectedCategory === 'all' || p.category_id === selectedCategory;
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = !q ||
      p.name.toLowerCase().includes(q) ||
      p.product_code.toLowerCase().includes(q) ||
      (p.qr_code_token && p.qr_code_token.toLowerCase().includes(q));
    return matchesCat && matchesSearch;
  });

  return (
    <div className="pos-layout-wrapper">
      {/* Left Column: Product Catalog */}
      <div className={`pos-catalog-scroll ${totalUnits > 0 ? 'has-cart' : ''}`}>
        {/* Top Controls: Search Bar & QR Scanner Trigger */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <input
              type="text"
              className="form-control"
              style={{ paddingLeft: '38px', height: '42px', fontSize: '14px' }}
              placeholder="Tìm tên món, mã SP..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <Search size={17} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '12px' }} />
          </div>

          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setIsScannerOpen(true)}
            style={{ height: '42px', padding: '0 14px', flexShrink: 0, gap: '6px' }}
            title="Quét QR Camera"
          >
            <QrCode size={18} />
            <span style={{ fontWeight: 700, fontSize: '13px' }}>Quét QR</span>
          </button>
        </div>

        {/* Category Pills Bar (Smooth swipe, no scrollbar, zero clipping) */}
        <div className="category-pills-bar">
          <button
            type="button"
            className={`category-pill-btn btn ${selectedCategory === 'all' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setSelectedCategory('all')}
          >
            Tất cả ({products.length})
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              className={`category-pill-btn btn ${selectedCategory === cat.id ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setSelectedCategory(cat.id)}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Product Grid */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
            <RefreshCw size={28} className="spin" style={{ marginBottom: '12px' }} />
            <div>Đang tải danh mục sản phẩm...</div>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
            <ShoppingBag size={40} style={{ marginBottom: '12px', opacity: 0.4 }} />
            <div style={{ fontWeight: 600, fontSize: '16px' }}>Không tìm thấy sản phẩm phù hợp</div>
            <div style={{ fontSize: '13px', marginTop: '4px' }}>Thử tìm kiếm với từ khóa khác hoặc quét mã QR.</div>
          </div>
        ) : (
          <div className="pos-product-grid">
            {filteredProducts.map((p) => {
              const isOutOfStock = p.stock_quantity <= 0;
              const isLowStock = p.stock_quantity > 0 && p.stock_quantity <= p.minimum_stock;
              const isAdded = addedAnimationId === p.id;

              return (
                <div
                  key={p.id}
                  onClick={() => !isOutOfStock && handleProductAdd(p)}
                  style={{
                    backgroundColor: 'var(--bg-card)',
                    border: isAdded ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    cursor: isOutOfStock ? 'not-allowed' : 'pointer',
                    opacity: isOutOfStock ? 0.5 : 1,
                    transition: 'all 0.15s ease',
                    position: 'relative',
                    userSelect: 'none'
                  }}
                  className="product-card"
                >
                  {/* Stock & QR Badges */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{
                      fontSize: '11px',
                      padding: '2px 8px',
                      borderRadius: 'var(--radius-full)',
                      fontWeight: 600,
                      backgroundColor: isOutOfStock
                        ? 'var(--danger-bg)'
                        : (isLowStock ? 'var(--warning-bg)' : 'rgba(255,255,255,0.06)'),
                      color: isOutOfStock
                        ? 'var(--danger)'
                        : (isLowStock ? 'var(--warning)' : 'var(--text-secondary)')
                    }}>
                      {isOutOfStock ? 'Hết hàng' : `Còn ${p.stock_quantity} ${p.unit}`}
                    </span>

                    {p.has_qr && (
                      <span title="Có mã QR" style={{ color: 'var(--text-muted)' }}>
                        <QrCode size={13} />
                      </span>
                    )}
                  </div>

                  {/* Product Clear Image */}
                  <div
                    className="product-card-img-wrap"
                    style={{
                      width: '100%',
                      height: '105px',
                      borderRadius: '8px',
                      overflow: 'hidden',
                      backgroundColor: '#ffffff',
                      marginBottom: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '1px solid var(--border-color)',
                      boxShadow: '0 2px 5px rgba(0,0,0,0.06)'
                    }}
                  >
                    {p.image_url ? (
                      <img
                        src={p.image_url}
                        alt={p.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        loading="lazy"
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=200&auto=format&fit=crop&q=80';
                        }}
                      />
                    ) : (
                      <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                        <Package size={32} opacity={0.3} />
                      </div>
                    )}
                  </div>

                  {/* Name & Code */}
                  <div style={{ marginBottom: '10px' }}>
                    <div
                      className="product-name-clamp"
                      style={{
                        fontWeight: 700,
                        fontSize: '14px',
                        color: 'var(--text-primary)',
                        lineHeight: 1.3,
                        height: '36px',
                        overflow: 'hidden',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical'
                      }}
                    >
                      {p.name}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.product_code}
                    </div>
                  </div>

                  {/* Price & Add Action */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ fontWeight: 800, fontSize: '15px', color: 'var(--primary)' }}>
                      {formatCurrency(p.selling_price)}
                    </div>

                    <div style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '8px',
                      backgroundColor: isAdded ? 'var(--primary)' : 'var(--bg-card-secondary)',
                      color: isAdded ? '#fff' : 'var(--primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      {isAdded ? <Check size={16} /> : <Plus size={16} />}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Right Column: Desktop Cart Drawer */}
      <div style={{ width: '380px', display: 'none' }} className="desktop-cart-panel">
        <CartDrawer onCheckoutSuccess={handleCheckoutSuccess} />
      </div>

      {/* Floating Bottom Cart Bar for Mobile */}
      {totalUnits > 0 && (
        <div style={{
          position: 'fixed',
          bottom: 'calc(var(--mobile-nav-height) + env(safe-area-inset-bottom, 0px) + 10px)',
          left: '12px',
          right: '12px',
          backgroundColor: 'var(--primary)',
          color: '#ffffff',
          borderRadius: 'var(--radius-lg)',
          padding: '12px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 8px 24px rgba(16, 185, 129, 0.45)',
          zIndex: 750,
          cursor: 'pointer'
        }}
        className="mobile-cart-bar"
        onClick={() => setIsMobileCartOpen(true)}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              backgroundColor: '#ffffff',
              color: 'var(--primary)',
              borderRadius: 'var(--radius-full)',
              padding: '2px 9px',
              fontWeight: 800,
              fontSize: '13px'
            }}>
              {totalUnits}
            </span>
            <span style={{ fontWeight: 600, fontSize: '13px' }}>Món trong giỏ</span>
          </div>

          <div style={{ fontWeight: 800, fontSize: '16px' }}>
            {formatCurrency(totalAmount)}
          </div>
        </div>
      )}

      {/* Mobile Cart Full Sheet */}
      {isMobileCartOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'var(--bg-main)',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)'
        }}>
          <div style={{
            padding: '14px 18px',
            backgroundColor: 'var(--bg-card)',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <h3 style={{ fontSize: '16px' }}>Giỏ Hàng & Thanh Toán</h3>
            <button
              onClick={() => setIsMobileCartOpen(false)}
              className="btn btn-secondary"
              style={{ padding: '6px 14px', fontSize: '13px' }}
            >
              Đóng
            </button>
          </div>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <CartDrawer onCheckoutSuccess={handleCheckoutSuccess} />
          </div>
        </div>
      )}

      {/* QR Scanner Modal */}
      <QrScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onProductFound={handleQrFound}
      />

      {/* Receipt Modal */}
      <ReceiptModal
        isOpen={!!completedInvoice}
        onClose={() => setCompletedInvoice(null)}
        invoice={completedInvoice}
      />

      <style>{`
        @media (min-width: 1024px) {
          .desktop-cart-panel { display: flex !important; }
          .mobile-cart-bar { display: none !important; }
        }
        @media (max-width: 640px) {
          .product-card { padding: 9px !important; }
          .product-card-img-wrap { height: 92px !important; }
          .product-name-clamp { font-size: 13px !important; height: 32px !important; }
        }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
