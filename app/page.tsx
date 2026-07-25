'use client';

import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function Home() {
  const [destination, setDestination] = useState('');
  const [days, setDays] = useState('');
  const [style, setStyle] = useState('');
  const [inspiration, setInspiration] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [isAnswering, setIsAnswering] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  
  const [followUpInput, setFollowUpInput] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editInput, setEditInput] = useState('');

  // DOM 錨點 Refs
  const chatTopRef = useRef<HTMLDivElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // 輸入框自動長高邏輯 (最大 4 行後出現 Scrollbar)
  const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setFollowUpInput(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'; // 先歸零以重新計算
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  };

  // 當清空輸入框時，恢復預設高度
  useEffect(() => {
    if (followUpInput === '' && textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [followUpInput]);

  // 中斷 AI 生成
  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setLoading(false);
    setIsAnswering(false);
  };

  // 一鍵生成主行程
  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    handleStopGeneration(); 

    setLoading(true);
    setMessages([]);

    // 1. 自動向下滑動至「產出內容的最上方」
    setTimeout(() => {
      chatTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const res = await fetch('/api/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ destination, days, style, inspiration }),
        signal: controller.signal,
      });

      const data = await res.json();
      const resultText = data.itinerary || data.error || '無法取得行程';
      
      setMessages([{ role: 'assistant', content: resultText }]);
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setMessages([{ role: 'assistant', content: '⏹️ 已暫停 AI 生成。您可以直接在下方詢問其他問題！' }]);
      } else {
        setMessages([{ role: 'assistant', content: '❌ 系統連線發生錯誤，請重試！' }]);
      }
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  };

  // 發送追問
  const handleFollowUp = async (customQuestion?: string) => {
    const questionToAsk = customQuestion || followUpInput.trim();
    if (!questionToAsk || isAnswering || loading) return;

    if (!customQuestion) {
      setFollowUpInput('');
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
    }
    
    setIsAnswering(true);

    const updatedMessages: Message[] = [
      ...messages,
      { role: 'user', content: questionToAsk }
    ];
    setMessages(updatedMessages);

    // 追問時滑動到底部看最新對話
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, 100);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const res = await fetch('/api/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destination,
          days,
          style,
          inspiration,
          messages: updatedMessages,
        }),
        signal: controller.signal,
      });

      const data = await res.json();
      const replyText = data.reply || data.itinerary || '無法取得回答';

      setMessages([...updatedMessages, { role: 'assistant', content: replyText }]);
      
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }, 100);
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setMessages([...updatedMessages, { role: 'assistant', content: '⏹️ 已暫停回應。' }]);
      } else {
        setMessages([...updatedMessages, { role: 'assistant', content: '❌ 追問失敗，請檢查網路連線。' }]);
      }
    } finally {
      setIsAnswering(false);
      abortControllerRef.current = null;
    }
  };

  // 編輯問題並重新生成
  const handleSaveEdit = async (index: number) => {
    if (!editInput.trim()) return;
    handleStopGeneration();

    const newQuestion = editInput.trim();
    setEditingIndex(null);
    setIsAnswering(true);

    const updatedMessages: Message[] = [
      ...messages.slice(0, index),
      { role: 'user', content: newQuestion }
    ];
    setMessages(updatedMessages);

    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, 100);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const res = await fetch('/api/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destination, days, style, inspiration, messages: updatedMessages,
        }),
        signal: controller.signal,
      });

      const data = await res.json();
      const replyText = data.reply || data.itinerary || '無法取得回答';

      setMessages([...updatedMessages, { role: 'assistant', content: replyText }]);
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setMessages([...updatedMessages, { role: 'assistant', content: '⏹️ 已暫停回應。' }]);
      } else {
        setMessages([...updatedMessages, { role: 'assistant', content: '❌ 追問失敗，請重試。' }]);
      }
    } finally {
      setIsAnswering(false);
      abortControllerRef.current = null;
    }
  };

  // 鍵盤事件處理 (Enter 發送 / Shift+Enter 換行)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleFollowUp();
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8 pb-40">
      <div className="max-w-2xl mx-auto space-y-8">
        
        {/* 標頭 */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-extrabold text-slate-900 sm:text-4xl">
            🧳 獨旅 AI 幫手
          </h1>
          <p className="text-sm text-slate-500">@allonetrip_perry 專屬行程規劃</p>
        </div>

        {/* 輸入表單 */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <form onSubmit={handleGenerate} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">想去哪裡獨旅？</label>
              <input type="text" value={destination} onChange={(e) => setDestination(e.target.value)} className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-black" placeholder="例如：日本東京、倫敦、紐約" required />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">預計天數</label>
              <input type="text" value={days} onChange={(e) => setDays(e.target.value)} className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-black" placeholder="例如 3 天 2 夜" required />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">獨旅風格</label>
              <input type="text" value={style} onChange={(e) => setStyle(e.target.value)} className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-black" placeholder="例如：探索登山景點、豐富夜生活" required />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">旅行靈感 (選填) 🔗</label>
              <input type="text" value={inspiration} onChange={(e) => setInspiration(e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-black" placeholder="請貼上公開旅行影片或圖片連結" />
            </div>

            <button type="submit" className="w-full bg-black text-white font-medium py-3 rounded-lg hover:bg-slate-800 transition-colors mt-2">
              一鍵生成專屬行程 ✨
            </button>
          </form>
        </div>

        {/* IG 客製化諮詢導流卡片 */}
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-6 rounded-2xl shadow-sm text-center space-y-4">
          <p className="text-base font-medium tracking-wide">想要來場更客製化的旅程規劃嗎？</p>
          <a href="https://www.instagram.com/allonetrip_perry/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 bg-white text-slate-900 px-6 py-2.5 rounded-lg font-semibold text-sm hover:bg-slate-100 transition-all transform hover:-translate-y-0.5 shadow-sm">
            <span>📩 與我聯繫</span>
          </a>
        </div>

        {/* 顯示結果與對話區域 (只要開始載入或有訊息就顯示) */}
        {(messages.length > 0 || loading) && (
          <div ref={chatTopRef} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-6 scroll-mt-6">
            <h2 className="text-xl font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center justify-between">
              <span>📍 專屬獨旅行程對話</span>
              {(loading || isAnswering) && <span className="text-sm font-normal text-slate-400 animate-pulse">AI 思考中...</span>}
            </h2>
            
            <div className="space-y-6">
              {messages.map((msg, idx) => (
                <div key={idx} className="space-y-2">
                  {msg.role === 'user' ? (
                    <div className="flex flex-col items-end gap-1 w-full">
                      {editingIndex === idx ? (
                        <div className="w-full max-w-lg bg-slate-50 p-3 rounded-xl border border-slate-300 shadow-inner space-y-3">
                          <textarea
                            value={editInput}
                            onChange={(e) => {
                              setEditInput(e.target.value);
                              e.target.style.height = 'auto';
                              e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
                            }}
                            className="w-full p-2.5 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-black leading-relaxed resize-none overflow-y-auto"
                            style={{ minHeight: '60px', maxHeight: '120px' }}
                          />
                          <div className="flex justify-end gap-3">
                            <button onClick={() => setEditingIndex(null)} className="text-sm font-medium text-slate-500 hover:text-slate-800">取消</button>
                            <button onClick={() => handleSaveEdit(idx)} className="text-sm font-medium bg-black text-white px-4 py-1.5 rounded-lg hover:bg-slate-800">重新送出</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          {/* 斷行顯示設定 whitespace-pre-wrap */}
                          <div className="bg-slate-900 text-white p-4 rounded-2xl rounded-tr-none text-sm whitespace-pre-wrap leading-relaxed max-w-[85%] shadow-sm">
                            {msg.content}
                          </div>
                          {/* 顯眼的編輯按鈕 */}
                          <button
                            onClick={() => {
                              setEditingIndex(idx);
                              setEditInput(msg.content);
                            }}
                            className="text-[12px] text-slate-400 hover:text-slate-700 font-medium flex items-center gap-1 mr-1 mt-1 transition-colors"
                          >
                            ✏️ 編輯或補充問題
                          </button>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="bg-slate-50 text-slate-800 p-5 rounded-2xl rounded-tl-none text-sm border border-slate-100 leading-relaxed shadow-sm">
                      <ReactMarkdown
                        components={{
                          p: ({ children }) => <p className="mb-3 last:mb-0 leading-relaxed whitespace-pre-wrap">{children}</p>,
                          ul: ({ children }) => <ul className="list-disc pl-5 mb-3 space-y-1">{children}</ul>,
                          ol: ({ children }) => <ol className="list-decimal pl-5 mb-3 space-y-1">{children}</ol>,
                          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                          h3: ({ children }) => <h3 className="text-base font-bold text-slate-900 mt-4 mb-2">{children}</h3>,
                        }}
                      >
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  )}
                </div>
              ))}

              {/* 思考中提示區塊 */}
              {(loading || isAnswering) && (
                <div className="bg-slate-50 text-slate-500 p-4 rounded-2xl rounded-tl-none text-sm border border-slate-100 w-fit">
                  <div className="flex gap-1.5">
                    <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></span>
                    <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                    <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></span>
                  </div>
                </div>
              )}

              {/* 追問時的滾動錨點 */}
              <div ref={messagesEndRef} className="h-4" />
            </div>
          </div>
        )}

      </div>

      {/* 固定在底部的對話輸入框 (毛玻璃特效) */}
      {(messages.length > 0 || loading || isAnswering) && (
        <div className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-t border-slate-200 p-3 shadow-[0_-4px_10px_rgba(0,0,0,0.05)] z-50">
          <div className="max-w-2xl mx-auto flex items-end gap-2">
            <textarea
              ref={textareaRef}
              value={followUpInput}
              onChange={handleTextareaInput}
              onKeyDown={handleKeyDown}
              placeholder="繼續追問 (Shift+Enter 換行, Enter 發送)..."
              className="flex-1 px-4 py-3 text-sm bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-black focus:bg-white transition-all resize-none overflow-y-auto leading-relaxed shadow-inner"
              style={{ minHeight: '46px', maxHeight: '120px' }}
            />

            {/* 動態切換：暫停 vs 發送 */}
            {(loading || isAnswering) ? (
              <button
                onClick={handleStopGeneration}
                className="bg-red-600 text-white px-5 py-3 text-sm rounded-xl hover:bg-red-700 transition-colors font-medium shrink-0 shadow-sm flex items-center justify-center min-h-[46px]"
              >
                ⏹️ 暫停
              </button>
            ) : (
              <button
                onClick={() => handleFollowUp()}
                disabled={!followUpInput.trim()}
                className="bg-black text-white px-5 py-3 text-sm rounded-xl hover:bg-slate-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed font-medium shrink-0 shadow-sm flex items-center justify-center min-h-[46px]"
              >
                發送
              </button>
            )}
          </div>
        </div>
      )}
    </main>
  );
}