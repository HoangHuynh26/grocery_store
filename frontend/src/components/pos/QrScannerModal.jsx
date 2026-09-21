import React, { useEffect, useRef, useState, useCallback } from 'react';
import Modal from '../common/Modal';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { 
  Camera, Search, AlertCircle, CheckCircle, Sparkles, 
  Zap, Scan, Eye, RefreshCw, ShoppingCart, Check, Info, Plus
} from 'lucide-react';
import api from '../../services/api';
import { playScanBeep } from '../../utils/scannerAudio';

export default function QrScannerModal({ isOpen, onClose, onProductFound }) {
  // Mode: 'barcode' (Siêu Tốc Full-Frame) or 'vision' (AI Nhận Diện Bao Bì)
  const [scanMode, setScanMode] = useState('barcode');
  const [error, setError] = useState('');
  const [scanning, setScanning] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [searching, setSearching] = useState(false);
  const [continuousMode, setContinuousMode] = useState(true);
  
  // Scanned history & counts
  const [lastScannedProduct, setLastScannedProduct] = useState(null);
  const [scannedCount, setScannedCount] = useState(0);

  // Vision AI state
  const [analyzingVision, setAnalyzingVision] = useState(false);
  const [visionCandidate, setVisionCandidate] = useState(null);
  const [visionInsight, setVisionInsight] = useState('');
  const [allCandidates, setAllCandidates] = useState([]);
  const [autoVision, setAutoVision] = useState(false);

  const scannerRef = useRef(null);
  const lastCodeRef = useRef({ code: '', time: 0 });
  const isProcessingRef = useRef(false);
  const autoVisionTimerRef = useRef(null);

  // Handle barcode/QR code detection from scanner
  const handleCodeDetected = useCallback(async (code) => {
    if (!code || isProcessingRef.current) return;

    const trimmed = code.trim();
    const now = Date.now();

    // Prevent double-scan of identical barcode within 1.2s
    if (lastCodeRef.current.code === trimmed && now - lastCodeRef.current.time < 1200) {
      return;
    }

    isProcessingRef.current = true;
    lastCodeRef.current = { code: trimmed, time: now };

    try {
      setError('');
      // Query backend (which checks both qr_code_token, product_code, and id)
      const res = await api.get(`/products/qr/${encodeURIComponent(trimmed)}`);
      const product = res.data?.data || res.data;

      if (product && product.id) {
        playScanBeep(true);
        onProductFound(product);
        setScannedCount((prev) => prev + 1);
        setLastScannedProduct(product);
        setVisionCandidate(null);

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
      setError(err?.response?.data?.error?.message || err?.message || `Không tìm thấy sản phẩm với mã: ${trimmed}`);
    } finally {
      setTimeout(() => {
        isProcessingRef.current = false;
      }, 400);
    }
  }, [continuousMode, onClose, onProductFound]);

  // Capture frame from active camera video feed
  const captureVideoFrame = () => {
    try {
      const container = document.getElementById('qr-reader-container');
      if (!container) return null;
      const video = container.querySelector('video');
      if (!video || video.readyState < 2) return null;

      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/jpeg', 0.82);
    } catch (err) {
      console.warn('Capture frame error:', err);
      return null;
    }
  };

  // Trigger Vision AI Product Recognition
  const handleAnalyzeVision = async () => {
    if (analyzingVision) return;
    const imageBase64 = captureVideoFrame();

    setAnalyzingVision(true);
    setError('');

    try {
      const res = await api.post('/ai/recognize-product-image', {
        imageBase64: imageBase64 || '',
        hintText: ''
      });

      const data = res.data?.data || res.data;
      if (data && data.product) {
        const prod = data.product;
        playScanBeep(true);
        setVisionCandidate(prod);
        setVisionInsight(data.visualInsights || 'Nhận diện thành công qua đặc trưng bao bì.');
        setAllCandidates(data.allCandidates || []);

        // Auto add to cart
        onProductFound(prod);
        setScannedCount((prev) => prev + 1);
        setLastScannedProduct(prod);

        if (!continuousMode) {
          setTimeout(() => {
            onClose();
          }, 800);
        }
      } else {
        playScanBeep(false);
        setError('Chưa nhận diện rõ bao bì. Vui lòng đưa sản phẩm lại gần hoặc quét mã vạch.');
      }
    } catch (err) {
      playScanBeep(false);
      setError(err?.response?.data?.error?.message || err?.message || 'Lỗi nhận diện thị giác AI.');
    } finally {
      setAnalyzingVision(false);
    }
  };

  // Start HTML5-QRCode with Full-Frame Scanning & High FPS
  useEffect(() => {
    let html5QrCode = null;

    if (isOpen) {
      setError('');
      setScanning(true);
      setLastScannedProduct(null);
      setVisionCandidate(null);
      setScannedCount(0);
      lastCodeRef.current = { code: '', time: 0 };
      isProcessingRef.current = false;

      const timer = setTimeout(() => {
        const qrContainer = document.getElementById('qr-reader-container');
        if (!qrContainer) return;

        try {
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
                fps: 25, // High FPS for instant response
                // Full-frame scanning (no restrictive tiny bounding box!)
                qrbox: (viewfinderWidth, viewfinderHeight) => ({
                  width: Math.floor(viewfinderWidth * 0.94),
                  height: Math.floor(viewfinderHeight * 0.92)
                }),
                aspectRatio: 1.0
              },
              async (decodedText) => {
                // If in barcode mode, or anytime a barcode is visible
                handleCodeDetected(decodedText);
              },
              () => {
                // Ignore per-frame misses
              }
            )
            .then(() => {
              setScanning(true);
            })
            .catch((err) => {
              console.warn('Camera start warning:', err);
              setScanning(false);
              setError(
                'Không thể mở Camera. Vui lòng cấp quyền truy cập máy ảnh cho trình duyệt hoặc nhập mã thủ công.'
              );
            });
        } catch (e) {
          setScanning(false);
          setError('Không thể khởi tạo camera quét.');
        }
      }, 150);

      return () => {
        clearTimeout(timer);
        if (autoVisionTimerRef.current) clearInterval(autoVisionTimerRef.current);
        if (scannerRef.current) {
          try {
            scannerRef.current
              .stop()
              .then(() => scannerRef.current?.clear())
              .catch(() => {});
          } catch (e) {}
        }
      };
    }
  }, [isOpen, handleCodeDetected]);

  // Auto-Vision periodic scanner (if user enables Auto Vision)
  useEffect(() => {
    if (scanMode === 'vision' && autoVision && isOpen) {
      autoVisionTimerRef.current = setInterval(() => {
        if (!analyzingVision && !isProcessingRef.current) {
          handleAnalyzeVision();
        }
      }, 2500);
    } else {
      if (autoVisionTimerRef.current) clearInterval(autoVisionTimerRef.current);
    }
    return () => {
      if (autoVisionTimerRef.current) clearInterval(autoVisionTimerRef.current);
    };
  }, [scanMode, autoVision, isOpen, analyzingVision]);

  // Manual fallback search
  const handleManualSearch = async (e) => {
    e.preventDefault();
    if (!manualCode.trim()) return;

    try {
      setSearching(true);
      setError('');
      const code = manualCode.trim();

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
      } catch (e) {}

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
    <Modal isOpen={isOpen} onClose={onClose} title="Hệ Thống Quét Sản Phẩm Thông Minh Kép">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        
        {/* Dual Mode Switcher Tab Bar */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          backgroundColor: 'var(--bg-card-secondary)',
          borderRadius: 'var(--radius-lg)',
          padding: '4px',
          gap: '4px'
        }}>
          <button
            type="button"
            onClick={() => setScanMode('barcode')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '10px 14px',
              borderRadius: 'var(--radius-md)',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '13px',
              transition: 'all 0.2s ease',
              backgroundColor: scanMode === 'barcode' ? 'var(--primary)' : 'transparent',
              color: scanMode === 'barcode' ? '#ffffff' : 'var(--text-secondary)',
              boxShadow: scanMode === 'barcode' ? '0 2px 8px rgba(16, 185, 129, 0.25)' : 'none'
            }}
          >
            <Zap size={16} />
            <span>⚡ Mã Vạch Siêu Tốc</span>
          </button>

          <button
            type="button"
            onClick={() => setScanMode('vision')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '10px 14px',
              borderRadius: 'var(--radius-md)',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '13px',
              transition: 'all 0.2s ease',
              backgroundColor: scanMode === 'vision' ? 'linear-gradient(135deg, #3b82f6, #6366f1)' : (scanMode === 'vision' ? 'var(--primary)' : 'transparent'),
              background: scanMode === 'vision' ? 'linear-gradient(135deg, #059669, #10b981)' : 'transparent',
              color: scanMode === 'vision' ? '#ffffff' : 'var(--text-secondary)',
              boxShadow: scanMode === 'vision' ? '0 2px 8px rgba(16, 185, 129, 0.25)' : 'none'
            }}
          >
            <Eye size={16} />
            <span>👁️ AI Nhận Diện Bao Bì</span>
          </button>
        </div>

        {/* Live scanner viewport with high-tech HUD overlays */}
        <div style={{
          position: 'relative',
          backgroundColor: '#050811',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          minHeight: '290px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          border: scanMode === 'vision' ? '2px solid rgba(16, 185, 129, 0.4)' : '2px solid rgba(59, 130, 246, 0.3)',
          boxShadow: '0 8px 30px rgba(0, 0, 0, 0.45)'
        }}>
          {/* Real camera feed */}
          <div id="qr-reader-container" style={{ width: '100%', height: '100%' }} />

          {/* Futuristic Scanning HUD Overlay */}
          <div style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '16px',
            zIndex: 4
          }}>
            {/* Top Status & Tip */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: 'rgba(15, 23, 42, 0.75)',
              backdropFilter: 'blur(8px)',
              borderRadius: 'var(--radius-md)',
              padding: '6px 12px',
              color: '#ffffff',
              fontSize: '12px',
              border: '1px solid rgba(255, 255, 255, 0.1)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: '#22c55e',
                  boxShadow: '0 0 8px #22c55e',
                  display: 'inline-block'
                }} />
                <strong>{scanMode === 'barcode' ? 'Mã Vạch Toàn Màn Hình' : 'Thị Giác AI Nhận Diện'}</strong>
              </div>
              <span style={{ color: '#cbd5e1', fontSize: '11px' }}>
                {scanMode === 'barcode' ? 'Lướt mã qua là nhận ngay' : 'Hướng ống kính vào vỏ hộp / chai'}
              </span>
            </div>

            {/* Center Reticle (HUD Focus Brackets) */}
            <div style={{
              position: 'relative',
              width: '85%',
              height: '180px',
              margin: '0 auto',
              border: '1px dashed rgba(255, 255, 255, 0.18)',
              borderRadius: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {/* Corner Brackets */}
              <div style={{ position: 'absolute', top: '-2px', left: '-2px', width: '22px', height: '22px', borderTop: '3px solid #22c55e', borderLeft: '3px solid #22c55e', borderTopLeftRadius: '10px' }} />
              <div style={{ position: 'absolute', top: '-2px', right: '-2px', width: '22px', height: '22px', borderTop: '3px solid #22c55e', borderRight: '3px solid #22c55e', borderTopRightRadius: '10px' }} />
              <div style={{ position: 'absolute', bottom: '-2px', left: '-2px', width: '22px', height: '22px', borderBottom: '3px solid #22c55e', borderLeft: '3px solid #22c55e', borderBottomLeftRadius: '10px' }} />
              <div style={{ position: 'absolute', bottom: '-2px', right: '-2px', width: '22px', height: '22px', borderBottom: '3px solid #22c55e', borderRight: '3px solid #22c55e', borderBottomRightRadius: '10px' }} />

              {/* Animated Laser Scan Line (in Barcode mode) */}
              {scanMode === 'barcode' && (
                <div style={{
                  position: 'absolute',
                  width: '92%',
                  height: '2px',
                  background: 'linear-gradient(90deg, transparent, #22c55e, #86efac, #22c55e, transparent)',
                  boxShadow: '0 0 12px #22c55e',
                  animation: 'laserScan 1.6s ease-in-out infinite alternate'
                }} />
              )}

              {/* Center Guidance in Vision Mode */}
              {scanMode === 'vision' && (
                <div style={{
                  textAlign: 'center',
                  color: 'rgba(255, 255, 255, 0.85)',
                  backgroundColor: 'rgba(0, 0, 0, 0.45)',
                  padding: '6px 14px',
                  borderRadius: '20px',
                  fontSize: '11px',
                  backdropFilter: 'blur(4px)'
                }}>
                  {analyzingVision ? '🔍 Đang phân tích bao bì & logo...' : 'Đưa mặt trước sản phẩm vào khung ngắm'}
                </div>
              )}
            </div>

            {/* Bottom Scanned Counter Badge */}
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              {scannedCount > 0 && (
                <span style={{
                  backgroundColor: 'rgba(34, 197, 94, 0.9)',
                  color: '#ffffff',
                  padding: '4px 14px',
                  borderRadius: '20px',
                  fontWeight: 700,
                  fontSize: '12px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
                }}>
                  Đã thêm {scannedCount} sản phẩm
                </span>
              )}
            </div>
          </div>

          {/* Green Detection Toast Overlay */}
          {lastScannedProduct && (
            <div style={{
              position: 'absolute',
              top: '12px',
              left: '12px',
              right: '12px',
              backgroundColor: 'rgba(22, 101, 52, 0.95)',
              backdropFilter: 'blur(10px)',
              color: '#ffffff',
              padding: '10px 14px',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
              zIndex: 10,
              border: '1px solid rgba(134, 239, 172, 0.3)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                <CheckCircle size={18} color="#86efac" />
                <div style={{ fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  Đã thêm: <strong>{lastScannedProduct.name}</strong> (+1)
                </div>
              </div>
              <span style={{ fontSize: '11px', color: '#bbf7d0', flexShrink: 0, marginLeft: '8px' }}>
                {(lastScannedProduct.selling_price || 0).toLocaleString('vi-VN')} đ
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

        {/* Action Panel: Specific to Current Mode */}
        {scanMode === 'vision' ? (
          <div style={{
            backgroundColor: 'var(--bg-card-secondary)',
            padding: '12px 14px',
            borderRadius: 'var(--radius-lg)',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                Chế độ Nhận diện Bao bì AI
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer', margin: 0 }}>
                <input
                  type="checkbox"
                  checked={autoVision}
                  onChange={(e) => setAutoVision(e.target.checked)}
                  style={{ accentColor: 'var(--primary)' }}
                />
                <span>Tự động quét (2.5s)</span>
              </label>
            </div>

            <button
              type="button"
              className="btn btn-primary"
              disabled={analyzingVision}
              onClick={handleAnalyzeVision}
              style={{
                width: '100%',
                height: '44px',
                fontSize: '14px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
              }}
            >
              {analyzingVision ? (
                <>
                  <RefreshCw size={18} className="animate-spin" />
                  <span>AI Đang Phân Tích Bao Bì...</span>
                </>
              ) : (
                <>
                  <Camera size={18} />
                  <span>📸 Chụp & Nhận Diện Sản Phẩm Ngay</span>
                </>
              )}
            </button>

            {/* Vision Detected Result Banner */}
            {visionCandidate && (
              <div style={{
                backgroundColor: 'var(--primary-light)',
                borderRadius: 'var(--radius-md)',
                padding: '10px 12px',
                border: '1px solid rgba(16, 185, 129, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '10px'
              }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: 700, textTransform: 'uppercase' }}>
                    Đã Nhận Diện Thành Công
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {visionCandidate.name}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    {visionInsight}
                  </div>
                </div>

                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--primary)' }}>
                    {(visionCandidate.selling_price || 0).toLocaleString('vi-VN')} đ
                  </div>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                    Tồn: {visionCandidate.stock_quantity} {visionCandidate.unit}
                  </span>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Barcode Mode Quick Options */
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
                Quét liên tục (Giữ camera mở khi bán nhiều món)
              </span>
            </label>

            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>
              Tốc độ 25 FPS
            </span>
          </div>
        )}

        {/* Manual search input fallback */}
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
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Sparkles size={14} color="var(--primary)" />
            <span>Nhận diện tức thì: Barcode 1D, QR 2D và Thị Giác AI</span>
          </div>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            style={{ padding: '6px 16px', fontSize: '12px', fontWeight: 600 }}
          >
            Đóng Camera
          </button>
        </div>
      </div>

      <style>{`
        @keyframes laserScan {
          0% { top: 12%; }
          100% { top: 88%; }
        }
      `}</style>
    </Modal>
  );
}
