'use client';

import { useState, useEffect } from 'react';

export default function Home() {
  // 1. 表單與對話狀態 State
  const [destination, setDestination] = useState('');
  const [days, setDays] = useState('7');
  const [startDate, setStartDate] = useState('2026-08-01');
  const [endDate, setEndDate] = useState('2026-11-27');
  const [style, setStyle] = useState('');
  const [loading, setLoading] = useState(false);
  const [chatHistory, setChatHistory] = useState<any[]>([]);
  const [inputMsg, setInputMsg] = useState('');

  // 2. 個人化偏好記憶庫 State
  const [isPrefOpen, setIsPrefOpen] = useState(false);
  const [preferences, setPreferences] = useState({
    departureAirport: '',
    dietary: '',
    budget: '',
  });

  // 元件載入時，自動從 localStorage 讀取個人偏好
  useEffect(() => {
    const saved = localStorage.getItem('user_preferences');
    if (saved) {
      try {
        setPreferences(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse user preferences');
      }
    }
  }, []);

  // 當日期改變時，自動計算天數
  useEffect(() => {
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const diffTime = end.getTime() - start.getTime();
      if (diffTime >= 0) {
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        setDays(diffDays.toString());
      }
    }
  }, [startDate, endDate]);

  // 儲存個人偏好到 localStorage
  const handleSavePreferences = () => {
    localStorage.setItem('user_preferences', JSON.stringify(preferences));
    setIsPrefOpen(false);
    alert('✅ 個人獨旅偏好已成功儲存！Perry 未來生成行程時會自動考慮這些設定！');
  };

  // 發送請求給 AI Agent
  const handleSend = async (customText?: string) => {
    const textToSend = customText || inputMsg;
    if (!textToSend && !destination) return;

    setLoading(true);

    const promptText = customText 
      ? customText 
      : `我想去【${destination}】獨旅，日期：${startDate} 至 ${endDate} (共 ${days} 天)${style ? `，風格：${style}` : ''}。請為我規劃行程！`;

    const newHistory = [...chatHistory, { role: 'user', content: promptText }];
    setChatHistory(newHistory);
    if (!customText) setInputMsg('');

    try {
      const savedPref = JSON.parse(localStorage.getItem('user_preferences') || '{}');

      const res = await fetch('/api/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destination,
          days,
          startDate,
          endDate,
          style,
          messages: newHistory,
          userPreferences: savedPref, // 🟢 自動注入偏好記憶
        }),
      });

      const data = await res.json();
      if (data.reply) {
        setChatHistory([...newHistory, { role: 'assistant', content: data.reply }]);
      } else {
        alert(data.error || '行程生成失敗，請稍後再試');
      }
    } catch (err) {
      alert('網路連線失敗');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#0D1117] text-white p-4 md:p-8 flex flex-col items-center">
      {/* 頂部 Header：左側標題 + 右側偏好記憶庫按鈕 */}
      <header className="w-full max-w-xl flex justify-between items-center mb-6 pt-2 border-b border-neutral-800 pb-4">
        <div className="flex flex-col items-start">
          <h1 className="text-xl font-bold flex items-center gap-2 text-white">
            🧳 獨旅 AI 幫手
          </h1>
          <p className="text-xs text-neutral-400">@allonetrip.perry 專屬行程規劃</p>
        </div>

        {/* 右上角膠囊按鈕 */}
        <button
          type="button"
          onClick={() => setIsPrefOpen(true)}
          className="px-3.5 py-1.5 bg-neutral-800/80 hover:bg-neutral-700/80 text-neutral-200 text-xs font-medium rounded-full border border-neutral-700/60 transition flex items-center gap-1.5 shadow-sm active:scale-95"
        >
          ⚙️ 偏好記憶庫
        </button>
      </header>

      <div className="w-full max-w-xl space-y-6">
        {/* 表單輸入區域卡片 */}
        <div className="bg-[#161B22] p-5 rounded-2xl border border-neutral-800 shadow-xl space-y-4">
          <div>
            <label className="block text-xs font-medium text-neutral-400 mb-1.5">想去哪裡獨旅？</label>
            <input
              type="text"
              placeholder="例如：四國"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              className="w-full bg-[#0D1117] border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-blue-500 transition"
            />
          </div>

          {/* 日期選擇區間 */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-xs text-neutral-400 font-medium">
              <span>設定日期區間 📅</span>
              <span className="text-blue-400 bg-blue-950/60 px-2 py-0.5 rounded-md border border-blue-800/40 font-mono">
                共 {days} 天 ({days} 夜)
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] text-neutral-500 mb-1">出發日期</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full bg-[#0D1117] border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-[10px] text-neutral-500 mb-1">回程日期</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full bg-[#0D1117] border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* 風格偏好 */}
          <div>
            <label className="block text-xs font-medium text-neutral-400 mb-1.5">獨旅風格偏好 (選填) 🪄</label>
            <input
              type="text"
              placeholder="例如：慢步調、美食探索、歷史神社"
              value={style}
              onChange={(e) => setStyle(e.target.value)}
              className="w-full bg-[#0D1117] border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-blue-500 transition"
            />
          </div>

          {/* 生成行程按鈕 */}
          <button
            type="button"
            onClick={() => handleSend()}
            disabled={loading || !destination}
            className="w-full py-3 bg-white text-black hover:bg-neutral-200 disabled:bg-neutral-800 disabled:text-neutral-500 font-bold text-sm rounded-xl transition shadow-lg flex items-center justify-center gap-2 active:scale-[0.99]"
          >
            {loading ? 'Perry 正在為你規劃專屬行程...' : '一起生成專屬行程 ✨'}
          </button>
        </div>

        {/* 客製化聯繫與偏好引導卡片 */}
        <div className="bg-[#161B22] p-4 rounded-2xl border border-neutral-800 text-center space-y-2">
          <p className="text-xs text-neutral-300 font-medium">想要取得更客製化的獨旅規劃嗎？</p>
          <button
            type="button"
            onClick={() => setIsPrefOpen(true)}
            className="px-4 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-xs text-white font-medium rounded-full transition border border-neutral-700"
          >
            ⚙️ 設定偏好記憶庫
          </button>
        </div>

        {/* 對話區塊與結果呈現 */}
        {chatHistory.length > 0 && (
          <div className="bg-[#161B22] border border-neutral-800 rounded-2xl p-5 space-y-4 shadow-xl">
            <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-neutral-800 pb-3">
              📍 專屬獨旅行程對話
            </h3>

            <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
              {chatHistory.map((msg, idx) => (
                <div
                  key={idx}
                  className={`p-4 rounded-xl text-xs leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-blue-950/60 border border-blue-800/40 text-blue-100 ml-auto max-w-[85%]'
                      : 'bg-[#0D1117] border border-neutral-800 text-neutral-200'
                  }`}
                >
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                </div>
              ))}

              {loading && (
                <div className="p-4 bg-[#0D1117] border border-neutral-800 rounded-xl text-xs text-neutral-400 animate-pulse flex items-center gap-2">
                  <span className="inline-block w-2 h-2 bg-blue-500 rounded-full animate-ping"></span>
                  Perry 正在為你梳理階段式骨架與 Google Maps 超連結...
                </div>
              )}
            </div>

            {/* 追問輸入框 */}
            <div className="flex gap-2 pt-2 border-t border-neutral-800">
              <input
                type="text"
                value={inputMsg}
                onChange={(e) => setInputMsg(e.target.value)}
                placeholder="問問 Perry... (例如：展開 Day 1-5 的細節，或推薦飯店)"
                className="flex-1 bg-[#0D1117] border border-neutral-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-blue-500"
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              />
              <button
                onClick={() => handleSend()}
                disabled={loading || !inputMsg}
                className="bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl text-xs font-medium transition"
              >
                發送
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ⚙️ 偏好設定 Modal 彈窗 */}
      {isPrefOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#161B22] border border-neutral-800 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4 text-left">
            <div className="flex justify-between items-center border-b border-neutral-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                ⚙️ 個人獨旅偏好記憶
              </h3>
              <button
                onClick={() => setIsPrefOpen(false)}
                className="text-neutral-400 hover:text-white p-1 rounded-lg transition"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="block text-neutral-300 font-medium mb-1">✈️ 習慣出發地點 / 機場</label>
                <input
                  type="text"
                  placeholder="例如：台北 TPE / 高雄 KHH / 台中 RMQ"
                  value={preferences.departureAirport}
                  onChange={(e) => setPreferences({ ...preferences, departureAirport: e.target.value })}
                  className="w-full bg-[#0D1117] border border-neutral-800 rounded-lg p-2.5 text-white placeholder-neutral-600 focus:outline-none focus:border-blue-500 transition"
                />
              </div>

              <div>
                <label className="block text-neutral-300 font-medium mb-1">🥗 飲食限制與偏好</label>
                <input
                  type="text"
                  placeholder="例如：蔬食 / 不吃牛肉 / 偏好在地拉麵小吃"
                  value={preferences.dietary}
                  onChange={(e) => setPreferences({ ...preferences, dietary: e.target.value })}
                  className="w-full bg-[#0D1117] border border-neutral-800 rounded-lg p-2.5 text-white placeholder-neutral-600 focus:outline-none focus:border-blue-500 transition"
                />
              </div>

              <div>
                <label className="block text-neutral-300 font-medium mb-1">🏨 預算與住宿風格</label>
                <input
                  type="text"
                  placeholder="例如：平價青旅 / CP 值優先 / 需獨立衛浴"
                  value={preferences.budget}
                  onChange={(e) => setPreferences({ ...preferences, budget: e.target.value })}
                  className="w-full bg-[#0D1117] border border-neutral-800 rounded-lg p-2.5 text-white placeholder-neutral-600 focus:outline-none focus:border-blue-500 transition"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-neutral-800">
              <button
                onClick={() => setIsPrefOpen(false)}
                className="px-3.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg text-xs font-medium transition"
              >
                取消
              </button>
              <button
                onClick={handleSavePreferences}
                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-medium transition shadow-md"
              >
                儲存偏好
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}