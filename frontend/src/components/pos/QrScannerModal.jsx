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
  const [autoVision, setAutoVision] = useState(true);

  const scannerRef = useRef(null);
  const lastCodeRef = useRef({ code: '', time: 0 });
  const isProcessingRef = useRef(false);
  const autoVisionTimerRef = useRef(null);

  // Handle barcode/QR code detection from scanner
  const handleCodeDetected = useCallback(async (code) => {
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
      // Query backend (which checks qr_code_token, product_code, and id)
      const res = await api.get(`/products/qr/${encodeURIComponent(trimmed)}`);
      const product = res.data?.data || res.data;

      if (product && product.id) {
        playScanBeep(true);
        onProductFound(product);
        setScannedCount((prev) => prev + 1);
        setLastScannedProduct({ ...product, scanSource: 'Mã Vạch / QR Code' });
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
      }, 500);
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

  // Trigger Vision AI Product Recognition (Integrated directly with camera stream)
  const handleAnalyzeVision = useCallback(async (isManualTrigger = false) => {
    if (analyzingVision || isProcessingRef.current) return;
    const imageBase64 = captureVideoFrame();
    if (!imageBase64) return;

    setAnalyzingVision(true);
    if (isManualTrigger) setError('');

    try {
      const res = await api.post('/ai/recognize-product-image', {
        imageBase64: imageBase64 || '',
        hintText: ''
      });

      const data = res.data?.data || res.data;
      if (data && data.product) {
        const prod = data.product;
        const now = Date.now();

        // Prevent immediate duplicate if identical product was just scanned within 1.5s
        if (lastCodeRef.current.code === prod.product_code && now - lastCodeRef.current.time < 1500) {
          return;
        }
        lastCodeRef.current = { code: prod.product_code, time: now };

        playScanBeep(true);
        setVisionCandidate(prod);
        setVisionInsight(data.visualInsights || 'Nhận diện thành công qua đặc trưng bao bì.');

        // Auto add to cart
        onProductFound(prod);
        setScannedCount((prev) => prev + 1);
        setLastScannedProduct({ ...prod, scanSource: 'Bao Bì Sản Phẩm (AI)' });
        setError('');

        if (!continuousMode) {
          setTimeout(() => {
            onClose();
          }, 800);
        }
      } else if (isManualTrigger) {
        playScanBeep(false);
        setError('Chưa nhận diện rõ bao bì. Vui lòng đưa sản phẩm lại gần hoặc quét mã vạch.');
      }
    } catch (err) {
      if (isManualTrigger) {
        playScanBeep(false);
        setError(err?.response?.data?.error?.message || err?.message || 'Lỗi nhận diện thị giác AI.');
      }
    } finally {
      setAnalyzingVision(false);
    }
  }, [analyzingVision, continuousMode, onClose, onProductFound]);

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
                // Simultaneously catches any barcode or QR code in frame
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

  // Integrated Auto-Vision periodic scanner: Runs alongside barcode scanner on the same video feed!
  useEffect(() => {
    if (autoVision && isOpen && scanning) {
      autoVisionTimerRef.current = setInterval(() => {
        if (!analyzingVision && !isProcessingRef.current) {
          handleAnalyzeVision(false);
        }
      }, 2200);
    } else {
      if (autoVisionTimerRef.current) clearInterval(autoVisionTimerRef.current);
    }
    return () => {
      if (autoVisionTimerRef.current) clearInterval(autoVisionTimerRef.current);
    };
  }, [autoVision, isOpen, scanning, analyzingVision, handleAnalyzeVision]);

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
          setLastScannedProduct({ ...prod, scanSource: 'Nhập Mã SKU Thủ Công' });
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
        setLastScannedProduct({ ...prod, scanSource: 'Nhập Mã SKU Thủ Công' });
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
    <Modal isOpen={isOpen} onClose={onClose} title="Quét Sản Phẩm Tích Hợp (Mã Vạch, QR & Bao Bì AI)">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        
        {/* Integrated Engine Status Header Badge */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: 'var(--bg-card-secondary)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-md)',
          padding: '8px 14px',
          fontSize: '12.5px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              width: '9px',
              height: '9px',
              borderRadius: '50%',
              backgroundColor: '#10b981',
              boxShadow: '0 0 8px #10b981',
              display: 'inline-block'
            }} />
            <strong style={{ color: 'var(--text-primary)' }}>Chế Độ Tích Hợp Song Song:</strong>
            <span style={{ color: 'var(--primary)', fontWeight: 600 }}>Mã Vạch 1D + QR Code + Bao Bì AI</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: 'var(--text-muted)' }}>
            <Sparkles size={13} color="var(--primary)" />
            <span>Tự Động Nhận Diện</span>
          </div>
        </div>

        {/* Live scanner viewport with integrated high-tech HUD */}
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
          border: '2px solid rgba(16, 185, 129, 0.4)',
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
            padding: '14px',
            zIndex: 4
          }}>
            {/* Top Status & Tip */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: 'rgba(15, 23, 42, 0.8)',
              backdropFilter: 'blur(8px)',
              borderRadius: 'var(--radius-md)',
              padding: '6px 12px',
              color: '#ffffff',
              fontSize: '12px',
              border: '1px solid rgba(255, 255, 255, 0.12)'
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
                <strong>Camera Đang Hoạt Động (25 FPS)</strong>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {analyzingVision ? (
                  <span style={{ color: '#86efac', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 600 }}>
                    <RefreshCw size={11} className="animate-spin" />
                    <span>AI đang phân tích bao bì...</span>
                  </span>
                ) : (
                  <span style={{ color: '#cbd5e1', fontSize: '11px' }}>
                    Chĩa vào mã vạch, QR hoặc vỏ bao bì
                  </span>
                )}
              </div>
            </div>

            {/* Center Reticle (HUD Focus Brackets) */}
            <div style={{
              position: 'relative',
              width: '86%',
              height: '180px',
              margin: '0 auto',
              border: '1px dashed rgba(255, 255, 255, 0.22)',
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

              {/* Animated Continuous Laser Scan Line */}
              <div style={{
                position: 'absolute',
                width: '94%',
                height: '2px',
                background: 'linear-gradient(90deg, transparent, #22c55e, #86efac, #22c55e, transparent)',
                boxShadow: '0 0 14px #22c55e',
                animation: 'laserScan 1.6s ease-in-out infinite alternate'
              }} />

              {/* Reticle Central Guide Label */}
              <div style={{
                position: 'absolute',
                bottom: '10px',
                textAlign: 'center',
                color: 'rgba(255, 255, 255, 0.9)',
                backgroundColor: 'rgba(0, 0, 0, 0.55)',
                padding: '4px 12px',
                borderRadius: '20px',
                fontSize: '11px',
                backdropFilter: 'blur(4px)'
              }}>
                {analyzingVision ? '🔍 AI đang quét đặc trưng bao bì...' : 'Đưa mã vạch, mã QR hoặc nhãn chai/hộp vào đây'}
              </div>
            </div>

            {/* Bottom Scanned Counter Badge */}
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              {scannedCount > 0 && (
                <span style={{
                  backgroundColor: 'rgba(34, 197, 94, 0.92)',
                  color: '#ffffff',
                  padding: '4px 14px',
                  borderRadius: '20px',
                  fontWeight: 700,
                  fontSize: '12px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
                }}>
                  Đã thêm {scannedCount} sản phẩm vào đơn
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
              backgroundColor: 'rgba(22, 101, 52, 0.96)',
              backdropFilter: 'blur(10px)',
              color: '#ffffff',
              padding: '10px 14px',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
              zIndex: 10,
              border: '1px solid rgba(134, 239, 172, 0.35)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                <CheckCircle size={18} color="#86efac" style={{ flexShrink: 0 }} />
                <div style={{ fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  Đã nhận: <strong>{lastScannedProduct.name}</strong> (+1)
                  <span style={{
                    marginLeft: '8px',
                    fontSize: '10px',
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: '4px',
                    backgroundColor: lastScannedProduct.scanSource?.includes('Bao Bì') ? 'rgba(5, 150, 105, 0.8)' : 'rgba(37, 99, 235, 0.8)'
                  }}>
                    {lastScannedProduct.scanSource || 'Tích Hợp'}
                  </span>
                </div>
              </div>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#bbf7d0', flexShrink: 0, marginLeft: '8px' }}>
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

        {/* Action Panel: Integrated Controls */}
        <div style={{
          backgroundColor: 'var(--bg-card-secondary)',
          padding: '12px 14px',
          borderRadius: 'var(--radius-lg)',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}>
          {/* Main Integrated Snap Action Button */}
          <button
            type="button"
            className="btn btn-primary"
            disabled={analyzingVision}
            onClick={() => handleAnalyzeVision(true)}
            style={{
              width: '100%',
              height: '44px',
              fontSize: '14px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)'
            }}
          >
            {analyzingVision ? (
              <>
                <RefreshCw size={18} className="animate-spin" />
                <span>AI Đang Nhận Diện Bao Bì...</span>
              </>
            ) : (
              <>
                <Camera size={18} />
                <span>📸 Chụp & Nhận Diện Bao Bì Ngay</span>
              </>
            )}
          </button>

          {/* Quick Smart Toggles */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '8px',
            fontSize: '12.5px',
            paddingTop: '2px'
          }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', margin: 0 }}>
              <input
                type="checkbox"
                checked={autoVision}
                onChange={(e) => setAutoVision(e.target.checked)}
                style={{ width: '15px', height: '15px', accentColor: 'var(--primary)', cursor: 'pointer' }}
              />
              <span style={{ fontWeight: 600, color: autoVision ? 'var(--primary)' : 'var(--text-secondary)' }}>
                Tự động quét bao bì AI (2.2s)
              </span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', margin: 0 }}>
              <input
                type="checkbox"
                checked={continuousMode}
                onChange={(e) => setContinuousMode(e.target.checked)}
                style={{ width: '15px', height: '15px', accentColor: 'var(--primary)', cursor: 'pointer' }}
              />
              <span style={{ fontWeight: 600, color: continuousMode ? 'var(--primary)' : 'var(--text-secondary)' }}>
                Quét liên tục (bán nhiều món)
              </span>
            </label>
          </div>

          {/* Vision Candidate Info if detected by AI */}
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
                  ✓ Nhận Diện Bao Bì Thành Công
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

        {/* Manual search input fallback */}
        <form onSubmit={handleManualSearch} style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            className="form-control"
            placeholder="Hoặc nhập/bắn mã SKU (vd: BANH-CHOCORIE-01)..."
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '2px' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Sparkles size={14} color="var(--primary)" />
            <span>Hệ thống tích hợp: Quét mã vạch, mã QR hay hướng bao bì đều nhận diện ngay</span>
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
          0% { top: 10%; }
          100% { top: 90%; }
        }
      `}</style>
    </Modal>
  );
}
