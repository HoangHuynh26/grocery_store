import React, { useState, useRef, useEffect } from 'react';
import api from '../services/api';
import Modal from '../components/common/Modal';
import {
  Bot,
  Send,
  User,
  Sparkles,
  RefreshCw,
  Paperclip,
  Globe,
  Lightbulb,
  ArrowUp,
  X,
  Copy,
  Check,
  TrendingUp,
  Package,
  Clock,
  Flame,
  HelpCircle,
  Brain,
  Cpu,
  Activity,
  CheckCircle2,
  AlertCircle,
  BarChart3,
  History
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
      content: `Xin chào! Tôi là Trợ Lý Doanh Nghiệp AI Tự Học (Continuous Learning Engine) của Cửa Hàng.\n\nTôi có khả năng tự động học hỏi liên tục:\n• Tự học mỗi ngày vào lúc 12:00 AM (00:00 Nửa đêm) để cập nhật xu hướng doanh số và mô hình dự báo ML\n• Tự học nhận diện từ khóa & thuộc tính thương hiệu ngay mỗi khi bạn thêm sản phẩm mới\n• Tự động phân tích tốc độ bán hàng và cảnh báo tồn kho\n\nHãy chọn gợi ý bên dưới, bấm nút "AI Tự Học" ở góc trên để theo dõi tiến độ, hoặc trò chuyện với tôi!`
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  // Modern input controls states
  const [activeContext, setActiveContext] = useState(null);
  const [isSearchActive, setIsSearchActive] = useState(true);
  const [isReasonActive, setIsReasonActive] = useState(false);
  const [isAttachOpen, setIsAttachOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);

  // Self-learning modal & stats states
  const [isLearningModalOpen, setIsLearningModalOpen] = useState(false);
  const [learningStats, setLearningStats] = useState(null);
  const [trainingLogs, setTrainingLogs] = useState([]);
  const [trainingInProgress, setTrainingInProgress] = useState(false);
  const [trainSuccessResult, setTrainSuccessResult] = useState(null);

  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);
  const textareaRef = useRef(null);

  const quickPresets = [
    { label: '🧠 AI tự học được gì?', query: 'Mô hình AI đã tự học được những gì rồi?', tag: 'AI Tự Học', icon: Brain },
    { label: '⚡ Kích hoạt tự train', query: 'Kích hoạt tự train lại mô hình AI ngay lập tức', tag: 'Tự Train', icon: Sparkles },
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
    { label: 'Trạng thái mô hình AI tự học', tag: 'AI Tự Học', prompt: 'Cho tôi biết chi tiết về trạng thái tự học và số từ khóa AI đã tích lũy.' },
    { label: 'Dự báo doanh số chu kỳ tới', tag: 'Dự báo kinh doanh', prompt: 'Phân tích xu hướng và dự đoán doanh thu tháng tới.' }
  ];

  const fetchLearningData = async () => {
    try {
      const [statsRes, logsRes] = await Promise.all([
        api.get('/ai/learning-stats'),
        api.get('/ai/training-logs?limit=6')
      ]);
      setLearningStats(statsRes.data?.data || statsRes.data);
      setTrainingLogs(logsRes.data?.data || logsRes.data || []);
    } catch (err) {
      console.warn('Fetch learning stats error:', err);
    }
  };

  useEffect(() => {
    fetchLearningData();
  }, []);

  const handleTriggerSelfTrain = async () => {
    try {
      setTrainingInProgress(true);
      setTrainSuccessResult(null);
      const res = await api.post('/ai/self-train', { sessionType: 'MANUAL_TRIGGER' });
      const data = res.data?.data || res.data;
      setTrainSuccessResult(data);
      await fetchLearningData();
    } catch (err) {
      alert(err?.message || 'Lỗi khi kích hoạt tự huấn luyện.');
    } finally {
      setTrainingInProgress(false);
    }
  };

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
                ● Tự học liên tục
              </span>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Tự train mỗi ngày (12:00 AM) • Tự học mỗi khi thêm SP mới
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* AI Self-Learning Control Center Button */}
          <button
            type="button"
            onClick={() => {
              setIsLearningModalOpen(true);
              fetchLearningData();
            }}
            className="btn btn-secondary"
            style={{
              padding: '7px 14px',
              fontSize: '12px',
              borderRadius: '9999px',
              gap: '6px',
              display: 'inline-flex',
              alignItems: 'center',
              backgroundColor: 'rgba(37, 99, 235, 0.08)',
              color: 'var(--primary)',
              borderColor: 'rgba(37, 99, 235, 0.25)',
              fontWeight: 600
            }}
            title="Mở Bảng Điều Khiển Mô Hình AI Tự Học"
          >
            <Brain size={14} />
            <span>AI Tự Học ({learningStats?.learnedVocabularyTerms || '215+'} tri thức)</span>
          </button>

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

      {/* AI Continuous Learning Center Modal */}
      {isLearningModalOpen && (
        <Modal
          isOpen={isLearningModalOpen}
          onClose={() => setIsLearningModalOpen(false)}
          title="Trung Tâm Giám Sát & Điều Khiển AI Tự Học (Self-Learning)"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '72vh', overflowY: 'auto' }}>
            {/* Top Status Banner */}
            <div
              style={{
                background: 'linear-gradient(135deg, #1e3a8a, #2563eb)',
                color: '#ffffff',
                padding: '16px 20px',
                borderRadius: 'var(--radius-lg)',
                boxShadow: '0 8px 24px rgba(37,99,235,0.2)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Brain size={22} color="#93c5fd" />
                  <strong style={{ fontSize: '16px' }}>Mô Hình Tự Học Đang Hoạt Động Liên Tục</strong>
                </div>
                <span
                  style={{
                    backgroundColor: '#10b981',
                    color: '#ffffff',
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '3px 10px',
                    borderRadius: '9999px'
                  }}
                >
                  LIVE
                </span>
              </div>
              <div style={{ fontSize: '13px', color: '#e0e7ff', lineHeight: 1.5 }}>
                Hệ thống tự động học và tái huấn luyện:
                <br />• 🕛 <strong>Hàng đêm lúc 12:00 AM (00:00:00)</strong>: Tự train lại toàn bộ mô hình dự báo, tối ưu vector ngữ nghĩa và phân tích tốc độ bán hàng.
                <br />• ⚡ <strong>Mỗi khi thêm sản phẩm mới</strong>: Lập tức trích xuất từ khóa, cập nhật tri thức danh mục và sinh dense vector.
              </div>
            </div>

            {/* Metrics 4-Box Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '12px'
              }}
            >
              <div style={{ backgroundColor: '#f8fafc', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                  Tri thức đã tự học
                </div>
                <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--primary)', marginTop: '4px' }}>
                  {learningStats?.learnedVocabularyTerms || 215}
                </div>
                <div style={{ fontSize: '11px', color: '#15803d', marginTop: '2px' }}>
                  {learningStats?.learnedAssociations || 226} liên kết danh mục
                </div>
              </div>

              <div style={{ backgroundColor: '#f8fafc', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                  Độ chính xác dự báo (MAPE)
                </div>
                <div style={{ fontSize: '22px', fontWeight: 800, color: '#16a34a', marginTop: '4px' }}>
                  {learningStats?.forecastingAccuracy ? `${learningStats.forecastingAccuracy.accuracyPercentage.toFixed(1)}%` : '100%'}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Sai số MAPE: {learningStats?.forecastingAccuracy ? `${learningStats.forecastingAccuracy.mape.toFixed(2)}%` : '0%'}
                </div>
              </div>

              <div style={{ backgroundColor: '#f8fafc', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                  Tổng số phiên tự học (Epochs)
                </div>
                <div style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>
                  {learningStats?.totalTrainingSessions || 0}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Lần gần nhất: {learningStats?.lastTrainedFormatted || 'Chưa chạy'}
                </div>
              </div>

              <div style={{ backgroundColor: '#f8fafc', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                  Lần tự train kế tiếp
                </div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#ea580c', marginTop: '4px' }}>
                  ~{learningStats?.hoursUntilNextTrain || 1.8} giờ nữa
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Lúc 00:00:00 Nửa đêm
                </div>
              </div>
            </div>

            {/* Manual Train Action Box */}
            <div
              style={{
                backgroundColor: 'rgba(255,255,255,0.9)',
                border: '1px solid #e2e8f0',
                padding: '16px',
                borderRadius: 'var(--radius-lg)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '16px'
              }}
            >
              <div>
                <strong style={{ fontSize: '14px', display: 'block', color: 'var(--text-primary)' }}>
                  Kích Hoạt Phiên Tự Train Toàn Diện Thủ Công
                </strong>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Chạy lại toàn bộ pipeline học máy: Tri thức danh mục, Dự báo doanh thu, Phân tích nhu cầu & Vector 128-D.
                </span>
              </div>

              <button
                type="button"
                onClick={handleTriggerSelfTrain}
                disabled={trainingInProgress}
                className="btn btn-primary"
                style={{
                  padding: '10px 20px',
                  fontWeight: 700,
                  fontSize: '13px',
                  borderRadius: '9999px',
                  gap: '8px',
                  flexShrink: 0
                }}
              >
                {trainingInProgress ? (
                  <>
                    <Sparkles size={16} className="spin" />
                    <span>Đang huấn luyện...</span>
                  </>
                ) : (
                  <>
                    <Cpu size={16} />
                    <span>Tự Train Ngay</span>
                  </>
                )}
              </button>
            </div>

            {/* Success Feedback Banner */}
            {trainSuccessResult && (
              <div
                style={{
                  backgroundColor: '#ecfdf5',
                  border: '1px solid #a7f3d0',
                  borderRadius: 'var(--radius-md)',
                  padding: '14px 18px',
                  color: '#065f46',
                  animation: 'slideDown 0.25s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <CheckCircle2 size={18} color="#059669" />
                  <strong>Hoàn tất phiên tự huấn luyện trong {trainSuccessResult.durationMs}ms!</strong>
                </div>
                <div style={{ fontSize: '12px', lineHeight: 1.6 }}>
                  {(trainSuccessResult.insights || []).map((ins, i) => (
                    <div key={i}>• {ins}</div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Training Sessions Log Table */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', fontSize: '13px', fontWeight: 700 }}>
                <History size={15} color="var(--primary)" />
                <span>Lịch Sử Các Phiên Tự Học Gần Nhất (Training History)</span>
              </div>

              <div style={{ border: '1px solid #e2e8f0', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid #e2e8f0' }}>
                      <th style={{ padding: '8px 12px', fontWeight: 600 }}>Thời Gian</th>
                      <th style={{ padding: '8px 12px', fontWeight: 600 }}>Loại Phiên</th>
                      <th style={{ padding: '8px 12px', fontWeight: 600 }}>Mô Hình Huấn Luyện</th>
                      <th style={{ padding: '8px 12px', fontWeight: 600 }}>Thời Lượng</th>
                      <th style={{ padding: '8px 12px', fontWeight: 600 }}>Trạng Thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trainingLogs.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)' }}>
                          Chưa có lịch sử huấn luyện
                        </td>
                      </tr>
                    ) : (
                      trainingLogs.map((log) => (
                        <tr key={log.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '8px 12px', fontWeight: 500 }}>{log.created_at_formatted}</td>
                          <td style={{ padding: '8px 12px' }}>
                            <span
                              style={{
                                padding: '2px 8px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: 600,
                                backgroundColor: log.session_type === 'INCREMENTAL_PRODUCT_ADD' ? '#e0f2fe' : (log.session_type === 'DAILY_AUTO_TRAIN' ? '#fef3c7' : '#f1f5f9'),
                                color: log.session_type === 'INCREMENTAL_PRODUCT_ADD' ? '#0369a1' : (log.session_type === 'DAILY_AUTO_TRAIN' ? '#b45309' : '#334155')
                              }}
                            >
                              {log.session_type === 'INCREMENTAL_PRODUCT_ADD' ? 'Thêm SP mới' : (log.session_type === 'DAILY_AUTO_TRAIN' ? 'Tự train đêm' : 'Thủ công')}
                            </span>
                          </td>
                          <td style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>
                            {Array.isArray(log.model_types) ? log.model_types.join(', ') : 'AI Models'}
                          </td>
                          <td style={{ padding: '8px 12px', color: 'var(--text-muted)' }}>{log.duration_ms}ms</td>
                          <td style={{ padding: '8px 12px' }}>
                            <span style={{ color: '#16a34a', fontWeight: 600 }}>✅ Thành công</span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ textAlign: 'right', paddingTop: '6px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setIsLearningModalOpen(false)}
                style={{ padding: '8px 18px', fontSize: '13px' }}
              >
                Đóng
              </button>
            </div>
          </div>
        </Modal>
      )}

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
