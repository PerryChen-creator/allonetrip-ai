'use client';

import { useState, useEffect } from 'react';

export default function Home() {
  // 1. 表單與對話狀態
  const [destination, setDestination] = useState('');
  const [days, setDays] = useState('7');
  const [startDate, setStartDate] = useState('2026-08-01');
  const [endDate, setEndDate] = useState('2026-11-27');
  const [style, setStyle] = useState('');
  const [loading, setLoading] = useState(false);
  const [chatHistory, setChatHistory] = useState<any[]>([]);
  const [inputMsg, setInputMsg] = useState('');

  // 2. 個人化旅行習慣 Modal 狀態
  const [isPrefOpen, setIsPrefOpen] = useState(false);
  const [preferences, setPreferences] = useState({
    departureAirport: '',
    dietary: '',
    budget: '',
  });

  // 3. 分享彈窗 Modal 狀態
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [isSharing, setIsSharing] = useState(false);

  // 4. 🌗 亮暗色主題切換狀態
  const [isDarkMode, setIsDarkMode] = useState(true);

  // 讀取 localStorage (習慣 & 主題)
  useEffect(() => {
    const savedPref = localStorage.getItem('user_preferences');
    if (savedPref) {
      try {
        setPreferences(JSON.parse(savedPref));
      } catch (e) {
        console.error('Failed to parse user preferences');
      }
    }
    
    // 讀取主題記憶
    const savedTheme = localStorage.getItem('theme_mode');
    if (savedTheme === 'light') {
      setIsDarkMode(false);
    }
  }, []);

  // 切換主題並存入記憶
  const toggleTheme = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    localStorage.setItem('theme_mode', newMode ? 'dark' : 'light');
  };

  // 計算天數
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

  const handleSavePreferences = () => {
    localStorage.setItem('user_preferences', JSON.stringify(preferences));
    setIsPrefOpen(false);
    alert('✅ 旅行習慣已成功儲存！Perry 未來生成行程時會自動考慮這些設定！');
  };

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
          userPreferences: savedPref,
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

  // 打開分享彈窗
  const handleOpenShareModal = async () => {
    if (chatHistory.length === 0) return alert('請先生成行程後再進行分享！');
    
    const lastAssistantMsg = [...chatHistory].reverse().find(m => m.role === 'assistant');
    if (!lastAssistantMsg) return alert('請先等待 Perry 生成行程！');

    setIsShareModalOpen(true);
    setIsSharing(true);

    try {
      const res = await fetch('/api/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: lastAssistantMsg.content,
          destination: destination || '獨旅專案',
        }),
      });

      const data = await res.json();
      if (data.shareId) {
        const generatedUrl = `${window.location.origin}/share/${data.shareId}`;
        setShareUrl(generatedUrl);
      } else {
        alert('生成短網址失敗：' + (data.error || '未知錯誤'));
      }
    } catch (err) {
      alert('網路連線失敗，請稍後再試');
    } finally {
      setIsSharing(false);
    }
  };

  // 社群分享捷徑
  const shareToLine = () => window.open(`https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(shareUrl)}`, '_blank');
  const shareToFB = () => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`, '_blank');
  const shareToX = () => window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent('看看我的獨旅行程！')}`, '_blank');

  return (
    <main className={`min-h-screen transition-colors duration-300 p-4 md:p-8 flex flex-col items-center ${isDarkMode ? 'bg-[#0D1117] text-white' : 'bg-gray-50 text-gray-900'}`}>
      <header className={`w-full max-w-xl flex justify-between items-center mb-6 pt-2 border-b pb-4 transition-colors duration-300 ${isDarkMode ? 'border-neutral-800' : 'border-gray-200'}`}>
        <div className="flex flex-col items-start">
          <h1 className={`text-xl font-bold flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            🧳 獨旅 AI 幫手
          </h1>
          <p className={`text-xs ${isDarkMode ? 'text-neutral-400' : 'text-gray-500'}`}>@allonetrip.perry 專屬行程規劃</p>
        </div>

        <div className="flex items-center gap-2">
          {chatHistory.length > 0 && (
            <button
              type="button"
              onClick={handleOpenShareModal}
              className={`px-3 py-1.5 text-xs font-medium rounded-full transition flex items-center gap-1 shadow-sm active:scale-95 border ${
                isDarkMode ? 'bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 border-blue-500/30' : 'bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200'
              }`}
            >
              🔗 分享行程
            </button>
          )}
          
          {/* 📝 習慣按鈕 */}
          <button
            type="button"
            onClick={() => setIsPrefOpen(true)}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-full border transition flex items-center gap-1.5 shadow-sm active:scale-95 ${
              isDarkMode ? 'bg-neutral-800/80 hover:bg-neutral-700/80 text-neutral-200 border-neutral-700/60' : 'bg-white hover:bg-gray-100 text-gray-700 border-gray-300'
            }`}
          >
            📝 我的旅行習慣
          </button>
          
          {/* 🌗 亮暗色切換按鈕 */}
          <button
            type="button"
            onClick={toggleTheme}
            className={`p-1.5 rounded-full border transition flex items-center justify-center shadow-sm active:scale-95 ${
              isDarkMode ? 'bg-neutral-800/80 hover:bg-neutral-700/80 text-neutral-200 border-neutral-700/60' : 'bg-white hover:bg-gray-100 text-gray-700 border-gray-300'
            }`}
            title={isDarkMode ? '切換至亮色模式' : '切換至暗色模式'}
          >
            {isDarkMode ? '☀️' : '🌙'}
          </button>
        </div>
      </header>

      <div className="w-full max-w-xl space-y-6">
        {/* 輸入表單卡片 */}
        <div className={`p-5 rounded-2xl border shadow-xl space-y-4 transition-colors duration-300 ${isDarkMode ? 'bg-[#161B22] border-neutral-800' : 'bg-white border-gray-200 shadow-gray-200/50'}`}>
          <div>
            <label className={`block text-xs font-medium mb-1.5 ${isDarkMode ? 'text-neutral-400' : 'text-gray-600'}`}>想去哪裡獨旅？</label>
            <input
              type="text"
              placeholder="例如：四國"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              className={`w-full rounded-xl px-4 py-2.5 text-sm transition focus:outline-none focus:border-blue-500 border ${
                isDarkMode ? 'bg-[#0D1117] border-neutral-800 text-white placeholder-neutral-400' : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-400'
              }`}
            />
          </div>

          <div className="space-y-1.5">
            <div className={`flex justify-between items-center text-xs font-medium ${isDarkMode ? 'text-neutral-400' : 'text-gray-600'}`}>
              <span>設定日期區間 📅</span>
              <span className={`px-2 py-0.5 rounded-md border font-mono ${
                isDarkMode ? 'text-blue-400 bg-blue-950/60 border-blue-800/40' : 'text-blue-700 bg-blue-50 border-blue-200'
              }`}>
                共 {days} 天 ({days} 夜)
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={`block text-[10px] mb-1 ${isDarkMode ? 'text-neutral-400' : 'text-gray-500'}`}>出發日期</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className={`w-full rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500 border ${
                    isDarkMode ? 'bg-[#0D1117] border-neutral-800 text-white' : 'bg-gray-50 border-gray-300 text-gray-900'
                  }`}
                />
              </div>
              <div>
                <label className={`block text-[10px] mb-1 ${isDarkMode ? 'text-neutral-400' : 'text-gray-500'}`}>回程日期</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className={`w-full rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500 border ${
                    isDarkMode ? 'bg-[#0D1117] border-neutral-800 text-white' : 'bg-gray-50 border-gray-300 text-gray-900'
                  }`}
                />
              </div>
            </div>
          </div>

          <div>
            <label className={`block text-xs font-medium mb-1.5 ${isDarkMode ? 'text-neutral-400' : 'text-gray-600'}`}>獨旅風格偏好 (選填) 🪄</label>
            <input
              type="text"
              placeholder="例如：慢步調、美食探索、歷史神社"
              value={style}
              onChange={(e) => setStyle(e.target.value)}
              className={`w-full rounded-xl px-4 py-2.5 text-sm transition focus:outline-none focus:border-blue-500 border ${
                isDarkMode ? 'bg-[#0D1117] border-neutral-800 text-white placeholder-neutral-400' : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-400'
              }`}
            />
          </div>

          <button
            type="button"
            onClick={() => handleSend()}
            disabled={loading || !destination}
            className={`w-full py-3 font-bold text-sm rounded-xl transition shadow-lg flex items-center justify-center gap-2 active:scale-[0.99] ${
              isDarkMode 
                ? 'bg-white text-black hover:bg-neutral-200 disabled:bg-neutral-800 disabled:text-neutral-400' 
                : 'bg-gray-900 text-white hover:bg-gray-800 disabled:bg-gray-200 disabled:text-gray-400'
            }`}
          >
            {loading ? 'Perry 正在為你規劃專屬行程...' : '一起生成專屬行程 ✨'}
          </button>
        </div>

        {/* 提示橫幅 */}
        <div className={`p-4 rounded-2xl border text-center space-y-2 transition-colors duration-300 ${isDarkMode ? 'bg-[#161B22] border-neutral-800' : 'bg-gray-100 border-gray-200'}`}>
          <p className={`text-xs font-medium ${isDarkMode ? 'text-neutral-300' : 'text-gray-600'}`}>想要取得更客製化的獨旅規劃嗎？</p>
          <button
            type="button"
            onClick={() => setIsPrefOpen(true)}
            className={`px-4 py-1.5 text-xs font-medium rounded-full transition border ${
              isDarkMode ? 'bg-neutral-800 hover:bg-neutral-700 text-white border-neutral-700' : 'bg-white hover:bg-gray-50 text-gray-800 border-gray-300 shadow-sm'
            }`}
          >
            📝 設定我的旅行習慣
          </button>
        </div>

        {/* 對話呈現區域 */}
        {chatHistory.length > 0 && (
          <div className={`border rounded-2xl p-5 space-y-4 shadow-xl transition-colors duration-300 ${isDarkMode ? 'bg-[#161B22] border-neutral-800' : 'bg-white border-gray-200 shadow-gray-200/50'}`}>
            <div className={`flex justify-between items-center border-b pb-3 ${isDarkMode ? 'border-neutral-800' : 'border-gray-200'}`}>
              <h3 className={`text-sm font-bold flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                📍 專屬獨旅行程對話
              </h3>
              <button
                type="button"
                onClick={handleOpenShareModal}
                className={`text-xs hover:underline font-medium ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}
              >
                🔗 分享公開連結
              </button>
            </div>

            <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
              {chatHistory.map((msg, idx) => (
                <div
                  key={idx}
                  className={`p-4 rounded-xl text-xs leading-relaxed ${
                    msg.role === 'user'
                      ? (isDarkMode 
                          ? 'bg-blue-950/60 border border-blue-800/40 text-blue-100 ml-auto max-w-[85%]' 
                          : 'bg-blue-500 border border-blue-600 text-white ml-auto max-w-[85%]')
                      : (isDarkMode 
                          ? 'bg-[#0D1117] border border-neutral-800 text-neutral-200' 
                          : 'bg-gray-50 border border-gray-200 text-gray-800')
                  }`}
                >
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                </div>
              ))}

              {loading && (
                <div className={`p-4 border rounded-xl text-xs animate-pulse flex items-center gap-2 ${
                  isDarkMode ? 'bg-[#0D1117] border-neutral-800 text-neutral-400' : 'bg-gray-50 border-gray-200 text-gray-500'
                }`}>
                  <span className="inline-block w-2 h-2 bg-blue-500 rounded-full animate-ping"></span>
                  Perry 正在為你梳理階段式骨架與 Google Maps 超連結...
                </div>
              )}
            </div>

            <div className={`flex gap-2 pt-2 border-t ${isDarkMode ? 'border-neutral-800' : 'border-gray-200'}`}>
              <input
                type="text"
                value={inputMsg}
                onChange={(e) => setInputMsg(e.target.value)}
                placeholder="問問 Perry... (例如：展開 Day 1-5 的細節)"
                className={`flex-1 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-blue-500 border ${
                  isDarkMode ? 'bg-[#0D1117] border-neutral-800 text-white placeholder-neutral-400' : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-400'
                }`}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              />
              <button
                onClick={() => handleSend()}
                disabled={loading || !inputMsg}
                className={`px-4 py-2.5 rounded-xl text-xs font-medium transition ${
                  isDarkMode ? 'bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 text-white' : 'bg-gray-900 hover:bg-gray-800 disabled:opacity-50 text-white'
                }`}
              >
                發送
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 📝 旅行習慣 Modal */}
      {isPrefOpen && (
        <div className={`fixed inset-0 backdrop-blur-sm flex items-center justify-center p-4 z-50 transition-colors ${isDarkMode ? 'bg-black/80' : 'bg-gray-900/40'}`}>
          <div className={`border rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4 text-left ${isDarkMode ? 'bg-[#161B22] border-neutral-800' : 'bg-white border-gray-200'}`}>
            <div className={`flex justify-between items-center border-b pb-3 ${isDarkMode ? 'border-neutral-800' : 'border-gray-200'}`}>
              <h3 className={`text-sm font-bold flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                📝 我的旅行習慣
              </h3>
              <button onClick={() => setIsPrefOpen(false)} className={`p-1 rounded-lg transition ${isDarkMode ? 'text-neutral-400 hover:text-white' : 'text-gray-400 hover:text-gray-800'}`}>✕</button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className={`block font-medium mb-1 ${isDarkMode ? 'text-neutral-300' : 'text-gray-700'}`}>✈️ 習慣出發地點 / 機場</label>
                <input
                  type="text"
                  placeholder="例如：台北 TPE / 高雄 KHH"
                  value={preferences.departureAirport}
                  onChange={(e) => setPreferences({ ...preferences, departureAirport: e.target.value })}
                  className={`w-full rounded-lg p-2.5 focus:outline-none focus:border-blue-500 transition border ${
                    isDarkMode ? 'bg-[#0D1117] border-neutral-800 text-white placeholder-neutral-400' : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-400'
                  }`}
                />
              </div>

              <div>
                <label className={`block font-medium mb-1 ${isDarkMode ? 'text-neutral-300' : 'text-gray-700'}`}>🥗 飲食限制與偏好</label>
                <input
                  type="text"
                  placeholder="例如：蔬食 / 不吃牛肉"
                  value={preferences.dietary}
                  onChange={(e) => setPreferences({ ...preferences, dietary: e.target.value })}
                  className={`w-full rounded-lg p-2.5 focus:outline-none focus:border-blue-500 transition border ${
                    isDarkMode ? 'bg-[#0D1117] border-neutral-800 text-white placeholder-neutral-400' : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-400'
                  }`}
                />
              </div>

              <div>
                <label className={`block font-medium mb-1 ${isDarkMode ? 'text-neutral-300' : 'text-gray-700'}`}>🏨 預算與住宿風格</label>
                <input
                  type="text"
                  placeholder="例如：平價青旅 / CP 值優先"
                  value={preferences.budget}
                  onChange={(e) => setPreferences({ ...preferences, budget: e.target.value })}
                  className={`w-full rounded-lg p-2.5 focus:outline-none focus:border-blue-500 transition border ${
                    isDarkMode ? 'bg-[#0D1117] border-neutral-800 text-white placeholder-neutral-400' : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-400'
                  }`}
                />
              </div>
            </div>

            <div className={`flex justify-end gap-2 pt-3 border-t ${isDarkMode ? 'border-neutral-800' : 'border-gray-200'}`}>
              <button onClick={() => setIsPrefOpen(false)} className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition ${
                isDarkMode ? 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300' : 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-300'
              }`}>
                取消
              </button>
              <button onClick={handleSavePreferences} className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-medium shadow-md">
                儲存習慣
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🔗 分享公開連結 Modal */}
      {isShareModalOpen && (
        <div className={`fixed inset-0 backdrop-blur-sm flex items-center justify-center p-4 z-50 transition-colors ${isDarkMode ? 'bg-black/80' : 'bg-gray-900/40'}`}>
          <div className={`border rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4 text-left ${isDarkMode ? 'bg-[#161B22] border-neutral-800' : 'bg-white border-gray-200'}`}>
            <div className={`flex justify-between items-center border-b pb-3 ${isDarkMode ? 'border-neutral-800' : 'border-gray-200'}`}>
              <h3 className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>可分享的公開連結</h3>
              <button onClick={() => setIsShareModalOpen(false)} className={`p-1 rounded-lg transition ${isDarkMode ? 'text-neutral-400 hover:text-white' : 'text-gray-400 hover:text-gray-800'}`}>✕</button>
            </div>

            <div className="flex gap-2 items-center">
              <input
                type="text"
                readOnly
                value={isSharing ? '⚡ 正在生成超短網址中...' : shareUrl}
                className={`flex-1 rounded-xl px-3 py-2.5 text-xs focus:outline-none border ${
                  isDarkMode ? 'bg-[#0D1117] border-neutral-800 text-neutral-300' : 'bg-gray-50 border-gray-300 text-gray-800'
                }`}
              />
              <button
                disabled={isSharing || !shareUrl}
                onClick={() => {
                  navigator.clipboard.writeText(shareUrl);
                  alert('🎉 專屬超短網址已成功複製！');
                }}
                className={`px-4 py-2.5 text-xs font-bold rounded-xl transition disabled:opacity-50 ${
                  isDarkMode ? 'bg-white text-black hover:bg-neutral-200' : 'bg-gray-900 text-white hover:bg-gray-800'
                }`}
              >
                複製
              </button>
            </div>

            <p className={`text-[11px] flex items-center gap-1 ${isDarkMode ? 'text-neutral-400' : 'text-gray-500'}`}>
              ⓘ 任何人都能透過此短連結快速檢視此獨旅行程。
            </p>

            <div className={`flex justify-center gap-6 pt-3 border-t ${isDarkMode ? 'border-neutral-800' : 'border-gray-200'}`}>
              <button onClick={shareToLine} className="flex flex-col items-center gap-1 group">
                <span className="w-10 h-10 rounded-full bg-[#00B900] flex items-center justify-center text-white font-bold text-xs group-hover:scale-105 transition">LINE</span>
                <span className={`text-[10px] ${isDarkMode ? 'text-neutral-400' : 'text-gray-500'}`}>LINE</span>
              </button>

              <button onClick={shareToFB} className="flex flex-col items-center gap-1 group">
                <span className="w-10 h-10 rounded-full bg-[#1877F2] flex items-center justify-center text-white font-bold text-xs group-hover:scale-105 transition">FB</span>
                <span className={`text-[10px] ${isDarkMode ? 'text-neutral-400' : 'text-gray-500'}`}>Facebook</span>
              </button>

              <button onClick={shareToX} className="flex flex-col items-center gap-1 group">
                <span className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-xs group-hover:scale-105 transition border ${
                  isDarkMode ? 'bg-black border-neutral-700' : 'bg-black border-gray-800'
                }`}>X</span>
                <span className={`text-[10px] ${isDarkMode ? 'text-neutral-400' : 'text-gray-500'}`}>X</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}