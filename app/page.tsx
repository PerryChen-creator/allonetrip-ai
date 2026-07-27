'use client';

import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  imageBase64?: string;
}

export default function Home() {
  const [destination, setDestination] = useState('');
  const [days, setDays] = useState('');
  const [styleAndInspiration, setStyleAndInspiration] = useState('');
  
  // 🎯 自訂欄位紅字錯誤狀態
  const [errors, setErrors] = useState<{ destination?: string; days?: string }>({});

  // 保留對話追問區圖片狀態
  const [chatImage, setChatImage] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [isAnswering, setIsAnswering] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  
  const [followUpInput, setFollowUpInput] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editInput, setEditInput] = useState('');

  // 複製狀態紀錄
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // DOM 錨點 Refs
  const chatTopRef = useRef<HTMLDivElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const chatFileInputRef = useRef<HTMLInputElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const loadingDotsRef = useRef<HTMLDivElement | null>(null);
  const latestAiMsgRef = useRef<HTMLDivElement | null>(null);

  // 對話追問區圖片讀取
  const handleChatImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setChatImage(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  // 思考中自動滑動到三個點
  useEffect(() => {
    if (loading || isAnswering) {
      setTimeout(() => {
        loadingDotsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }
  }, [loading, isAnswering]);

  // 回答完成自動滑動至最新回答頂部
  useEffect(() => {
    if (messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg.role === 'assistant' && !loading && !isAnswering) {
        setTimeout(() => {
          latestAiMsgRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 150);
      }
    }
  }, [messages, loading, isAnswering]);

  // 複製核心邏輯
  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => {
      setCopiedId(null);
    }, 2000);
  };

  // 輸入框高度微調：預設平齊 40px，多行時動態伸展最高 120px
  const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setFollowUpInput(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = '40px';
      const scrollH = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${Math.min(Math.max(scrollH, 40), 120)}px`;
    }
  };

  useEffect(() => {
    if (followUpInput === '' && textareaRef.current) {
      textareaRef.current.style.height = '40px';
    }
  }, [followUpInput]);

  // 中斷生成
  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setLoading(false);
    setIsAnswering(false);
  };

  // 一鍵生成主行程（帶有客製化 JS 驗證）
  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();

    // 🎯 1. 表單輸入手動檢查
    const newErrors: { destination?: string; days?: string } = {};

    if (!destination.trim()) {
      newErrors.destination = '請填寫想去的目的地';
    }

    if (!days.trim() || isNaN(Number(days)) || Number(days) < 1 || Number(days) > 365) {
      newErrors.days = '請輸入 1 至 365 之間的有效數字天數';
    }

    // 若有錯誤則阻擋送出，並更新紅字 UI
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // 驗證通過，清空錯誤
    setErrors({});
    handleStopGeneration(); 

    setLoading(true);
    setMessages([]);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const res = await fetch('/api/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          destination, 
          days: `${days} 天`, 
          style: styleAndInspiration,
        }),
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
    if ((!questionToAsk && !chatImage) || isAnswering || loading) return;

    const currentChatImage = chatImage;

    if (!customQuestion) {
      setFollowUpInput('');
      setChatImage(null);
      if (textareaRef.current) textareaRef.current.style.height = '40px';
    }
    
    setIsAnswering(true);

    const updatedMessages: Message[] = [
      ...messages,
      { 
        role: 'user', 
        content: questionToAsk || '（請參考上傳的圖片）',
        imageBase64: currentChatImage || undefined
      }
    ];
    setMessages(updatedMessages);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const res = await fetch('/api/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destination,
          days: `${days} 天`,
          style: styleAndInspiration,
          messages: updatedMessages,
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
        setMessages([...updatedMessages, { role: 'assistant', content: '❌ 追問失敗，請檢查網路連線。' }]);
      }
    } finally {
      setIsAnswering(false);
      abortControllerRef.current = null;
    }
  };

  // 編輯問題並重新發送
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

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const res = await fetch('/api/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destination, days: `${days} 天`, style: styleAndInspiration, messages: updatedMessages,
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

  // 防誤觸發送的鍵盤邏輯
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.nativeEvent.isComposing) return;

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
          <p className="text-sm text-slate-500">
            <a 
              href="https://www.instagram.com/allonetrip_perry/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-slate-700 font-medium hover:underline hover:text-black transition-colors"
            >
              @allonetrip_perry
            </a>
            {' '}專屬行程規劃
          </p>
        </div>

        {/* 輸入表單 (帶有 noValidate 關閉瀏覽器原生醜氣泡) */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <form onSubmit={handleGenerate} noValidate className="space-y-4">
            
            {/* 目的地欄位 */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">想去哪裡獨旅？</label>
              <input 
                type="text" 
                value={destination} 
                onChange={(e) => {
                  setDestination(e.target.value);
                  if (errors.destination) setErrors((prev) => ({ ...prev, destination: undefined }));
                }} 
                className={`w-full px-4 py-2.5 bg-white border rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 transition-all ${
                  errors.destination 
                    ? 'border-red-500 focus:ring-red-500 bg-red-50/30' 
                    : 'border-slate-300 focus:ring-black'
                }`} 
                placeholder="例如：日本東京、台灣環島、紐約" 
              />
              {/* 🎯 欄位下方專屬紅字提示 */}
              {errors.destination && (
                <p className="mt-1.5 text-xs text-red-500 font-medium flex items-center gap-1">
                  <span>⚠️</span> {errors.destination}
                </p>
              )}
            </div>

            {/* 預計天數 */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">預計天數 (天)</label>
              <input 
                type="text" 
                inputMode="numeric"
                value={days} 
                onChange={(e) => {
                  const numStr = e.target.value.replace(/[^0-9]/g, '');
                  if (numStr === '' || Number(numStr) <= 365) {
                    setDays(numStr);
                  }
                  if (errors.days) setErrors((prev) => ({ ...prev, days: undefined }));
                }} 
                className={`w-full px-4 py-2.5 bg-white border rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 transition-all ${
                  errors.days 
                    ? 'border-red-500 focus:ring-red-500 bg-red-50/30' 
                    : 'border-slate-300 focus:ring-black'
                }`} 
                placeholder="請輸入數字，限定最多 365 天" 
              />
              {/* 🎯 欄位下方專屬紅字提示 */}
              {errors.days && (
                <p className="mt-1.5 text-xs text-red-500 font-medium flex items-center gap-1">
                  <span>⚠️</span> {errors.days}
                </p>
              )}
            </div>

            {/* 獨旅風格與靈感 (選填) */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">獨旅風格與靈感 (選填) 🔗</label>
              <input 
                type="text" 
                value={styleAndInspiration} 
                onChange={(e) => setStyleAndInspiration(e.target.value)} 
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-black transition-all text-sm" 
                placeholder="例如：探索登山、夜生活，或貼上連結" 
              />
              <p className="mt-1.5 text-xs text-slate-400">
                可輸入旅遊喜好，或貼上 IG / YouTube 公開景點圖片或影片連結
              </p>
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

        {/* 顯示結果與對話區域 */}
        {(messages.length > 0 || loading) && (
          <div ref={chatTopRef} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-6 scroll-mt-6">
            <h2 className="text-xl font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center justify-between">
              <span>📍 專屬獨旅行程對話</span>
              {(loading || isAnswering) && <span className="text-sm font-normal text-slate-400 animate-pulse">AI 思考中...</span>}
            </h2>
            
            <div className="space-y-6">
              {messages.map((msg, idx) => {
                const isLastAiMsg = (idx === messages.length - 1) && (msg.role === 'assistant');
                
                return (
                  <div 
                    key={idx} 
                    ref={isLastAiMsg ? latestAiMsgRef : null}
                    className="space-y-2 scroll-mt-8"
                  >
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
                            <div className="bg-slate-900 text-white p-4 rounded-2xl rounded-tr-none text-sm whitespace-pre-wrap leading-relaxed max-w-[85%] shadow-sm space-y-2">
                              {msg.imageBase64 && (
                                <img src={msg.imageBase64} alt="User attachment" className="max-w-[200px] max-h-[150px] object-cover rounded-lg border border-slate-700 shadow-sm" />
                              )}
                              <p>{msg.content}</p>
                            </div>
                            
                            {/* 用戶訊息 Icon 操作按鈕區 */}
                            <div className="flex items-center gap-1 mr-1 mt-1">
                              <div className="relative group/tooltip">
                                <button
                                  onClick={() => handleCopy(msg.content, `user-${idx}`)}
                                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
                                  aria-label="複製問題"
                                >
                                  {copiedId === `user-${idx}` ? (
                                    <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                    </svg>
                                  ) : (
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                    </svg>
                                  )}
                                </button>
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover/tooltip:block bg-slate-800 text-white text-[11px] py-1 px-2 rounded shadow-md whitespace-nowrap pointer-events-none z-10">
                                  {copiedId === `user-${idx}` ? '已複製' : '複製問題'}
                                </div>
                              </div>

                              <div className="relative group/tooltip">
                                <button
                                  onClick={() => {
                                    setEditingIndex(idx);
                                    setEditInput(msg.content);
                                  }}
                                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
                                  aria-label="編輯問題"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                  </svg>
                                </button>
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover/tooltip:block bg-slate-800 text-white text-[11px] py-1 px-2 rounded shadow-md whitespace-nowrap pointer-events-none z-10">
                                  編輯問題
                                </div>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    ) : (
                      <div className="bg-slate-50 text-slate-800 p-5 rounded-2xl rounded-tl-none text-sm border border-slate-100 leading-relaxed shadow-sm space-y-3 overflow-hidden">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            p: ({ children }) => <p className="mb-3 last:mb-0 leading-relaxed whitespace-pre-wrap">{children}</p>,
                            ul: ({ children }) => <ul className="list-disc pl-5 mb-3 space-y-1">{children}</ul>,
                            ol: ({ children }) => <ol className="list-decimal pl-5 mb-3 space-y-1">{children}</ol>,
                            li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                            h3: ({ children }) => <h3 className="text-base font-bold text-slate-900 mt-4 mb-2">{children}</h3>,
                            
                            /* 外連 Icon 樣式 */
                            a: ({ href, children }) => (
                              <a
                                href={href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-0.5 text-blue-600 hover:text-blue-800 font-medium underline underline-offset-4 decoration-blue-300 hover:decoration-blue-600 transition-colors mx-0.5"
                                title={`${typeof children === 'string' ? children : '外部連結'} (將在新的分頁開啟)`}
                              >
                                <span>{children}</span>
                                <svg className="w-3 h-3 text-blue-500 opacity-80 shrink-0 inline-block ml-0.5 relative -top-[1px]" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                                </svg>
                                <span className="sr-only">(另開新視窗)</span>
                              </a>
                            ),

                            /* 表格組件 */
                            table: ({ children }) => (
                              <div className="overflow-x-auto my-4 rounded-xl border border-slate-200 bg-white shadow-sm">
                                <table className="min-w-full divide-y divide-slate-200 text-sm text-slate-700">{children}</table>
                              </div>
                            ),
                            thead: ({ children }) => <thead className="bg-slate-100/80 font-semibold text-slate-900 border-b border-slate-200">{children}</thead>,
                            tbody: ({ children }) => <tbody className="divide-y divide-slate-100 bg-white">{children}</tbody>,
                            tr: ({ children }) => <tr className="hover:bg-slate-50/80 transition-colors">{children}</tr>,
                            th: ({ children }) => <th className="px-4 py-3 text-left font-bold text-xs tracking-wider text-slate-700 uppercase">{children}</th>,
                            td: ({ children }) => <td className="px-4 py-3 whitespace-nowrap leading-relaxed">{children}</td>,
                          }}
                        >
                          {msg.content}
                        </ReactMarkdown>

                        <div className="pt-2 border-t border-slate-200/60 flex justify-end">
                          <div className="relative group/tooltip">
                            <button
                              onClick={() => handleCopy(msg.content, `ai-${idx}`)}
                              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-md transition-colors"
                              aria-label="複製回應"
                            >
                              {copiedId === `ai-${idx}` ? (
                                <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                </svg>
                              ) : (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                              )}
                            </button>
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover/tooltip:block bg-slate-800 text-white text-[11px] py-1 px-2 rounded shadow-md whitespace-nowrap pointer-events-none z-10">
                              {copiedId === `ai-${idx}` ? '已複製' : '複製回應'}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {(loading || isAnswering) && (
                <div ref={loadingDotsRef} className="bg-slate-50 text-slate-500 p-4 rounded-2xl rounded-tl-none text-sm border border-slate-100 w-fit scroll-mt-6">
                  <div className="flex gap-1.5">
                    <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></span>
                    <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                    <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} className="h-4" />
            </div>
          </div>
        )}

      </div>

      {/* 固定底部的對話追問欄位 */}
      {(messages.length > 0 || loading || isAnswering) && (
        <div className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-t border-slate-200 p-3 shadow-[0_-4px_10px_rgba(0,0,0,0.05)] z-50">
          <div className="max-w-2xl mx-auto space-y-2">
            
            {/* 追問區圖片預覽 */}
            {chatImage && (
              <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-lg w-fit">
                <img src={chatImage} alt="Chat attachment" className="w-8 h-8 object-cover rounded border border-slate-300" />
                <span className="text-xs text-slate-500">照片已載入</span>
                <button 
                  type="button" 
                  onClick={() => setChatImage(null)} 
                  className="text-red-500 hover:text-red-700 text-xs ml-1 font-bold px-1"
                >
                  ✕
                </button>
              </div>
            )}

            <div className="flex items-end gap-2">
              <button
                type="button"
                onClick={() => chatFileInputRef.current?.click()}
                className="h-[40px] w-[40px] bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl flex items-center justify-center shrink-0 border border-slate-300 transition-colors shadow-sm"
                title="上傳圖片發問"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
              <input
                ref={chatFileInputRef}
                type="file"
                accept="image/*"
                onChange={handleChatImageChange}
                className="hidden"
              />

              <textarea
                ref={textareaRef}
                rows={1}
                value={followUpInput}
                onChange={handleTextareaInput}
                onKeyDown={handleKeyDown}
                placeholder="繼續追問 (Shift+Enter 換行, Enter 發送)..."
                className="flex-1 px-3.5 py-[9px] text-sm bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-black focus:bg-white transition-all resize-none overflow-y-auto leading-[20px] shadow-inner"
                style={{ height: '40px', minHeight: '40px', maxHeight: '120px' }}
              />

              {(loading || isAnswering) ? (
                <button
                  onClick={handleStopGeneration}
                  className="bg-red-600 text-white px-4 h-[40px] text-sm rounded-xl hover:bg-red-700 transition-colors font-medium shrink-0 shadow-sm flex items-center justify-center"
                >
                  ⏹️ 暫停
                </button>
              ) : (
                <button
                  onClick={() => handleFollowUp()}
                  disabled={!followUpInput.trim() && !chatImage}
                  className="bg-black text-white px-4 h-[40px] text-sm rounded-xl hover:bg-slate-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed font-medium shrink-0 shadow-sm flex items-center justify-center"
                >
                  發送
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}