'use client';

import React, { useState, useRef, useEffect } from 'react';

// 自訂簡易 Markdown 渲染組件
function MarkdownMessage({ content }: { content: string }) {
  const lines = content.split('\n');

  return (
    <div className="space-y-2 leading-relaxed">
      {lines.map((line, idx) => {
        let trimmed = line.trim();
        if (!trimmed) return <div key={idx} className="h-2" />;

        const isListItem = trimmed.startsWith('* ') || trimmed.startsWith('- ');
        if (isListItem) {
          trimmed = trimmed.replace(/^[\*\-]\s+/, '');
        }

        const parts = parseMarkdownText(trimmed);

        if (isListItem) {
          return (
            <div key={idx} className="flex items-start space-x-2 pl-2">
              <span className="text-blue-600 font-bold">•</span>
              <div>{parts}</div>
            </div>
          );
        }

        return <div key={idx}>{parts}</div>;
      })}
    </div>
  );
}

// 輔助函式：解析 [文字](URL) 與 **粗體**
function parseMarkdownText(text: string) {
  const regex = /(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g;
  const parts = text.split(regex);

  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index} className="font-bold">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('[') && part.includes('](') && part.endsWith(')')) {
      const match = part.match(/\[([^\]]+)\]\(([^)]+)\)/);
      if (match) {
        const [, title, url] = match;
        return (
          <a
            key={index}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 underline font-semibold mx-1"
          >
            {title}
            <svg className="w-3.5 h-3.5 ml-0.5 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        );
      }
    }
    return part;
  });
}

