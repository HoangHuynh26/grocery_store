import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useCart } from '../contexts/CartContext';
import { useSocket } from '../contexts/SocketContext';
import { formatCurrency } from '../utils/formatters';
import api from '../services/api';
import confetti from 'canvas-confetti';
import { QrCode, Search, ShoppingBag, Plus, AlertTriangle, Check, RefreshCw, Package, Filter, ChevronDown, X, Flame, Sparkles, Zap, Camera } from 'lucide-react';
import QrScannerModal from '../components/pos/QrScannerModal';
import CartDrawer from '../components/pos/CartDrawer';
import ReceiptModal from '../components/pos/ReceiptModal';
import { playScanBeep } from '../utils/scannerAudio';

export default function PosPage() {
  const { addToCart, totalUnits, totalAmount } = useCart();
  const { lastStockUpdate } = useSocket();

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [topSellingProducts, setTopSellingProducts] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);
  const [completedInvoice, setCompletedInvoice] = useState(null);
  const [addedAnimationId, setAddedAnimationId] = useState(null);
  const [scanToast, setScanToast] = useState(null);

  // Fetch products, categories, and top-selling products
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [prodRes, catRes, topRes] = await Promise.all([
        api.get('/products?limit=100'),
        api.get('/categories'),
        api.get('/products/top-selling?limit=10')
      ]);
      setProducts(prodRes.data?.items || []);
      setCategories(catRes.data || []);
      setTopSellingProducts(topRes.data || []);
    } catch (err) {
      console.error('Load POS data error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleProductAdd = useCallback((product) => {
    if (product.stock_quantity <= 0) return;
    addToCart(product, 1);

    // Quick visual feedback
    setAddedAnimationId(product.id);
    setTimeout(() => setAddedAnimationId(null), 500);
  }, [addToCart]);

  // Direct Barcode/SKU scanning & auto add to cart
  const handleScanDirect = useCallback(async (code) => {
    if (!code) return;
    const cleanCode = code.trim().toLowerCase();

    // 1. Check local loaded products first (instant recognition!)
    let found = products.find(
      (p) =>
        (p.product_code && p.product_code.toLowerCase() === cleanCode) ||
        (p.qr_code_token && p.qr_code_token.toLowerCase() === cleanCode) ||
        (p.id && String(p.id).toLowerCase() === cleanCode)
    );

    // 2. If not found locally, query backend
    if (!found) {
      try {
        const res = await api.get(`/products/qr/${encodeURIComponent(code.trim())}`);
        found = res.data?.data || res.data;
      } catch (err) {
        // Not found
      }
    }

    if (found && found.id) {
      if (found.stock_quantity <= 0) {
        playScanBeep(false);
        setScanToast({
          type: 'warning',
          message: `Sản phẩm "${found.name}" đã hết hàng trong kho!`
        });
        setTimeout(() => setScanToast(null), 3000);
        return;
      }

      handleProductAdd(found);
      playScanBeep(true);
      setScanToast({
        type: 'success',
        message: `⚡ Đã thêm: ${found.name}`
      });
      setTimeout(() => setScanToast(null), 2500);
      setSearchQuery('');
    } else {
      playScanBeep(false);
      setScanToast({
        type: 'error',
        message: `Không tìm thấy sản phẩm với mã: "${code}"`
      });
      setTimeout(() => setScanToast(null), 3000);
    }
  }, [products, handleProductAdd]);

  // Global Hardware Barcode Gun Listener (Auto-detects rapid typing + Enter)
  useEffect(() => {
    let buffer = '';
    let lastKeyTime = Date.now();

    const handleKeyDown = async (e) => {
      // Don't capture when modal is active
      if (isScannerOpen || !!completedInvoice) return;

      const target = e.target;
      const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA');
      const currentTime = Date.now();
      const timeDiff = currentTime - lastKeyTime;
      lastKeyTime = currentTime;

      // Enter key signals end of barcode scan
      if (e.key === 'Enter') {
        const trimmedCode = buffer.trim();
        buffer = '';

        if (trimmedCode.length >= 2) {
          if (isInput) target.blur();
          await handleScanDirect(trimmedCode);
        }
        return;
      }

      // Barcode scanners type rapidly (< 60ms between keystrokes)
      if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        if (!isInput || timeDiff < 60) {
          if (timeDiff > 250) buffer = '';
          buffer += e.key;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleScanDirect, isScannerOpen, completedInvoice]);

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

      setTopSellingProducts(prev => prev.map(p => {
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

  const handleQrFound = (product) => {
    handleProductAdd(product);
    setScanToast({
      type: 'success',
      message: `⚡ Đã thêm: ${product.name}`
    });
    setTimeout(() => setScanToast(null), 2500);
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

  const categoryProductCounts = useMemo(() => {
    const counts = {};
    products.forEach((p) => {
      counts[p.category_id] = (counts[p.category_id] || 0) + 1;
    });
    return counts;
  }, [products]);

  const selectedCategoryName = useMemo(() => {
    if (selectedCategory === 'all') return 'Tất cả';
    const cat = categories.find((c) => c.id === selectedCategory);
    return cat ? cat.name : 'Danh mục';
  }, [selectedCategory, categories]);

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
      {/* Instant Scan Floating Toast Notification */}
      {scanToast && (
        <div style={{
          position: 'fixed',
          top: '84px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 9999,
          backgroundColor: scanToast.type === 'success' ? '#15803d' : (scanToast.type === 'warning' ? '#d97706' : '#dc2626'),
          color: '#ffffff',
          padding: '9px 18px',
          borderRadius: 'var(--radius-full)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
          fontWeight: 600,
          fontSize: '13px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          animation: 'slideDown 0.2s ease',
          pointerEvents: 'none'
        }}>
          <Zap size={16} color="#fef08a" />
          <span>{scanToast.message}</span>
        </div>
      )}

      {/* Left Column: Product Catalog */}
      <div className={`pos-catalog-scroll ${totalUnits > 0 ? 'has-cart' : ''}`}>
        {/* Top Controls: Search Bar, Category Popdown, and QR Scanner Trigger */}
        <div className="pos-controls-container">
          <div className="pos-controls-top-row" style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0, width: '100%' }}>
            <div className="pos-search-wrapper" style={{ position: 'relative', flex: 1, minWidth: 0 }}>
              <input
                type="text"
                className="form-control"
                style={{ paddingLeft: '38px', height: '42px', fontSize: '14px' }}
                placeholder="Tìm tên món, hoặc bắn mã vạch SP..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={async (e) => {
                  if (e.key === 'Enter' && searchQuery.trim()) {
                    e.preventDefault();
                    await handleScanDirect(searchQuery.trim());
                  }
                }}
              />
              <Search size={17} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '12px' }} />
            </div>

            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setIsScannerOpen(true)}
              style={{
                height: '42px',
                padding: '0 16px',
                flexShrink: 0,
                gap: '8px',
                whiteSpace: 'nowrap',
                display: 'inline-flex',
                alignItems: 'center',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.28)'
              }}
              title="Quét Sản Phẩm Tích Hợp: Nhận diện tự động cả Mã Vạch, QR Code & Bao Bì AI"
            >
              <Camera size={18} />
              <span style={{ fontWeight: 700, fontSize: '13px' }}>Quét SP (QR & Bao Bì AI)</span>
            </button>
          </div>

          {/* Category Popdown Selector (Requested by user: drop-down menu for clean & easy selection) */}
          <div className="pos-category-select-wrapper">
            <select
              className="form-control"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              style={{
                height: '42px',
                paddingLeft: '34px',
                paddingRight: '32px',
                fontSize: '13px',
                fontWeight: 600,
                backgroundColor: selectedCategory !== 'all' ? 'var(--primary-light)' : 'var(--bg-input)',
                borderColor: selectedCategory !== 'all' ? 'var(--primary)' : 'var(--border-color)',
                color: selectedCategory !== 'all' ? 'var(--primary)' : 'var(--text-primary)',
                cursor: 'pointer',
                appearance: 'none',
                WebkitAppearance: 'none',
                width: '100%',
                borderRadius: 'var(--radius-md)'
              }}
              title="Chọn danh mục sản phẩm"
            >
              <option value="all">Tất cả danh mục ({products.length} SP)</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name} ({categoryProductCounts[cat.id] || 0} SP)
                </option>
              ))}
            </select>
            <Filter
              size={15}
              color={selectedCategory !== 'all' ? 'var(--primary)' : 'var(--text-muted)'}
              style={{ position: 'absolute', left: '11px', top: '13px', pointerEvents: 'none' }}
            />
            <ChevronDown
              size={15}
              color={selectedCategory !== 'all' ? 'var(--primary)' : 'var(--text-muted)'}
              style={{ position: 'absolute', right: '11px', top: '13px', pointerEvents: 'none' }}
            />
          </div>
        </div>

        {/* Active Filter Chip when category is selected */}
        {selectedCategory !== 'all' && (
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: 'var(--primary-light)',
            border: '1px solid var(--primary-border)',
            color: 'var(--primary)',
            padding: '4px 12px',
            borderRadius: 'var(--radius-full)',
            fontSize: '12px',
            fontWeight: 600,
            marginBottom: '12px',
            alignSelf: 'flex-start'
          }}>
            <span>Đang lọc: {selectedCategoryName} ({filteredProducts.length} sản phẩm)</span>
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--primary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                padding: '0'
              }}
              title="Bỏ lọc danh mục"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Product Grid & Top Selling Shelf */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
            <RefreshCw size={28} className="spin" style={{ marginBottom: '12px' }} />
            <div>Đang tải danh mục sản phẩm...</div>
          </div>
        ) : (
          <>
            {/* Top 10 Best-Selling Products Section */}
            {!searchQuery && topSellingProducts.length > 0 && (
              <div className="pos-top-selling-section">
                <div className="pos-top-selling-header">
                  <div className="pos-top-selling-title">
                    <Flame size={18} color="#ea580c" />
                    <span>Sản Phẩm Bán Chạy Nhất</span>
                    <span className="pos-top-selling-badge">
                      <Sparkles size={11} />
                      Top {topSellingProducts.length}
                    </span>
                  </div>
                  <span style={{ fontSize: '11px', color: '#9a3412', fontWeight: 500 }}>
                    Chạm nhanh để thêm vào giỏ
                  </span>
                </div>

                <div className="pos-top-selling-scroll">
                  {topSellingProducts.map((p, idx) => {
                    const rank = idx + 1;
                    const isOutOfStock = p.stock_quantity <= 0;
                    const isLowStock = p.stock_quantity > 0 && p.stock_quantity <= p.minimum_stock;
                    const isAdded = addedAnimationId === p.id;
                    const rankClass = rank === 1 ? 'rank-1' : (rank === 2 ? 'rank-2' : (rank === 3 ? 'rank-3' : 'rank-other'));

                    return (
                      <div
                        key={`top-${p.id}`}
                        onClick={() => !isOutOfStock && handleProductAdd(p)}
                        className={`pos-top-selling-card ${isOutOfStock ? 'out-of-stock' : ''}`}
                        style={{
                          borderColor: isAdded ? 'var(--primary)' : undefined,
                          transform: isAdded ? 'scale(0.96)' : undefined
                        }}
                        title={isOutOfStock ? 'Hết hàng' : `Thêm "${p.name}" vào đơn`}
                      >
                        {/* Rank Badge */}
                        <span className={`pos-top-selling-rank ${rankClass}`}>
                          #{rank}
                        </span>

                        {/* Sales count badge */}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '4px' }}>
                          <span style={{
                            fontSize: '10px',
                            fontWeight: 700,
                            color: p.total_sold > 0 ? '#ea580c' : 'var(--text-muted)',
                            backgroundColor: p.total_sold > 0 ? '#ffedd5' : 'var(--bg-card-secondary)',
                            padding: '1px 6px',
                            borderRadius: 'var(--radius-full)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '2px'
                          }}>
                            {p.total_sold > 0 ? `Đã bán ${p.total_sold}` : 'Ưa chuộng'}
                          </span>
                        </div>

                        {/* Image / Icon */}
                        <div style={{
                          height: '62px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginBottom: '6px',
                          backgroundColor: 'var(--bg-app)',
                          borderRadius: 'var(--radius-sm)',
                          overflow: 'hidden'
                        }}>
                          {p.image_url ? (
                            <img
                              src={p.image_url}
                              alt={p.name}
                              style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }}
                            />
                          ) : (
                            <Package size={28} color="var(--text-muted)" style={{ opacity: 0.6 }} />
                          )}
                        </div>

                        {/* Name */}
                        <div
                          title={p.name}
                          style={{
                            fontSize: '12px',
                            fontWeight: 600,
                            color: 'var(--text-primary)',
                            lineHeight: '1.3',
                            height: '31px',
                            overflow: 'hidden',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            marginBottom: '6px'
                          }}
                        >
                          {p.name}
                        </div>

                        {/* Price & Action Row */}
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginTop: 'auto',
                          paddingTop: '4px',
                          borderTop: '1px dashed var(--border-color)'
                        }}>
                          <div>
                            <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--primary)' }}>
                              {formatCurrency(p.selling_price)}
                            </div>
                            <div style={{
                              fontSize: '10px',
                              fontWeight: 500,
                              color: isOutOfStock ? 'var(--danger)' : (isLowStock ? 'var(--warning)' : 'var(--text-muted)')
                            }}>
                              {isOutOfStock ? 'Hết hàng' : `Kho: ${p.stock_quantity}`}
                            </div>
                          </div>

                          <button
                            type="button"
                            disabled={isOutOfStock}
                            onClick={(e) => {
                              e.stopPropagation();
                              !isOutOfStock && handleProductAdd(p);
                            }}
                            style={{
                              width: '26px',
                              height: '26px',
                              borderRadius: '50%',
                              backgroundColor: isOutOfStock ? 'var(--border-color)' : 'var(--primary)',
                              color: '#ffffff',
                              border: 'none',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: isOutOfStock ? 'not-allowed' : 'pointer',
                              padding: 0,
                              flexShrink: 0
                            }}
                            title="Thêm vào đơn"
                          >
                            {isAdded ? <Check size={14} /> : <Plus size={14} />}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Catalog Section Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                {selectedCategory !== 'all' ? selectedCategoryName : 'Tất cả sản phẩm'}
                <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)', marginLeft: '6px' }}>
                  ({filteredProducts.length})
                </span>
              </span>
            </div>

            {filteredProducts.length === 0 ? (
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
                    userSelect: 'none',
                    minWidth: 0,
                    maxWidth: '100%',
                    boxSizing: 'border-box'
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
                        : (isLowStock ? 'var(--warning-bg)' : 'var(--bg-card-secondary)'),
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
                  <div style={{ marginBottom: '10px', minWidth: 0, width: '100%' }}>
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
                        WebkitBoxOrient: 'vertical',
                        wordBreak: 'break-word'
                      }}
                    >
                      {p.name}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%', display: 'block' }}>
                      {p.product_code}
                    </div>
                  </div>

                  {/* Price & Add Action */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px solid var(--border-color)', minWidth: 0, width: '100%' }}>
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
          </>
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
          .product-card { padding: 9px !important; min-width: 0 !important; max-width: 100% !important; width: 100% !important; box-sizing: border-box !important; }
          .product-card-img-wrap { height: 92px !important; }
          .product-name-clamp { font-size: 13px !important; height: 32px !important; }
        }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
