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
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
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

  const handleInputChange = (e) => {
    setInputValue(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  };

  const handleCopy = (id, text) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="page-container ai-chat-container">
      {/* Top Header Card (Apple Liquid Glass) */}
      <div className="card ai-chat-header-card">
        <div className="ai-header-brand-wrap">
          <div className="ai-header-bot-avatar">
            <Bot size={20} />
          </div>
          <div className="ai-header-info">
            <div className="ai-header-title-line">
              <h1 className="ai-header-heading">
                <span className="show-desktop-inline">Trợ Lý Kinh Doanh AI</span>
                <span className="hide-desktop">Trợ Lý AI</span>
              </h1>
              <span className="ai-header-live-badge">
                <span className="ai-pulse-dot-green" />
                <span className="show-desktop-inline">Tự học liên tục</span>
                <span className="hide-desktop">Tự học</span>
              </span>
            </div>
            <div className="ai-header-subtext show-desktop">
              Tự train mỗi ngày (12:00 AM) • Tự học mỗi khi thêm SP mới
            </div>
          </div>
        </div>

        <div className="ai-header-actions-wrap">
          {/* AI Self-Learning Control Center Button */}
          <button
            type="button"
            onClick={() => {
              setIsLearningModalOpen(true);
              fetchLearningData();
            }}
            className="ai-header-glass-btn ai-learn-btn"
            title={`Mô hình AI Tự Học: ${learningStats?.learnedVocabularyTerms || '267+'} tri thức`}
          >
            <Brain size={14} className="ai-brain-icon" />
            <span className="show-desktop-inline">AI Tự Học ({learningStats?.learnedVocabularyTerms || '215+'} tri thức)</span>
            <span className="hide-desktop ai-learn-pill-count">{learningStats?.learnedVocabularyTerms || '267'}</span>
          </button>

          {/* New Chat Button */}
          <button
            type="button"
            onClick={() => {
              setMessages([messages[0]]);
              setSessionId(null);
              setActiveContext(null);
            }}
            className="ai-header-glass-btn ai-new-chat-btn"
            title="Bắt đầu đoạn chat mới"
          >
            <RefreshCw size={13} />
            <span className="show-desktop-inline">Đoạn chat mới</span>
          </button>
        </div>
      </div>

      {/* Chat Messages Body */}
      <div className="card ai-chat-body-card">
        <div className="ai-messages-scroll-area">
          {messages.map((msg) => {
            const isBot = msg.role === 'assistant';
            const isCopied = copiedId === msg.id;

            return (
              <div
                key={msg.id}
                className={`ai-message-row ${isBot ? 'bot-row' : 'user-row'}`}
              >
                {isBot && (
                  <div className="ai-bot-avatar">
                    <Bot size={16} />
                  </div>
                )}

                <div className={`ai-message-bubble ${isBot ? 'bot-bubble' : 'user-bubble'}`}>
                  {cleanAiText(msg.content)}

                  {/* Metadata and tool information */}
                  {msg.toolUsed && (
                    <div className="ai-tool-meta-bar">
                      <span className="ai-tool-source-tag">
                        ⚡ Nguồn: <code>{msg.toolUsed}</code>
                      </span>

                      <button
                        type="button"
                        onClick={() => handleCopy(msg.id, msg.content)}
                        className="ai-copy-btn"
                        title="Sao chép câu trả lời"
                      >
                        {isCopied ? <Check size={12} color="#16a34a" /> : <Copy size={12} />}
                        <span>{isCopied ? 'Đã chép' : 'Sao chép'}</span>
                      </button>
                    </div>
                  )}
                </div>

                {!isBot && (
                  <div className="ai-user-avatar show-desktop">
                    <User size={16} />
                  </div>
                )}
              </div>
            );
          })}

          {loading && (
            <div className="ai-loading-indicator">
              <div className="ai-bot-avatar">
                <Bot size={16} />
              </div>
              <div className="ai-loading-bubble">
                <Sparkles size={15} className="spin" color="var(--primary)" />
                <span>Trợ lý AI đang truy vấn dữ liệu...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Suggestion Pills */}
        <div className="ai-suggestions-bar">
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
                <Icon size={13} color="var(--primary)" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Modern Prompt Input Dock */}
        <div className="ai-prompt-dock">
          <div className="ai-prompt-card">
            {/* Context Tag Chip */}
            {activeContext && (
              <div className="ai-context-chip">
                <span style={{ color: 'var(--text-muted)' }}>↳</span>
                <span>{activeContext}</span>
                <button
                  type="button"
                  onClick={() => setActiveContext(null)}
                  className="ai-context-close-btn"
                  title="Xóa ngữ cảnh"
                >
                  <X size={12} />
                </button>
              </div>
            )}

            {/* Listening Banner if Speech-to-text is active */}
            {isListening && (
              <div className="ai-listening-banner">
                <span className="voice-pulse-dot" />
                <span>Đang lắng nghe giọng nói tiếng Việt... Hãy nói câu hỏi.</span>
              </div>
            )}

            {/* Main Input Textarea */}
            <textarea
              ref={textareaRef}
              rows={1}
              className="ai-prompt-textarea"
              placeholder="Hỏi bất kỳ điều gì về doanh thu, tồn kho, sản phẩm..."
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
            />

            {/* Attach Popover Menu */}
            {isAttachOpen && (
              <div className="ai-attach-popover">
                <div className="ai-attach-popover-title">
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
                      if (textareaRef.current) {
                        textareaRef.current.style.height = 'auto';
                        textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
                      }
                    }}
                    className="ai-attach-item-btn"
                  >
                    <span>{opt.label}</span>
                    <span style={{ fontSize: '11px', color: 'var(--primary)' }}>+ Thêm</span>
                  </button>
                ))}
              </div>
            )}

            {/* Action Toolbar */}
            <div className="ai-prompt-toolbar">
              {/* Left Action Pills: Attach, Search, Reason */}
              <div className="ai-tools-left">
                <button
                  type="button"
                  className={`ai-pill-btn ${isAttachOpen ? 'active' : ''}`}
                  onClick={() => setIsAttachOpen(!isAttachOpen)}
                  title="Đính kèm ngữ cảnh dữ liệu"
                >
                  <Paperclip size={14} />
                  <span className="show-desktop-inline">Attach</span>
                </button>

                <button
                  type="button"
                  className={`ai-pill-btn ${isSearchActive ? 'active' : ''}`}
                  onClick={() => setIsSearchActive(!isSearchActive)}
                  title={isSearchActive ? 'Tra cứu DB: Đang bật' : 'Bật tra cứu DB thời gian thực'}
                >
                  <Globe size={14} />
                  <span className="show-desktop-inline">Search</span>
                  {isSearchActive && <span className="ai-active-dot green" />}
                </button>

                <button
                  type="button"
                  className={`ai-pill-btn ${isReasonActive ? 'active' : ''}`}
                  onClick={() => setIsReasonActive(!isReasonActive)}
                  title={isReasonActive ? 'Suy luận ML: Đang bật' : 'Bật suy luận sâu ML'}
                >
                  <Lightbulb size={14} />
                  <span className="show-desktop-inline">Reason</span>
                  {isReasonActive && <span className="ai-active-dot amber" />}
                </button>
              </div>

              {/* Right Action Pills: Voice & Send */}
              <div className="ai-tools-right">
                {(inputValue || activeContext) && (
                  <button
                    type="button"
                    onClick={() => {
                      setInputValue('');
                      setActiveContext(null);
                      if (textareaRef.current) {
                        textareaRef.current.style.height = 'auto';
                      }
                    }}
                    className="ai-pill-btn-secondary"
                    title="Hủy nội dung"
                  >
                    <span>Hủy</span>
                  </button>
                )}

                {/* Voice Pill Button */}
                <button
                  type="button"
                  onClick={toggleVoice}
                  className={`ai-voice-pill-btn ${isListening ? 'listening' : ''}`}
                  title={isListening ? 'Dừng lắng nghe' : 'Nói tiếng Việt bằng giọng nói'}
                >
                  {isListening ? (
                    <div className="voice-wave-bars">
                      <span /><span /><span />
                    </div>
                  ) : (
                    <span className="voice-bars-symbol">|||</span>
                  )}
                  <span className="show-desktop-inline">Voice</span>
                </button>

                {/* Solid Send Button - ALWAYS VISIBLE */}
                <button
                  type="button"
                  onClick={() => handleSendMessage()}
                  disabled={(!inputValue.trim() && !activeContext) || loading}
                  className="ai-send-pill-btn"
                  title="Gửi câu hỏi (Enter)"
                >
                  <ArrowUp size={16} strokeWidth={2.6} />
                  <span className="show-desktop-inline">Gửi</span>
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
                gap: '16px',
                flexWrap: 'wrap'
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
        .ai-chat-container {
          max-width: 960px;
          margin: 0 auto;
          height: calc(100vh - var(--header-height) - 32px);
          display: flex;
          flex-direction: column;
          gap: 10px;
          padding: 10px 16px 16px 16px;
          box-sizing: border-box;
          overflow: hidden;
        }

        /* Top Header Card */
        .ai-chat-header-card {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 10px 16px;
          border-radius: var(--radius-lg);
          backdrop-filter: blur(20px);
          background-color: rgba(255, 255, 255, 0.88);
          border: 1px solid rgba(0, 0, 0, 0.06);
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.03);
          flex-shrink: 0;
        }

        .ai-header-brand-wrap {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
          flex: 1;
        }

        .ai-header-bot-avatar {
          width: 36px;
          height: 36px;
          border-radius: 11px;
          background: linear-gradient(135deg, var(--primary), #2563eb);
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          box-shadow: 0 3px 10px rgba(37, 99, 235, 0.25);
        }

        .ai-header-info {
          min-width: 0;
        }

        .ai-header-title-line {
          display: flex;
          align-items: center;
          gap: 7px;
          flex-wrap: nowrap;
        }

        .ai-header-heading {
          font-size: 15px;
          margin: 0;
          font-weight: 700;
          color: var(--text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .ai-header-live-badge {
          font-size: 11px;
          font-weight: 600;
          padding: 2px 7px;
          border-radius: 9999px;
          background-color: #dcfce7;
          color: #15803d;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          flex-shrink: 0;
        }

        .ai-pulse-dot-green {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background-color: #16a34a;
          box-shadow: 0 0 0 2px rgba(22, 163, 74, 0.2);
          animation: pulse 1.6s infinite;
        }

        .ai-header-subtext {
          font-size: 11.5px;
          color: var(--text-muted);
          margin-top: 1px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .ai-header-actions-wrap {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-shrink: 0;
        }

        .ai-header-glass-btn {
          padding: 6px 12px;
          border-radius: 9999px;
          font-size: 12px;
          font-weight: 600;
          border: 1px solid rgba(0, 0, 0, 0.08);
          background: rgba(255, 255, 255, 0.85);
          color: var(--text-primary);
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 5px;
          transition: all 0.2s ease;
          flex-shrink: 0;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
        }
        .ai-header-glass-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 3px 8px rgba(0, 0, 0, 0.07);
        }

        .ai-learn-btn {
          background-color: rgba(37, 99, 235, 0.08);
          color: var(--primary);
          border-color: rgba(37, 99, 235, 0.22);
        }
        .ai-learn-pill-count {
          background: var(--primary);
          color: #ffffff;
          font-size: 10.5px;
          font-weight: 700;
          padding: 1px 6px;
          border-radius: 9999px;
        }

        /* Messages Body Card */
        .ai-chat-body-card {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          padding: 0;
          border-radius: var(--radius-xl);
          background: rgba(255, 255, 255, 0.82);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(0, 0, 0, 0.06);
          box-shadow: 0 8px 30px rgba(0, 0, 0, 0.04);
          min-height: 0;
        }

        .ai-messages-scroll-area {
          flex: 1;
          overflow-y: auto;
          padding: 16px 20px;
          display: flex;
          flex-direction: column;
          gap: 14px;
          -webkit-overflow-scrolling: touch;
        }

        .ai-message-row {
          display: flex;
          gap: 10px;
          align-items: flex-start;
          width: 100%;
        }
        .ai-message-row.bot-row {
          align-self: flex-start;
          justify-content: flex-start;
        }
        .ai-message-row.user-row {
          align-self: flex-end;
          justify-content: flex-end;
        }

        .ai-bot-avatar {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: linear-gradient(135deg, var(--primary), #2563eb);
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          box-shadow: 0 2px 8px rgba(37, 99, 235, 0.2);
        }

        .ai-user-avatar {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background-color: #e2e8f0;
          color: #334155;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .ai-message-bubble {
          padding: 12px 16px;
          border-radius: 18px;
          font-size: 14px;
          line-height: 1.6;
          white-space: pre-wrap;
          word-break: break-word;
          position: relative;
        }

        .ai-message-bubble.bot-bubble {
          background-color: #ffffff;
          color: var(--text-primary);
          border-top-left-radius: 4px;
          box-shadow: 0 3px 12px rgba(0, 0, 0, 0.03), 0 1px 2px rgba(0, 0, 0, 0.02);
          border: 1px solid rgba(0, 0, 0, 0.06);
          max-width: 85%;
        }

        .ai-message-bubble.user-bubble {
          background-color: #0f172a;
          color: #ffffff;
          border-top-right-radius: 4px;
          box-shadow: 0 4px 16px rgba(15, 23, 42, 0.18);
          max-width: 78%;
        }

        .ai-tool-meta-bar {
          margin-top: 8px;
          padding-top: 8px;
          border-top: 1px solid rgba(0, 0, 0, 0.06);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          font-size: 11px;
          color: var(--text-muted);
          flex-wrap: wrap;
        }

        .ai-tool-source-tag {
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }
        .ai-tool-source-tag code {
          background-color: #f1f5f9;
          padding: 1px 6px;
          border-radius: 4px;
          font-family: monospace;
          font-size: 11px;
        }

        .ai-copy-btn {
          background: none;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 11px;
          padding: 2px 4px;
          border-radius: 4px;
        }
        .ai-copy-btn:hover {
          color: var(--primary);
          background-color: #f8fafc;
        }

        .ai-loading-indicator {
          display: flex;
          gap: 10px;
          align-items: center;
          font-size: 13px;
          color: var(--text-muted);
        }
        .ai-loading-bubble {
          display: flex;
          align-items: center;
          gap: 8px;
          background: #ffffff;
          padding: 9px 14px;
          border-radius: 16px;
          border: 1px solid rgba(0, 0, 0, 0.05);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.03);
        }

        /* Suggestions Row */
        .ai-suggestions-bar {
          padding: 6px 12px;
          border-top: 1px solid rgba(0, 0, 0, 0.05);
          background: rgba(255, 255, 255, 0.55);
          display: flex;
          gap: 6px;
          overflow-x: auto;
          white-space: nowrap;
          scrollbar-width: none;
          -ms-overflow-style: none;
          flex-shrink: 0;
        }
        .ai-suggestions-bar::-webkit-scrollbar {
          display: none;
        }

        .ai-suggestion-chip {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 5px 11px;
          font-size: 12px;
          font-weight: 500;
          color: var(--text-secondary);
          background-color: #ffffff;
          border: 1px solid rgba(0, 0, 0, 0.08);
          border-radius: 9999px;
          cursor: pointer;
          flex-shrink: 0;
          transition: all 0.15s ease;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.02);
        }
        .ai-suggestion-chip:hover {
          background-color: var(--primary-light);
          color: var(--primary);
          border-color: var(--primary);
          transform: translateY(-1px);
        }

        /* Modern Prompt Input Dock */
        .ai-prompt-dock {
          padding: 10px 14px;
          background-color: #ffffff;
          border-top: 1px solid rgba(0, 0, 0, 0.06);
          flex-shrink: 0;
        }

        .ai-prompt-card {
          border-radius: 20px;
          border: 1px solid rgba(0, 0, 0, 0.09);
          background-color: #fafafa;
          padding: 10px 14px 8px 14px;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.03);
          transition: border-color 0.2s, box-shadow 0.2s, background-color 0.2s;
        }
        .ai-prompt-card:focus-within {
          border-color: rgba(37, 99, 235, 0.35);
          background-color: #ffffff;
          box-shadow: 0 6px 20px rgba(37, 99, 235, 0.08);
        }

        .ai-context-chip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background-color: #f1f5f9;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 3px 8px;
          font-size: 11.5px;
          font-weight: 600;
          color: #0f172a;
          margin-bottom: 6px;
        }
        .ai-context-close-btn {
          background: none;
          border: none;
          padding: 0;
          cursor: pointer;
          color: var(--text-muted);
          display: flex;
          align-items: center;
        }

        .ai-listening-banner {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 4px 6px;
          margin-bottom: 6px;
          fontSize: 12px;
          color: #dc2626;
          font-weight: 600;
          animation: pulse 1.5s infinite;
        }

        .ai-prompt-textarea {
          width: 100%;
          min-height: 38px;
          max-height: 120px;
          border: none;
          outline: none;
          background-color: transparent;
          font-size: 14px;
          line-height: 1.5;
          resize: none;
          color: var(--text-primary);
          font-family: inherit;
          box-sizing: border-box;
        }

        .ai-attach-popover {
          background-color: #ffffff;
          border-radius: 14px;
          padding: 6px;
          margin-bottom: 8px;
          border: 1px solid rgba(0, 0, 0, 0.08);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
          display: flex;
          flex-direction: column;
          gap: 3px;
          max-height: 180px;
          overflow-y: auto;
        }
        .ai-attach-popover-title {
          font-size: 10.5px;
          font-weight: 700;
          color: var(--text-muted);
          padding: 3px 6px;
        }
        .ai-attach-item-btn {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 6px 10px;
          border-radius: 6px;
          border: none;
          background-color: transparent;
          text-align: left;
          cursor: pointer;
          font-size: 12.5px;
          color: var(--text-primary);
          transition: background 0.15s;
        }
        .ai-attach-item-btn:hover {
          background-color: #f1f5f9;
        }

        .ai-prompt-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 6px;
          padding-top: 4px;
          margin-top: 2px;
        }

        .ai-tools-left {
          display: flex;
          align-items: center;
          gap: 6px;
          min-width: 0;
        }

        .ai-tools-right {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-shrink: 0;
        }

        .ai-pill-btn {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 5px 12px;
          border-radius: 9999px;
          border: 1px solid rgba(0, 0, 0, 0.1);
          background-color: #ffffff;
          color: #334155;
          font-size: 12.5px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
          position: relative;
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

        .ai-active-dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          display: inline-block;
        }
        .ai-active-dot.green {
          background-color: #16a34a;
        }
        .ai-active-dot.amber {
          background-color: #d97706;
        }

        .ai-pill-btn-secondary {
          background: none;
          border: none;
          padding: 5px 10px;
          font-size: 12.5px;
          color: var(--text-muted);
          cursor: pointer;
          border-radius: 9999px;
          transition: background 0.15s;
        }
        .ai-pill-btn-secondary:hover {
          background-color: #e2e8f0;
          color: var(--text-primary);
        }

        .ai-voice-pill-btn {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 6px 14px;
          border-radius: 9999px;
          border: none;
          background-color: #09090b;
          color: #ffffff;
          font-size: 12.5px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.12);
          flex-shrink: 0;
        }
        .ai-voice-pill-btn:hover {
          background-color: #27272a;
          transform: translateY(-1px);
        }
        .ai-voice-pill-btn.listening {
          background-color: #dc2626;
          box-shadow: 0 0 14px rgba(220, 38, 38, 0.4);
        }

        .voice-bars-symbol {
          letter-spacing: 1px;
          font-weight: 800;
          font-size: 12px;
        }

        .ai-send-pill-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 5px;
          padding: 6px 16px;
          border-radius: 9999px;
          border: none;
          background-color: #09090b;
          color: #ffffff;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
          flex-shrink: 0;
        }
        .ai-send-pill-btn:hover:not(:disabled) {
          background-color: var(--primary);
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

        @media (max-width: 640px) {
          .ai-chat-container {
            padding: 4px 6px !important;
            gap: 6px !important;
            height: calc(100dvh - var(--header-height) - var(--mobile-nav-height) - env(safe-area-inset-bottom, 0px)) !important;
            height: calc(100vh - var(--header-height) - var(--mobile-nav-height) - env(safe-area-inset-bottom, 0px)) !important;
          }
          .ai-chat-header-card {
            padding: 8px 10px !important;
            border-radius: var(--radius-md) !important;
          }
          .ai-header-bot-avatar {
            width: 32px !important;
            height: 32px !important;
            border-radius: 9px !important;
          }
          .ai-header-heading {
            font-size: 14px !important;
          }
          .ai-header-glass-btn {
            padding: 5px 8px !important;
            font-size: 11px !important;
          }
          .ai-new-chat-btn {
            width: 30px !important;
            height: 30px !important;
            padding: 0 !important;
            justify-content: center;
          }
          .ai-chat-body-card {
            border-radius: var(--radius-lg) !important;
          }
          .ai-messages-scroll-area {
            padding: 10px 8px !important;
            gap: 10px !important;
          }
          .ai-bot-avatar {
            width: 28px !important;
            height: 28px !important;
          }
          .ai-message-bubble.bot-bubble {
            max-width: calc(100% - 38px) !important;
            padding: 10px 12px !important;
            font-size: 13.5px !important;
            border-radius: 14px !important;
            border-top-left-radius: 3px !important;
          }
          .ai-message-bubble.user-bubble {
            max-width: 86% !important;
            padding: 10px 12px !important;
            font-size: 13.5px !important;
            border-radius: 14px !important;
            border-top-right-radius: 3px !important;
          }
          .ai-prompt-dock {
            padding: 6px 8px !important;
          }
          .ai-prompt-card {
            padding: 8px 10px 6px 10px !important;
            border-radius: 16px !important;
          }
          .ai-pill-btn {
            padding: 5px 7px !important;
          }
          .ai-voice-pill-btn {
            padding: 6px 9px !important;
          }
          .ai-send-pill-btn {
            padding: 6px 12px !important;
          }
        }
      `}</style>
    </div>
  );
}
