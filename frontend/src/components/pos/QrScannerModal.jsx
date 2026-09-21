import React, { useEffect, useRef, useState } from 'react';
import Modal from '../common/Modal';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Camera, Search, AlertCircle, CheckCircle, Volume2, Sparkles, Repeat, X } from 'lucide-react';
import api from '../../services/api';
import { playScanBeep } from '../../utils/scannerAudio';

export default function QrScannerModal({ isOpen, onClose, onProductFound }) {
  const [error, setError] = useState('');
  const [scanning, setScanning] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [searching, setSearching] = useState(false);
  const [continuousMode, setContinuousMode] = useState(true);
  const [lastScannedProduct, setLastScannedProduct] = useState(null);
  const [scannedCount, setScannedCount] = useState(0);

  const scannerRef = useRef(null);
  const lastCodeRef = useRef({ code: '', time: 0 });
  const isProcessingRef = useRef(false);

  useEffect(() => {
    let html5QrCode = null;

    if (isOpen) {
      setError('');
      setScanning(true);
      setLastScannedProduct(null);
      setScannedCount(0);
      lastCodeRef.current = { code: '', time: 0 };
      isProcessingRef.current = false;

      const timer = setTimeout(() => {
        const qrContainer = document.getElementById('qr-reader-container');
        if (!qrContainer) return;

        try {
          // Support both Barcodes (1D) and QR codes (2D)
          const formatsToSupport = [
            Html5QrcodeSupportedFormats.QR_CODE,
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E
          ];

          html5QrCode = new Html5Qrcode('qr-reader-container', {
            formatsToSupport,
            verbose: false,
            experimentalFeatures: {
              useBarCodeDetectorIfSupported: true
            }
          });
          scannerRef.current = html5QrCode;

          html5QrCode
            .start(
              { facingMode: 'environment' },
              {
                fps: 15,
                qrbox: (viewfinderWidth, viewfinderHeight) => {
                  const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
                  return {
                    width: Math.floor(minEdge * 0.85),
                    height: Math.floor(minEdge * 0.65)
                  };
                },
                aspectRatio: 1.0
              },
              async (decodedText) => {
                handleCodeDetected(decodedText);
              },
              () => {
                // Ignore per-frame misses
              }
            )
            .catch((err) => {
              console.warn('Camera access error:', err);
              setError('Không thể mở camera. Vui lòng cấp quyền truy cập camera hoặc nhập mã thủ công.');
              setScanning(false);
            });
        } catch (err) {
          console.error('Scanner init error:', err);
          setError('Không thể khởi tạo máy quét.');
          setScanning(false);
        }
      }, 150);

      return () => {
        clearTimeout(timer);
        if (scannerRef.current) {
          try {
            scannerRef.current.stop()
              .then(() => scannerRef.current?.clear())
              .catch(() => {});
          } catch (e) {
            // Ignore stop errors
          }
        }
      };
    }
  }, [isOpen]);

  const handleCodeDetected = async (code) => {
    if (!code || isProcessingRef.current) return;

    const trimmed = code.trim();
    const now = Date.now();

    // Prevent double-scan of identical barcode within 1.4s
    if (lastCodeRef.current.code === trimmed && now - lastCodeRef.current.time < 1400) {
      return;
    }

    isProcessingRef.current = true;
    lastCodeRef.current = { code: trimmed, time: now };

    try {
      setError('');
      // Query backend (which checks both qr_code_token and product_code)
      const res = await api.get(`/products/qr/${encodeURIComponent(trimmed)}`);
      const product = res.data?.data || res.data;

      if (product && product.id) {
        // Success audio chime
        playScanBeep(true);

        // Add to POS cart
        onProductFound(product);

        setScannedCount((prev) => prev + 1);
        setLastScannedProduct(product);

        if (!continuousMode) {
          if (scannerRef.current) {
            try {
              await scannerRef.current.stop();
            } catch (e) {}
          }
          onClose();
        }
      } else {
        playScanBeep(false);
        setError(`Mã "${trimmed}" không có trong dữ liệu sản phẩm.`);
      }
    } catch (err) {
      playScanBeep(false);
      setError(err?.message || `Không tìm thấy sản phẩm với mã: ${trimmed}`);
    } finally {
      setTimeout(() => {
        isProcessingRef.current = false;
      }, 500);
    }
  };

  const handleManualSearch = async (e) => {
    e.preventDefault();
    if (!manualCode.trim()) return;

    try {
      setSearching(true);
      setError('');
      const code = manualCode.trim();

      // First try direct QR / barcode lookup
      try {
        const directRes = await api.get(`/products/qr/${encodeURIComponent(code)}`);
        const prod = directRes.data?.data || directRes.data;
        if (prod && prod.id) {
          playScanBeep(true);
          onProductFound(prod);
          setScannedCount((prev) => prev + 1);
          setLastScannedProduct(prod);
          setManualCode('');
          if (!continuousMode) onClose();
          return;
        }
      } catch (e) {
        // Fallback to text search
      }

      // Fallback search by text / SKU
      const res = await api.get(`/products?search=${encodeURIComponent(code)}&limit=1`);
      if (res.data?.items && res.data.items.length > 0) {
        const prod = res.data.items[0];
        playScanBeep(true);
        onProductFound(prod);
        setScannedCount((prev) => prev + 1);
        setLastScannedProduct(prod);
        setManualCode('');
        if (!continuousMode) onClose();
      } else {
        playScanBeep(false);
        setError(`Không tìm thấy sản phẩm với mã "${code}".`);
      }
    } catch (err) {
      playScanBeep(false);
      setError(err.message || 'Lỗi tra cứu sản phẩm.');
    } finally {
      setSearching(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Quét Mã Sản Phẩm Tức Thì">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {/* Mode controls and Scanned counter */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: 'var(--bg-card-secondary)',
          padding: '8px 14px',
          borderRadius: 'var(--radius-md)',
          fontSize: '13px'
        }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none', margin: 0 }}>
            <input
              type="checkbox"
              checked={continuousMode}
              onChange={(e) => setContinuousMode(e.target.checked)}
              style={{ width: '16px', height: '16px', accentColor: 'var(--primary)', cursor: 'pointer' }}
            />
            <span style={{ fontWeight: 600, color: continuousMode ? 'var(--primary)' : 'var(--text-secondary)' }}>
              Quét liên tục (Không đóng camera)
            </span>
          </label>

          {scannedCount > 0 && (
            <span style={{
              backgroundColor: 'var(--primary-light)',
              color: 'var(--primary)',
              padding: '2px 10px',
              borderRadius: 'var(--radius-full)',
              fontWeight: 700,
              fontSize: '12px'
            }}>
              Đã nhận diện: {scannedCount} món
            </span>
          )}
        </div>

        {/* Live scanner viewport */}
        <div style={{
          position: 'relative',
          backgroundColor: '#000',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          minHeight: '270px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          border: '2px solid rgba(0,0,0,0.06)',
          boxShadow: 'inset 0 0 20px rgba(0,0,0,0.5)'
        }}>
          <div id="qr-reader-container" style={{ width: '100%', height: '100%' }} />

          {/* Green detection toast overlay */}
          {lastScannedProduct && (
            <div style={{
              position: 'absolute',
              top: '12px',
              left: '12px',
              right: '12px',
              backgroundColor: 'rgba(22, 101, 52, 0.92)',
              backdropFilter: 'blur(8px)',
              color: '#ffffff',
              padding: '10px 14px',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
              zIndex: 10,
              animation: 'slideDown 0.25s ease'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                <CheckCircle size={18} color="#86efac" />
                <div style={{ fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  Đã thêm: <strong>{lastScannedProduct.name}</strong> (+1)
                </div>
              </div>
              <span style={{ fontSize: '11px', color: '#bbf7d0', flexShrink: 0, marginLeft: '8px' }}>
                Tiếp tục quét...
              </span>
            </div>
          )}

          {!scanning && error && (
            <div style={{ padding: '24px', textAlign: 'center', color: '#ffffff', zIndex: 5 }}>
              <AlertCircle size={40} color="#f59e0b" style={{ marginBottom: '8px' }} />
              <div style={{ fontSize: '13px', color: '#fcd34d', maxWidth: '280px' }}>{error}</div>
            </div>
          )}
        </div>

        {/* Manual search input */}
        <form onSubmit={handleManualSearch} style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            className="form-control"
            placeholder="Hoặc nhập/bắn mã SKU (vd: NUOC-COCA-330)..."
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            style={{ fontSize: '13px' }}
          />
          <button type="submit" className="btn btn-primary" disabled={searching} style={{ padding: '0 18px', flexShrink: 0 }}>
            <Search size={15} />
            <span>Thêm</span>
          </button>
        </form>

        {/* Footer info & close button */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '4px' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            ⚡ Nhận diện tức thì cả Barcode 1D (EAN/UPC) và Mã QR
          </div>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            style={{ padding: '6px 14px', fontSize: '12px' }}
          >
            Hoàn tất
          </button>
        </div>
      </div>
    </Modal>
  );
}
