import React from 'react';
import Modal from '../common/Modal';
import { formatCurrency, formatDateTime } from '../../utils/formatters';
import { Printer, CheckCircle } from 'lucide-react';

export default function ReceiptModal({ isOpen, onClose, invoice }) {
  if (!invoice) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Hóa Đơn Thanh Toán Thành Công" maxWidth="480px">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Printable Receipt Paper Container */}
        <div id="printable-receipt" style={{
          backgroundColor: '#ffffff',
          color: '#000000',
          padding: '24px 20px',
          borderRadius: '8px',
          fontFamily: 'monospace',
          fontSize: '13px',
          lineHeight: 1.4,
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          {/* Store Header */}
          <div style={{ textAlign: 'center', marginBottom: '16px' }}>
            <div style={{ fontSize: '16px', fontWeight: 'bold' }}>CỬA HÀNG TẠP HÓA THÔNG MINH</div>
            <div style={{ fontSize: '11px', color: '#555' }}>Địa chỉ: Hệ thống POS Bán Hàng</div>
            <div style={{ fontSize: '11px', color: '#555' }}>Hotline: 1900 xxxx</div>
            <div style={{ margin: '8px 0', borderBottom: '1px dashed #999' }} />
            <div style={{ fontSize: '14px', fontWeight: 'bold' }}>HÓA ĐƠN BÁN LẺ</div>
            <div style={{ fontSize: '12px' }}>Số: {invoice.invoice_number}</div>
            <div style={{ fontSize: '11px', color: '#666' }}>{formatDateTime(invoice.created_at)}</div>
          </div>

          {/* Items Table */}
          <div style={{ borderBottom: '1px dashed #999', paddingBottom: '8px', marginBottom: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', marginBottom: '4px' }}>
              <span style={{ flex: 2 }}>Tên món</span>
              <span style={{ width: '40px', textAlign: 'center' }}>SL</span>
              <span style={{ width: '70px', textAlign: 'right' }}>Đ.Giá</span>
              <span style={{ width: '80px', textAlign: 'right' }}>T.Tiền</span>
            </div>
            {invoice.items && invoice.items.map((item, idx) => (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', margin: '4px 0' }}>
                <span style={{ flex: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.product_name}
                </span>
                <span style={{ width: '40px', textAlign: 'center' }}>{item.quantity}</span>
                <span style={{ width: '70px', textAlign: 'right' }}>{new Intl.NumberFormat('vi-VN').format(item.unit_price)}</span>
                <span style={{ width: '80px', textAlign: 'right' }}>{new Intl.NumberFormat('vi-VN').format(item.total_price)}</span>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '15px' }}>
              <span>TỔNG CỘNG:</span>
              <span>{formatCurrency(invoice.total_amount)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Phương thức:</span>
              <span>{invoice.payment?.payment_method === 'CASH' ? 'Tiền mặt' : 'Chuyển khoản'}</span>
            </div>
            {invoice.payment?.payment_method === 'CASH' && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Tiền khách đưa:</span>
                  <span>{formatCurrency(invoice.payment.amount_paid)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Tiền thối lại:</span>
                  <span>{formatCurrency(invoice.payment.change_amount)}</span>
                </div>
              </>
            )}
          </div>

          <div style={{ margin: '14px 0', borderBottom: '1px dashed #999' }} />

          {/* Footer Note */}
          <div style={{ textAlign: 'center', fontSize: '11px', color: '#555' }}>
            <div>Cảm ơn Quý khách & Hẹn gặp lại!</div>
            <div>Hóa đơn điện tử lưu trữ trên hệ thống POS</div>
          </div>
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handlePrint}
          >
            <Printer size={16} />
            <span>In Hóa Đơn</span>
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={onClose}
          >
            <CheckCircle size={16} />
            <span>Hoàn Tất</span>
          </button>
        </div>
      </div>
    </Modal>
  );
}