export default function Home() {
  const [darkMode, setDarkMode] = useState(false);

  // 1. 旅行習慣 Modal 狀態與 LocalStorage 載入
  const [isPrefModalOpen, setIsPrefModalOpen] = useState(false);
  const [userPreferences, setUserPreferences] = useState({
    departureAirport: '台北桃園 TPE',
    dietary: '無特別限制',
    budget: '平價性價比 / 背包客棧',
    customNotes: '',
  });

  // 載入與儲存 LocalStorage 偏好
  useEffect(() => {
    const saved = localStorage.getItem('allonetrip_user_prefs');
    if (saved) {
      try {
        setUserPreferences(JSON.parse(saved));
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  const handleSavePreferences = () => {
    localStorage.setItem('allonetrip_user_prefs', JSON.stringify(userPreferences));
    setIsPrefModalOpen(false);
  };

  // 表單狀態
  const [destination, setDestination] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [style, setStyle] = useState('');

  // 對話與圖片狀態
  const [messages, setMessages] = useState<Array<{ role: string; content: string; images?: string[] }>>([]);
  const [inputQuery, setInputQuery] = useState('');
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [todayStr, setTodayStr] = useState('');

  useEffect(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    setTodayStr(`${year}-${month}-${day}`);
  }, []);

  const getDaysCount = () => {
    if (!startDate || !endDate) return null;
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays > 0 ? diffDays : null;
  };

  const isFormInvalid = !destination.trim() || !startDate || !endDate;

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    if (selectedImages.length + files.length > 5) {
      alert('最多只能上傳 5 張圖片喔！');
      return;
    }

    files.forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (reader.result) {
          setSelectedImages((prev) => [...prev, reader.result as string]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index: number) => {
    setSelectedImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleGenerate = async (queryText?: string) => {
    const textToSend = queryText || inputQuery;
    if (!textToSend.trim() && selectedImages.length === 0 && messages.length === 0) {
      if (isFormInvalid) return;
    }

    setLoading(true);

    const userPrompt = textToSend || `我想去【${destination}】獨旅，日期：${startDate} 至 ${endDate}。請為我規劃行程！`;
    const newMessages = [
      ...messages,
      { role: 'user', content: userPrompt, images: selectedImages }
    ];

    setMessages(newMessages);
    setInputQuery('');
    setSelectedImages([]);

    try {
      const res = await fetch('/api/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destination,
          startDate,
          endDate,
          style,
          messages: newMessages,
          userPreferences, // 附帶使用者偏好設定
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setMessages((prev) => [...prev, { role: 'assistant', content: data.reply }]);
      } else {
        alert(data.error || '發生錯誤，請稍後重試');
      }
    } catch (err: any) {
      alert(`連線錯誤: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const daysCount = getDaysCount();

  return (
    <div className={`min-h-screen transition-colors duration-200 ${darkMode ? 'dark bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      <div className="flex flex-col md:flex-row min-h-screen">
        
        {/* 側邊欄 */}
        <div className="w-full md:w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 p-6 flex flex-col justify-between">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2 text-slate-900 dark:text-white">
              🧳 獨旅 AI 幫手
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">@allonetrip_perry 專屬行程規劃</p>
            
            {/* 🔴 綁定開啟 Modal 事件 */}
            <button
              onClick={() => setIsPrefModalOpen(true)}
              className="mt-6 w-full py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-sm font-semibold transition border border-slate-200 dark:border-slate-700 shadow-sm"
            >
              ✏️ 設定我的旅行習慣
            </button>
          </div>

          <div className="pt-6 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">切換主題模式</span>
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition"
              title="切換深色 / 淺色模式"
            >
              {darkMode ? '🌙' : '☀️'}
            </button>
          </div>
        </div>

        {/* 主內容區 */}
        <div className="flex-1 max-w-3xl mx-auto p-4 md:p-8 space-y-6">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 space-y-4">
            <div>
              <label className="block text-sm font-bold text-slate-900 dark:text-slate-100 mb-1">
                想去哪裡獨旅？
              </label>
              <input
                type="text"
                placeholder="例如：japan、關西環島"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white bg-white dark:bg-slate-800 placeholder:text-slate-500 dark:placeholder:text-slate-400 focus:ring-2 focus:ring-slate-800 outline-none text-sm font-medium transition"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  旅遊日期區間 📅
                </label>
                {daysCount && (
                  <span className="text-xs font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/50 px-2.5 py-1 rounded-full">
                    共 {daysCount} 天 ({daysCount - 1} 夜)
                  </span>
                )}
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="date"
                  min={todayStr}
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="border border-slate-300 dark:border-slate-700 p-2.5 rounded-xl text-sm font-medium text-slate-900 dark:text-white bg-white dark:bg-slate-800 focus:ring-2 focus:ring-slate-800 outline-none"
                />
                <input
                  type="date"
                  min={startDate || todayStr}
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="border border-slate-300 dark:border-slate-700 p-2.5 rounded-xl text-sm font-medium text-slate-900 dark:text-white bg-white dark:bg-slate-800 focus:ring-2 focus:ring-slate-800 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-900 dark:text-slate-100 mb-1">
                獨旅風格與靈感 (選填) 🔗
              </label>
              <input
                type="text"
                placeholder="例如：探索登山、夜生活，或貼上連結"
                value={style}
                onChange={(e) => setStyle(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white bg-white dark:bg-slate-800 placeholder:text-slate-500 dark:placeholder:text-slate-400 focus:ring-2 focus:ring-slate-800 outline-none text-sm font-medium transition"
              />
            </div>

            <button
              onClick={() => handleGenerate()}
              disabled={loading || isFormInvalid}
              className={`w-full py-3 font-bold rounded-xl shadow transition ${
                loading || isFormInvalid
                  ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed'
                  : 'bg-slate-900 hover:bg-black text-white dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100'
              }`}
            >
              {loading ? 'Perry 正在思考中，請稍等...' : '一鍵生成專屬行程 ✨'}
            </button>
          </div>

          {/* 對話區塊 */}
          {(messages.length > 0 || loading) && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 space-y-4">
              <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
                <span className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  📍 專屬獨旅行程對話
                </span>
              </div>

              <div className="space-y-4">
                {messages.map((m, i) => (
                  <div key={i} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                    {m.images && m.images.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-2">
                        {m.images.map((img, imgIdx) => (
                          <img key={imgIdx} src={img} alt="上傳圖片" className="w-20 h-20 object-cover rounded-xl border border-slate-200" />
                        ))}
                      </div>
                    )}
                    <div className={`p-4 rounded-2xl max-w-[90%] text-sm ${
                      m.role === 'user'
                        ? 'bg-blue-600 text-white font-medium'
                        : 'bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-slate-900 dark:text-slate-100'
                    }`}>
                      {m.role === 'user' ? m.content : <MarkdownMessage content={m.content} />}
                    </div>
                  </div>
                ))}

                {loading && (
                  <div className="flex items-center space-x-2 text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 w-fit">
                    <span className="animate-pulse">🔵</span>
                    <span className="text-sm font-semibold">Perry 正在思考中，請稍等...</span>
                  </div>
                )}
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                {selectedImages.length > 0 && (
                  <div className="flex gap-2 p-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
                    {selectedImages.map((img, idx) => (
                      <div key={idx} className="relative group">
                        <img src={img} alt="預覽" className="w-14 h-14 object-cover rounded-lg" />
                        <button
                          onClick={() => removeImage(idx)}
                          className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 text-xs flex items-center justify-center"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    multiple
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                  />

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2.5 text-slate-600 dark:text-slate-300 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800 rounded-xl transition border border-slate-300 dark:border-slate-700"
                    title="上傳行程圖片/靈感截圖 (最多5張)"
                  >
                    📎
                  </button>

                  <input
                    type="text"
                    placeholder="問問 Perry...（例如：展開 Day 1-5 的細節，或附圖詢問）"
                    value={inputQuery}
                    onChange={(e) => setInputQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleGenerate(inputQuery)}
                    className="flex-1 px-4 py-2.5 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-900 dark:text-white bg-white dark:bg-slate-800 placeholder:text-slate-500 dark:placeholder:text-slate-400 focus:ring-2 focus:ring-slate-800 outline-none"
                  />

                  <button
                    onClick={() => handleGenerate(inputQuery)}
                    disabled={loading}
                    className="px-5 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-bold rounded-xl transition hover:opacity-90"
                  >
                    發送
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* 🔴 「設定我的旅行習慣」 Modal 彈窗 */}
      {isPrefModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                ✏️ 設定我的旅行習慣
              </h3>
              <button
                onClick={() => setIsPrefModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold text-lg"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  習慣出發地點 / 機場
                </label>
                <input
                  type="text"
                  value={userPreferences.departureAirport}
                  onChange={(e) => setUserPreferences({ ...userPreferences, departureAirport: e.target.value })}
                  placeholder="例如：台北桃園 TPE、高雄小港 KHH"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-900 dark:text-white bg-white dark:bg-slate-800 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  飲食限制 / 偏好
                </label>
                <input
                  type="text"
                  value={userPreferences.dietary}
                  onChange={(e) => setUserPreferences({ ...userPreferences, dietary: e.target.value })}
                  placeholder="例如：不吃牛肉、全素、喜歡在地拉麵"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-900 dark:text-white bg-white dark:bg-slate-800 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  預算與住宿風格
                </label>
                <input
                  type="text"
                  value={userPreferences.budget}
                  onChange={(e) => setUserPreferences({ ...userPreferences, budget: e.target.value })}
                  placeholder="例如：獨旅青旅、平價商旅、豪華飯店"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-900 dark:text-white bg-white dark:bg-slate-800 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  補充個性化習慣
                </label>
                <textarea
                  rows={2}
                  value={userPreferences.customNotes}
                  onChange={(e) => setUserPreferences({ ...userPreferences, customNotes: e.target.value })}
                  placeholder="例如：不喜歡太早起床，偏好悠閒步調、喜歡獨立咖啡廳"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-900 dark:text-white bg-white dark:bg-slate-800 outline-none"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setIsPrefModalOpen(false)}
                className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-semibold transition"
              >
                取消
              </button>
              <button
                onClick={handleSavePreferences}
                className="flex-1 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-sm font-bold transition hover:opacity-90 shadow"
              >
                儲存習慣
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}