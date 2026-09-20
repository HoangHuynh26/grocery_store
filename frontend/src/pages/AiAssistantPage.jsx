import React, { useState, useRef, useEffect } from 'react';
import api from '../services/api';
import { Bot, Send, User, Sparkles, RefreshCw, MessageSquare } from 'lucide-react';

export default function AiAssistantPage() {
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      content: `Xin chào! Tôi là **Trợ Lý AI Doanh Nghiệp (LangGraph Agent)** của Cửa Hàng Tạp Hóa.\n\nTôi có thể giúp bạn tra cứu nhanh doanh thu, tình hình bán hàng theo ngày/tháng, sản phẩm bán chạy, cảnh báo tồn kho và dự báo doanh thu tháng tới bằng mô hình Machine Learning.\n\nHãy chọn câu hỏi gợi ý bên dưới hoặc nhập câu hỏi của bạn!`
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const messagesEndRef = useRef(null);

  const samplePrompts = [
    'Doanh thu hôm nay bao nhiêu?',
    'Doanh thu tháng này thế nào?',
    'Hôm qua có bao nhiêu hóa đơn?',
    'Sản phẩm nào bán chạy nhất tháng này?',
    'Coca Cola bán được bao nhiêu lon?',
    'Kiểm tra mặt hàng sắp hết',
    'Dự đoán doanh thu tháng tới?'
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleSendMessage = async (textToSend) => {
    const text = (textToSend || inputValue).trim();
    if (!text || loading) return;

    const userMsg = { id: String(Date.now()), role: 'user', content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInputValue('');
    setLoading(true);

    try {
      const res = await api.post('/ai/chat', { message: text, sessionId });
      if (res.data) {
        if (!sessionId && res.data.sessionId) {
          setSessionId(res.data.sessionId);
        }
        const botMsg = {
          id: String(Date.now() + 1),
          role: 'assistant',
          content: res.data.reply,
          toolUsed: res.data.toolUsed
        };
        setMessages((prev) => [...prev, botMsg]);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: String(Date.now() + 1),
          role: 'assistant',
          content: 'Xin lỗi, không thể xử lý câu hỏi lúc này. Vui lòng kiểm tra lại kết nối.'
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="page-container ai-chat-container"
      style={{
        maxWidth: '900px',
        height: 'calc(100vh - var(--header-height) - var(--mobile-nav-height) - env(safe-area-inset-bottom, 0px) - 24px)',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '10px',
            backgroundColor: 'var(--primary-light)',
            color: 'var(--primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Bot size={22} />
          </div>
          <div>
            <h1 style={{ fontSize: '18px' }}>Trợ Lý Kinh Doanh AI</h1>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Được vận hành bởi LangGraph • Hiểu tiếng Việt tự nhiên (Asia/Ho_Chi_Minh)
            </div>
          </div>
        </div>

        <button
          onClick={() => {
            setMessages([messages[0]]);
            setSessionId(null);
          }}
          className="btn btn-secondary"
          style={{ padding: '6px 12px', fontSize: '12px' }}
        >
          <RefreshCw size={14} />
          <span>Đoạn chat mới</span>
        </button>
      </div>

      {/* Chat Messages Body */}
      <div className="card" style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        padding: 0
      }}>
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}>
          {messages.map((msg) => {
            const isBot = msg.role === 'assistant';
            return (
              <div
                key={msg.id}
                style={{
                  display: 'flex',
                  gap: '12px',
                  alignItems: 'flex-start',
                  alignSelf: isBot ? 'flex-start' : 'flex-end',
                  maxWidth: '85%'
                }}
              >
                {isBot && (
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--primary)',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <Bot size={16} />
                  </div>
                )}

                <div style={{
                  backgroundColor: isBot ? 'var(--bg-card-secondary)' : 'var(--primary)',
                  color: isBot ? 'var(--text-primary)' : '#ffffff',
                  padding: '12px 16px',
                  borderRadius: 'var(--radius-lg)',
                  borderTopLeftRadius: isBot ? '4px' : 'var(--radius-lg)',
                  borderTopRightRadius: isBot ? 'var(--radius-lg)' : '4px',
                  fontSize: '14px',
                  lineHeight: 1.6,
                  whiteSpace: 'pre-wrap',
                  boxShadow: 'var(--shadow-sm)'
                }}>
                  {msg.content}

                  {msg.toolUsed && (
                    <div style={{
                      marginTop: '8px',
                      fontSize: '11px',
                      color: 'var(--text-muted)',
                      borderTop: '1px solid rgba(255,255,255,0.08)',
                      paddingTop: '4px'
                    }}>
                      ⚡ Nguồn dữ liệu: <code>{msg.toolUsed}</code>
                    </div>
                  )}
                </div>

                {!isBot && (
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--bg-card-secondary)',
                    color: 'var(--text-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <User size={16} />
                  </div>
                )}
              </div>
            );
          })}

          {loading && (
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                backgroundColor: 'var(--primary)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Bot size={16} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Sparkles size={16} className="spin" color="var(--primary)" />
                <span>Trợ lý AI đang tra cứu cơ sở dữ liệu...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Prompt Suggestions */}
        <div style={{
          padding: '8px 16px',
          borderTop: '1px solid var(--border-color)',
          backgroundColor: 'rgba(255,255,255,0.01)',
          display: 'flex',
          gap: '8px',
          overflowX: 'auto',
          whiteSpace: 'nowrap'
        }}>
          {samplePrompts.map((prompt, idx) => (
            <button
              key={idx}
              type="button"
              className="btn btn-secondary"
              style={{ padding: '6px 12px', fontSize: '12px', flexShrink: 0, borderRadius: 'var(--radius-full)' }}
              onClick={() => handleSendMessage(prompt)}
            >
              {prompt}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <div style={{
          padding: '14px 16px',
          borderTop: '1px solid var(--border-color)',
          backgroundColor: 'var(--bg-card)',
          display: 'flex',
          gap: '10px'
        }}>
          <input
            type="text"
            className="form-control"
            placeholder="Hỏi về doanh thu, hàng bán chạy, tồn kho..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSendMessage();
            }}
          />

          <button
            type="button"
            className="btn btn-primary"
            disabled={!inputValue.trim() || loading}
            onClick={() => handleSendMessage()}
            style={{ padding: '0 20px', flexShrink: 0 }}
          >
            <Send size={16} />
            <span>Gửi</span>
          </button>
        </div>
      </div>

      <style>{`
        @media (min-width: 1024px) {
          .ai-chat-container {
            height: calc(100vh - var(--header-height) - 40px) !important;
          }
        }
      `}</style>
    </div>
  );
}
