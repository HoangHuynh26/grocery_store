import React, { useState, useMemo } from 'react';
import { useCart } from '../../contexts/CartContext';
import { formatCurrency } from '../../utils/formatters';
import { Trash2, Plus, Minus, CreditCard, Banknote, CheckCircle, AlertTriangle, ArrowRight } from 'lucide-react';
import api from '../../services/api';

export default function CartDrawer({ onCheckoutSuccess }) {
  const { items, totalAmount, updateQuantity, removeFromCart, clearCart, idempotencyKey } = useCart();

  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [cashGiven, setCashGiven] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const changeAmount = useMemo(() => {
    const given = parseFloat(cashGiven) || 0;
    return Math.max(0, given - totalAmount);
  }, [cashGiven, totalAmount]);

  const setExactCash = () => {
    setCashGiven(String(totalAmount));
  };

  const addPresetCash = (amount) => {
    setCashGiven(String(amount));
  };

  const handleCheckout = async () => {
    if (items.length === 0) return;

    if (paymentMethod === 'CASH') {
      const given = parseFloat(cashGiven) || totalAmount;
      if (given < totalAmount) {
        setError(`Tiền khách đưa (${formatCurrency(given)}) chưa đủ tổng tiền đơn hàng (${formatCurrency(totalAmount)}).`);
        return;
      }
    }

    try {
      setLoading(true);
      setError('');

      const checkoutPayload = {
        items: items.map((i) => ({
          productId: i.product.id,
          quantity: i.quantity
        })),
        paymentMethod,
        amountPaid: paymentMethod === 'CASH' ? (parseFloat(cashGiven) || totalAmount) : totalAmount,
        notes,
        idempotencyKey
      };

      const res = await api.post('/pos/checkout', checkoutPayload, {
        headers: {
          'idempotency-key': idempotencyKey
        }
      });

      if (res.data) {
        clearCart();
        setCashGiven('');
        setNotes('');
        onCheckoutSuccess(res.data, res.isDuplicate);
      }
    } catch (err) {
      console.error('Checkout error:', err);
      setError(err.message || 'Lỗi thanh toán. Vui lòng kiểm tra lại.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      backgroundColor: 'var(--bg-card)',
      borderLeft: '1px solid var(--border-color)'
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 20px',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ fontWeight: 700, fontSize: '16px' }}>
          Đơn Hàng ({items.length} món)
        </div>
        {items.length > 0 && (
          <button
            onClick={clearCart}
            className="btn btn-secondary"
            style={{ padding: '6px 10px', fontSize: '12px', color: 'var(--text-muted)' }}
          >
            Xóa hết
          </button>
        )}
      </div>

      {/* Cart Items List */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}>
        {items.length === 0 ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: 'var(--text-muted)',
            textAlign: 'center',
            padding: '40px 20px'
          }}>
            <div style={{
              width: '60px',
              height: '60px',
              borderRadius: '50%',
              backgroundColor: 'var(--bg-card-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '12px'
            }}>
              🛒
            </div>
            <div style={{ fontWeight: 600, fontSize: '15px', color: 'var(--text-secondary)' }}>Giỏ hàng chưa có sản phẩm</div>
            <div style={{ fontSize: '13px', marginTop: '4px' }}>Quét mã QR hoặc bấm chọn sản phẩm để thêm vào đơn.</div>
          </div>
        ) : (
          items.map((item) => {
            const isLow = item.quantity >= item.product.stock_quantity;
            return (
              <div
                key={item.product.id}
                style={{
                  backgroundColor: 'var(--bg-card-secondary)',
                  borderRadius: 'var(--radius-md)',
                  padding: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  border: isLow ? '1px solid var(--warning)' : '1px solid var(--border-color)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>
                      {item.product.name}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      {item.product.product_code} • {formatCurrency(item.product.selling_price)} / {item.product.unit}
                    </div>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--primary)' }}>
                    {formatCurrency(item.product.selling_price * item.quantity)}
                  </div>
                </div>

                {isLow && (
                  <div style={{ fontSize: '11px', color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <AlertTriangle size={12} /> Kho chỉ còn {item.product.stock_quantity} {item.product.unit}
                  </div>
                )}

                {/* Quantity adjuster */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px' }}>
                  <button
                    onClick={() => removeFromCart(item.product.id)}
                    className="btn btn-secondary btn-icon"
                    style={{ width: '32px', height: '32px', color: 'var(--danger)' }}
                    title="Xóa món"
                  >
                    <Trash2 size={15} />
                  </button>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <button
                      onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                      className="btn btn-secondary btn-icon"
                      style={{ width: '32px', height: '32px' }}
                    >
                      <Minus size={15} />
                    </button>
                    <input
                      type="number"
                      min="1"
                      className="form-control"
                      style={{ width: '60px', textAlign: 'center', padding: '6px' }}
                      value={item.quantity}
                      onChange={(e) => updateQuantity(item.product.id, e.target.value)}
                    />
                    <button
                      onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                      className="btn btn-secondary btn-icon"
                      style={{ width: '32px', height: '32px' }}
                    >
                      <Plus size={15} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Checkout Section (Only visible if items in cart) */}
      {items.length > 0 && (
        <div style={{
          padding: '16px 20px',
          borderTop: '1px solid var(--border-color)',
          backgroundColor: 'var(--bg-card-secondary)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          {error && (
            <div style={{
              padding: '10px 14px',
              backgroundColor: 'var(--danger-bg)',
              border: '1px solid var(--danger)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--danger)',
              fontSize: '13px',
              fontWeight: 500
            }}>
              {error}
            </div>
          )}

          {/* Payment method toggle */}
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              PHƯƠNG THỨC THANH TOÁN
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <button
                type="button"
                className={`btn ${paymentMethod === 'CASH' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setPaymentMethod('CASH')}
                style={{ padding: '10px' }}
              >
                <Banknote size={16} />
                <span>Tiền mặt</span>
              </button>
              <button
                type="button"
                className={`btn ${paymentMethod === 'TRANSFER' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setPaymentMethod('TRANSFER')}
                style={{ padding: '10px' }}
              >
                <CreditCard size={16} />
                <span>Chuyển khoản</span>
              </button>
            </div>
          </div>

          {/* Cash details */}
          {paymentMethod === 'CASH' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                <input
                  type="number"
                  className="form-control"
                  placeholder="Khách đưa (đ)..."
                  value={cashGiven}
                  onChange={(e) => setCashGiven(e.target.value)}
                />
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={setExactCash}
                  style={{ whiteSpace: 'nowrap', fontSize: '13px' }}
                >
                  Đủ tiền
                </button>
              </div>

              {/* Quick Preset Buttons */}
              <div style={{ display: 'flex', gap: '6px', overflowX: 'auto' }}>
                {[50000, 100000, 200000, 500000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    className="btn btn-secondary"
                    style={{ padding: '4px 8px', fontSize: '11px', flexShrink: 0 }}
                    onClick={() => addPresetCash(amt)}
                  >
                    {amt / 1000}k
                  </button>
                ))}
              </div>

              {cashGiven && parseFloat(cashGiven) >= totalAmount && (
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--success)',
                  backgroundColor: 'var(--success-bg)',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-md)'
                }}>
                  <span>Tiền thối lại:</span>
                  <span>{formatCurrency(changeAmount)}</span>
                </div>
              )}
            </div>
          )}

          {/* Transfer instructions */}
          {paymentMethod === 'TRANSFER' && (
            <div style={{
              padding: '10px 12px',
              backgroundColor: 'var(--primary-light)',
              borderRadius: 'var(--radius-md)',
              fontSize: '12px',
              color: 'var(--primary)'
            }}>
              Khách quét mã QR ngân hàng hoặc chuyển khoản. Bấm xác nhận sau khi nhận được tiền.
            </div>
          )}

          {/* Total & Confirm Button */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingTop: '6px'
          }}>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>TỔNG CỘNG</div>
              <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)' }}>
                {formatCurrency(totalAmount)}
              </div>
            </div>

            <button
              type="button"
              className="btn btn-primary btn-lg"
              disabled={loading || items.length === 0}
              onClick={handleCheckout}
              style={{ minWidth: '160px' }}
            >
              {loading ? 'Đang xử lý...' : (
                <>
                  <span>THANH TOÁN</span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
