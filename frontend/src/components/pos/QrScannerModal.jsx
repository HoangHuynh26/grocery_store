import React, { useEffect, useRef, useState } from 'react';
import Modal from '../common/Modal';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, Search, AlertCircle } from 'lucide-react';
import api from '../../services/api';

export default function QrScannerModal({ isOpen, onClose, onProductFound }) {
  const [error, setError] = useState('');
  const [scanning, setScanning] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [searching, setSearching] = useState(false);
  const scannerRef = useRef(null);

  useEffect(() => {
    let html5QrCode = null;

    if (isOpen) {
      setError('');
      setScanning(true);

      const timer = setTimeout(() => {
        const qrContainer = document.getElementById('qr-reader-container');
        if (qrContainer) {
          html5QrCode = new Html5Qrcode('qr-reader-container');
          scannerRef.current = html5QrCode;

          html5QrCode
            .start(
              { facingMode: 'environment' },
              {
                fps: 10,
                qrbox: { width: 250, height: 250 }
              },
              async (decodedText) => {
                // Success scan
                try {
                  // Stop scanning immediately on detection
                  await html5QrCode.stop();
                } catch (e) {
                  // Ignore
                }
                handleTokenDetected(decodedText);
              },
              (errorMessage) => {
                // Ignore regular frame scan misses
              }
            )
            .catch((err) => {
              console.warn('Camera access error:', err);
              setError('Không thể mở camera. Bạn có thể nhập mã sản phẩm thủ công bên dưới.');
              setScanning(false);
            });
        }
      }, 200);

      return () => {
        clearTimeout(timer);
        if (scannerRef.current) {
          try {
            scannerRef.current.stop().then(() => scannerRef.current.clear());
          } catch (e) {
            // Ignore
          }
        }
      };
    }
  }, [isOpen]);

  const handleTokenDetected = async (token) => {
    try {
      setSearching(true);
      setError('');
      // Query product by QR token
      const res = await api.get(`/products/qr/${token}`);
      if (res.data) {
        onProductFound(res.data);
        onClose();
      }
    } catch (err) {
      setError(err.message || 'Không tìm thấy sản phẩm với mã QR này.');
      setScanning(false);
    } finally {
      setSearching(false);
    }
  };

  const handleManualSearch = async (e) => {
    e.preventDefault();
    if (!manualCode.trim()) return;

    try {
      setSearching(true);
      setError('');
      // Search by product code or name
      const res = await api.get(`/products?search=${encodeURIComponent(manualCode.trim())}&limit=1`);
      if (res.data?.items && res.data.items.length > 0) {
        onProductFound(res.data.items[0]);
        onClose();
      } else {
        setError(`Không tìm thấy sản phẩm với mã "${manualCode}".`);
      }
    } catch (err) {
      setError(err.message || 'Lỗi tìm kiếm sản phẩm.');
    } finally {
      setSearching(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Quét Mã QR Sản Phẩm">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Scanner Viewport */}
        <div style={{
          position: 'relative',
          backgroundColor: '#000',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          minHeight: '260px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          border: '2px dashed var(--border-color)'
        }}>
          <div id="qr-reader-container" style={{ width: '100%', height: '100%' }} />

          {!scanning && error && (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              <AlertCircle size={36} color="var(--warning)" style={{ marginBottom: '8px' }} />
              <div style={{ fontSize: '13px' }}>{error}</div>
            </div>
          )}
        </div>

        {/* Manual fallback search */}
        <form onSubmit={handleManualSearch} style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            className="form-control"
            placeholder="Hoặc nhập mã sản phẩm (vd: NUOC-COCA-330)..."
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
          />
          <button type="submit" className="btn btn-primary" disabled={searching}>
            <Search size={16} />
            <span>Tìm</span>
          </button>
        </form>

        <div style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center' }}>
          Hướng camera về phía mã QR trên bao bì sản phẩm để quét tự động.
        </div>
      </div>
    </Modal>
  );
}
