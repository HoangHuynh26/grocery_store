import React, { useState, useRef, useEffect } from 'react';
import api from '../services/api';
import {
  Bot,
  Send,
  User,
  Sparkles,
  RefreshCw,
  Paperclip,
  Globe,
  Lightbulb,
  Mic,
  MicOff,
  ArrowUp,
  X,
  Copy,
  Check,
  TrendingUp,
  Package,
  Clock,
  Flame,
  HelpCircle,
  ChevronUp
} from 'lucide-react';

function cleanAiText(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1')
    .replace(/_{1,3}([^_]+)_{1,3}/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*/g, '')
    .trim();
}

export default function AiAssistantPage() {
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      content: `Xin chào! Tôi là Trợ Lý Doanh Nghiệp AI (LangGraph Agent) của Cửa Hàng.\n\nTôi có thể giúp bạn:\n• Tra cứu doanh thu hôm nay hoặc theo từng khung giờ cụ thể\n• Xem các sản phẩm bán chạy nhất hoặc cảnh báo hàng sắp hết\n• Dự báo doanh thu tháng tới bằng mô hình Machine Learning\n\nHãy chọn gợi ý bên dưới, nhập câu hỏi hoặc bấm nút Giọng Nói để bắt đầu!`
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  // Modern input controls states (matching user reference)
  const [activeContext, setActiveContext] = useState(null);
  const [isSearchActive, setIsSearchActive] = useState(true);
  const [isReasonActive, setIsReasonActive] = useState(false);
  const [isAttachOpen, setIsAttachOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);

  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);
  const textareaRef = useRef(null);

  const quickPresets = [
    { label: 'Doanh thu hôm nay', query: 'Doanh thu hôm nay bao nhiêu?', tag: 'Doanh thu', icon: TrendingUp },
    { label: 'Doanh thu lúc 13h', query: 'Vào lúc 13 giờ hôm nay có doanh thu nào không?', tag: 'Theo giờ', icon: Clock },
    { label: 'Top hàng bán chạy', query: 'Sản phẩm nào bán chạy nhất trong cửa hàng?', tag: 'Bán chạy', icon: Flame },
    { label: 'Cảnh báo tồn kho', query: 'Những mặt hàng nào trong kho đang sắp hết?', tag: 'Tồn kho', icon: Package },
    { label: 'Dự báo tháng tới', query: 'Dự đoán doanh thu tháng tới bằng mô hình ML?', tag: 'Dự báo ML', icon: Sparkles },
    { label: 'Cẩm nang sử dụng', query: 'Hướng dẫn sử dụng các chức năng hệ thống', tag: 'Hướng dẫn', icon: HelpCircle }
  ];

  const attachOptions = [
    { label: 'Báo cáo doanh số thời gian thực', tag: 'Báo cáo doanh thu', prompt: 'Tổng hợp doanh thu và số lượng đơn hàng hôm nay.' },
    { label: 'Danh sách sản phẩm sắp hết hàng', tag: 'Cảnh báo tồn kho', prompt: 'Liệt kê các mặt hàng có tồn kho dưới mức tối thiểu.' },
    { label: 'Top 10 sản phẩm bán chạy nhất', tag: 'Top bán chạy', prompt: 'Liệt kê chi tiết 10 mặt hàng có lượt mua cao nhất.' },
    { label: 'Dự báo doanh số chu kỳ tới', tag: 'Dự báo kinh doanh', prompt: 'Phân tích xu hướng và dự đoán doanh thu tháng tới.' }
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  // Handle Speech Recognition (Web Speech API in Vietnamese)
  const toggleVoice = () => {
    const SpeechRecognition = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;

    if (!SpeechRecognition) {
      alert('Trình duyệt hiện tại chưa hỗ trợ Web Speech API. Bạn có thể sử dụng Google Chrome hoặc Microsoft Edge để nói tiếng Việt.');
      return;
    }

    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'vi-VN';
      recognition.interimResults = true;
      recognition.continuous = false;

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        if (transcript) {
          setInputValue((prev) => (prev ? prev.trim() + ' ' + transcript : transcript));
        }
      };

      recognition.onerror = (e) => {
        console.warn('Speech recognition error:', e);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error('Failed to start speech recognition:', err);
      setIsListening(false);
    }
  };

  const handleSendMessage = async (textToSend) => {
    let text = (textToSend || inputValue).trim();
    if (!text && !activeContext) return;
    if (loading) return;

    if (activeContext && !textToSend) {
      text = `[Ngữ cảnh: ${activeContext}] ${text}`;
    }

    const userMsg = { id: String(Date.now()), role: 'user', content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInputValue('');
    setActiveContext(null);
    setIsAttachOpen(false);
    setLoading(true);

    try {
      const res = await api.post('/ai/chat', { message: text, sessionId });
      const rawReply = res?.data?.reply || res?.reply || (typeof res?.data === 'string' ? res.data : 'Đã nhận câu trả lời.');
      const replyContent = cleanAiText(rawReply);
      const toolUsed = res?.data?.toolUsed || res?.toolUsed || null;
      const returnedSessionId = res?.data?.sessionId || res?.sessionId;
      if (returnedSessionId && !sessionId) {
        setSessionId(returnedSessionId);
      }

      const botMsg = {
        id: String(Date.now() + 1),
        role: 'assistant',
        content: replyContent,
        toolUsed
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: String(Date.now() + 1),
          role: 'assistant',
          content: err?.message ? `⚠️ ${err.message}` : 'Xin lỗi, không thể xử lý câu hỏi lúc này. Vui lòng kiểm tra lại kết nối máy chủ.'
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (id, text) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div
      className="page-container ai-chat-container"
      style={{
        maxWidth: '920px',
        margin: '0 auto',
        height: 'calc(100vh - var(--header-height) - var(--mobile-nav-height) - env(safe-area-inset-bottom, 0px) - 24px)',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}
    >
      {/* Top Header Card (Apple Liquid Glass) */}
      <div
        className="card"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 18px',
          borderRadius: 'var(--radius-lg)',
          backdropFilter: 'blur(16px)',
          backgroundColor: 'rgba(255, 255, 255, 0.85)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.03)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, var(--primary), #3b82f6)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(37,99,235,0.25)'
            }}
          >
            <Bot size={22} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1 style={{ fontSize: '17px', margin: 0, fontWeight: 700 }}>Trợ Lý Kinh Doanh AI</h1>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: '9999px',
                  backgroundColor: '#dcfce7',
                  color: '#15803d'
                }}
              >
                ● Trực tuyến
              </span>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Được vận hành bởi LangGraph • Hiểu tiếng Việt tự nhiên (Asia/Ho_Chi_Minh)
            </div>
          </div>
        </div>

        <button
          onClick={() => {
            setMessages([messages[0]]);
            setSessionId(null);
            setActiveContext(null);
          }}
          className="btn btn-secondary"
          style={{
            padding: '7px 14px',
            fontSize: '12px',
            borderRadius: '9999px',
            gap: '6px'
          }}
          title="Bắt đầu đoạn chat mới"
        >
          <RefreshCw size={13} />
          <span>Đoạn chat mới</span>
        </button>
      </div>

      {/* Chat Messages Body */}
      <div
        className="card"
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          padding: 0,
          borderRadius: 'var(--radius-xl)',
          backgroundColor: 'rgba(255, 255, 255, 0.75)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(0,0,0,0.06)',
          boxShadow: '0 8px 30px rgba(0,0,0,0.04)'
        }}
      >
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '18px'
          }}
        >
          {messages.map((msg) => {
            const isBot = msg.role === 'assistant';
            const isCopied = copiedId === msg.id;

            return (
              <div
                key={msg.id}
                style={{
                  display: 'flex',
                  gap: '12px',
                  alignItems: 'flex-start',
                  alignSelf: isBot ? 'flex-start' : 'flex-end',
                  maxWidth: isBot ? '88%' : '78%'
                }}
              >
                {isBot && (
                  <div
                    style={{
                      width: '34px',
                      height: '34px',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, var(--primary), #2563eb)',
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      boxShadow: '0 2px 8px rgba(37,99,235,0.2)'
                    }}
                  >
                    <Bot size={17} />
                  </div>
                )}

                <div
                  style={{
                    backgroundColor: isBot ? '#ffffff' : '#0f172a',
                    color: isBot ? 'var(--text-primary)' : '#ffffff',
                    padding: '14px 18px',
                    borderRadius: '20px',
                    borderTopLeftRadius: isBot ? '4px' : '20px',
                    borderTopRightRadius: isBot ? '20px' : '4px',
                    fontSize: '14px',
                    lineHeight: 1.65,
                    whiteSpace: 'pre-wrap',
                    boxShadow: isBot
                      ? '0 4px 16px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02)'
                      : '0 4px 16px rgba(15,23,42,0.18)',
                    border: isBot ? '1px solid rgba(0,0,0,0.05)' : 'none',
                    position: 'relative'
                  }}
                >
                  {cleanAiText(msg.content)}

                  {/* Metadata and tool information */}
                  {msg.toolUsed && (
                    <div
                      style={{
                        marginTop: '10px',
                        paddingTop: '8px',
                        borderTop: '1px solid rgba(0,0,0,0.06)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: '11px',
                        color: 'var(--text-muted)'
                      }}
                    >
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        ⚡ Nguồn dữ liệu: <code style={{ backgroundColor: '#f1f5f9', padding: '1px 6px', borderRadius: '4px' }}>{msg.toolUsed}</code>
                      </span>

                      <button
                        type="button"
                        onClick={() => handleCopy(msg.id, msg.content)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '11px'
                        }}
                        title="Sao chép câu trả lời"
                      >
                        {isCopied ? <Check size={12} color="#16a34a" /> : <Copy size={12} />}
                        <span>{isCopied ? 'Đã sao chép' : 'Sao chép'}</span>
                      </button>
                    </div>
                  )}
                </div>

                {!isBot && (
                  <div
                    style={{
                      width: '34px',
                      height: '34px',
                      borderRadius: '50%',
                      backgroundColor: '#e2e8f0',
                      color: '#334155',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}
                  >
                    <User size={17} />
                  </div>
                )}
              </div>
            );
          })}

          {loading && (
            <div
              style={{
                display: 'flex',
                gap: '12px',
                alignItems: 'center',
                color: 'var(--text-muted)',
                fontSize: '13px'
              }}
            >
              <div
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, var(--primary), #2563eb)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <Bot size={17} />
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  backgroundColor: '#ffffff',
                  padding: '10px 16px',
                  borderRadius: '16px',
                  border: '1px solid rgba(0,0,0,0.05)',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
                }}
              >
                <Sparkles size={16} className="spin" color="var(--primary)" />
                <span>Trợ lý AI đang truy vấn cơ sở dữ liệu và phân tích...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Suggestion Pills */}
        <div
          style={{
            padding: '8px 16px',
            borderTop: '1px solid rgba(0,0,0,0.05)',
            backgroundColor: 'rgba(255,255,255,0.6)',
            display: 'flex',
            gap: '8px',
            overflowX: 'auto',
            whiteSpace: 'nowrap'
          }}
        >
          {quickPresets.map((item, idx) => {
            const Icon = item.icon;
            return (
              <button
                key={idx}
                type="button"
                className="ai-suggestion-chip"
                onClick={() => {
                  setActiveContext(item.tag);
                  handleSendMessage(item.query);
                }}
              >
                <Icon size={12} color="var(--primary)" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Modern Prompt Input Card (Matching user design screenshot) */}
        <div
          style={{
            padding: '12px 16px',
            backgroundColor: '#ffffff',
            borderTop: '1px solid rgba(0,0,0,0.06)'
          }}
        >
          <div
            className="ai-prompt-card"
            style={{
              borderRadius: '22px',
              border: '1px solid rgba(0,0,0,0.09)',
              backgroundColor: '#fafafa',
              padding: '12px 16px 10px 16px',
              boxShadow: '0 6px 24px rgba(0,0,0,0.03)',
              transition: 'border-color 0.2s, box-shadow 0.2s'
            }}
          >
            {/* Context Tag Chip (Matching mockup Card 2: ↳ Text ✕) */}
            {activeContext && (
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: '#f1f5f9',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  padding: '4px 10px',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#0f172a',
                  marginBottom: '8px'
                }}
              >
                <span style={{ color: 'var(--text-muted)' }}>↳</span>
                <span>{activeContext}</span>
                <button
                  type="button"
                  onClick={() => setActiveContext(null)}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    color: 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                  title="Xóa ngữ cảnh"
                >
                  <X size={13} />
                </button>
              </div>
            )}

            {/* Listening Banner if Speech-to-text is active */}
            {isListening && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '4px 8px',
                  marginBottom: '8px',
                  fontSize: '12px',
                  color: '#dc2626',
                  fontWeight: 600,
                  animation: 'pulse 1.5s infinite'
                }}
              >
                <span className="voice-pulse-dot" />
                <span>Đang lắng nghe giọng nói tiếng Việt... Hãy nói câu hỏi của bạn.</span>
              </div>
            )}

            {/* Main Input Textarea */}
            <textarea
              ref={textareaRef}
              rows={2}
              className="ai-prompt-textarea"
              placeholder="Hỏi bất kỳ điều gì về doanh thu, tồn kho, sản phẩm... (Ask anything)"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              style={{
                width: '100%',
                border: 'none',
                outline: 'none',
                backgroundColor: 'transparent',
                fontSize: '14px',
                lineHeight: 1.5,
                resize: 'none',
                color: 'var(--text-primary)',
                fontFamily: 'inherit'
              }}
            />

            {/* Attach Popover Menu */}
            {isAttachOpen && (
              <div
                style={{
                  backgroundColor: '#ffffff',
                  borderRadius: '16px',
                  padding: '8px',
                  marginBottom: '10px',
                  border: '1px solid rgba(0,0,0,0.08)',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}
              >
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', padding: '4px 8px' }}>
                  CHỌN NGỮ CẢNH DỮ LIỆU ĐÍNH KÈM:
                </div>
                {attachOptions.map((opt, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      setActiveContext(opt.tag);
                      setInputValue(opt.prompt);
                      setIsAttachOpen(false);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: 'none',
                      backgroundColor: 'transparent',
                      textAlign: 'left',
                      cursor: 'pointer',
                      fontSize: '13px',
                      color: 'var(--text-primary)',
                      transition: 'background 0.15s'
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f1f5f9')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <span>{opt.label}</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>+ Thêm</span>
                  </button>
                ))}
              </div>
            )}

            {/* Action Bar with Pill Buttons (Exact Match to User Reference Screenshot) */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingTop: '6px',
                marginTop: '4px'
              }}
            >
              {/* Left Action Pills: Attach, Search, Reason */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {/* 📎 Attach Pill Button */}
                <button
                  type="button"
                  className={`ai-pill-btn ${isAttachOpen ? 'active' : ''}`}
                  onClick={() => setIsAttachOpen(!isAttachOpen)}
                  title="Đính kèm ngữ cảnh dữ liệu"
                >
                  <Paperclip size={14} />
                  <span>Attach</span>
                </button>

                {/* 🌐 Search Pill Button */}
                <button
                  type="button"
                  className={`ai-pill-btn ${isSearchActive ? 'active' : ''}`}
                  onClick={() => setIsSearchActive(!isSearchActive)}
                  title="Chế độ tra cứu cơ sở dữ liệu thời gian thực"
                >
                  <Globe size={14} />
                  <span>Search</span>
                </button>

                {/* 💡 Reason Pill Button */}
                <button
                  type="button"
                  className={`ai-pill-btn ${isReasonActive ? 'active' : ''}`}
                  onClick={() => setIsReasonActive(!isReasonActive)}
                  title="Chế độ suy luận sâu và dự báo ML"
                >
                  <Lightbulb size={14} />
                  <span>Reason</span>
                </button>
              </div>

              {/* Right Action Pills: Voice & Send */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {/* Cancel / Clear button when input has text */}
                {(inputValue || activeContext) && (
                  <button
                    type="button"
                    onClick={() => {
                      setInputValue('');
                      setActiveContext(null);
                    }}
                    className="ai-pill-btn-secondary"
                    title="Hủy nội dung đang nhập"
                  >
                    <span>Hủy</span>
                  </button>
                )}

                {/* ||| Voice Pill Button (Solid Black Pill as in Mockup) */}
                <button
                  type="button"
                  onClick={toggleVoice}
                  className={`ai-voice-pill-btn ${isListening ? 'listening' : ''}`}
                  title={isListening ? 'Dừng lắng nghe' : 'Nói tiếng Việt bằng giọng nói'}
                >
                  {isListening ? (
                    <div className="voice-wave-bars">
                      <span />
                      <span />
                      <span />
                    </div>
                  ) : (
                    <span style={{ letterSpacing: '1px', fontWeight: 800, fontSize: '13px' }}>|||</span>
                  )}
                  <span>Voice</span>
                </button>

                {/* Solid Black Send Button (Matching Mockup) */}
                <button
                  type="button"
                  onClick={() => handleSendMessage()}
                  disabled={(!inputValue.trim() && !activeContext) || loading}
                  className="ai-send-pill-btn"
                  title="Gửi câu hỏi (Enter)"
                >
                  <ArrowUp size={15} strokeWidth={2.5} />
                  <span>Gửi</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .ai-suggestion-chip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          font-size: 12px;
          font-weight: 500;
          color: var(--text-secondary);
          background-color: #ffffff;
          border: 1px solid rgba(0,0,0,0.08);
          border-radius: 9999px;
          cursor: pointer;
          flex-shrink: 0;
          transition: all 0.15s ease;
        }
        .ai-suggestion-chip:hover {
          background-color: var(--primary-light);
          color: var(--primary);
          border-color: var(--primary);
          transform: translateY(-1px);
        }

        /* Pill action button */
        .ai-pill-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 14px;
          border-radius: 9999px;
          border: 1px solid rgba(0, 0, 0, 0.1);
          background-color: #ffffff;
          color: #334155;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 1px 2px rgba(0,0,0,0.02);
        }
        .ai-pill-btn:hover {
          background-color: #f8fafc;
          border-color: #cbd5e1;
          color: #0f172a;
        }
        .ai-pill-btn.active {
          background-color: #eff6ff;
          border-color: #93c5fd;
          color: #2563eb;
          font-weight: 600;
        }

        .ai-pill-btn-secondary {
          background: none;
          border: none;
          padding: 6px 12px;
          font-size: 13px;
          color: var(--text-muted);
          cursor: pointer;
          border-radius: 9999px;
          transition: background 0.15s;
        }
        .ai-pill-btn-secondary:hover {
          background-color: #e2e8f0;
          color: var(--text-primary);
        }

        /* Voice Black Pill Button */
        .ai-voice-pill-btn {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 7px 16px;
          border-radius: 9999px;
          border: none;
          background-color: #09090b;
          color: #ffffff;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
        }
        .ai-voice-pill-btn:hover {
          background-color: #27272a;
          transform: translateY(-1px);
        }
        .ai-voice-pill-btn.listening {
          background-color: #dc2626;
          box-shadow: 0 0 16px rgba(220, 38, 38, 0.4);
        }

        /* Send Black Pill Button */
        .ai-send-pill-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 7px 18px;
          border-radius: 9999px;
          border: none;
          background-color: #09090b;
          color: #ffffff;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
        }
        .ai-send-pill-btn:hover:not(:disabled) {
          background-color: #27272a;
          transform: translateY(-1px);
        }
        .ai-send-pill-btn:disabled {
          opacity: 0.35;
          cursor: not-allowed;
        }

        /* Voice Animated Waves */
        .voice-wave-bars {
          display: flex;
          align-items: center;
          gap: 2px;
          height: 12px;
        }
        .voice-wave-bars span {
          width: 2px;
          background-color: #ffffff;
          border-radius: 2px;
          animation: wave 0.8s ease-in-out infinite;
        }
        .voice-wave-bars span:nth-child(1) { height: 6px; animation-delay: 0.1s; }
        .voice-wave-bars span:nth-child(2) { height: 12px; animation-delay: 0.2s; }
        .voice-wave-bars span:nth-child(3) { height: 8px; animation-delay: 0.3s; }

        @keyframes wave {
          0%, 100% { transform: scaleY(0.4); }
          50% { transform: scaleY(1); }
        }

        .voice-pulse-dot {
          width: 8px;
          height: 8px;
          background-color: #dc2626;
          border-radius: 50%;
          display: inline-block;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }

        @media (min-width: 1024px) {
          .ai-chat-container {
            height: calc(100vh - var(--header-height) - 40px) !important;
          }
        }
      `}</style>
    </div>
  );
}
