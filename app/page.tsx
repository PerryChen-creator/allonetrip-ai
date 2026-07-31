'use client';

import { useState, useEffect } from 'react';

export default function Home() {
  const todayStr = new Date().toISOString().split('T')[0];

  // 1. 表單狀態 (日期預設為空)
  const [destination, setDestination] = useState('');
  const [days, setDays] = useState('0');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [style, setStyle] = useState('');
  const [loading, setLoading] = useState(false);
  const [chatHistory, setChatHistory] = useState<any[]>([]);
  const [inputMsg, setInputMsg] = useState('');

  // 2. 響應式與滑動監聽 (固定列 Fix Bar)
  const [isMobile, setIsMobile] = useState(false);
  const [showFixedBar, setShowFixedBar] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    const handleScroll = () => setShowFixedBar(window.scrollY > 280);

    handleResize();
    handleScroll();

    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  // 3. 日期與表單合法性驗證
  const isDateValid = startDate !== '' && endDate !== '' && endDate >= startDate;
  const isFormValid = destination.trim() !== '' && isDateValid;

  // 4. Modal 狀態
  const [isPrefOpen, setIsPrefOpen] = useState(false);
  const [preferences, setPreferences] = useState({
    departureAirport: '',
    dietary: '',
    budget: '',
    customNotes: '',
  });

  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [isSharing, setIsSharing] = useState(false);

  // 5. 明暗主題
  const [isDarkMode, setIsDarkMode] = useState(true);

  useEffect(() => {
    const savedPref = localStorage.getItem('user_preferences');
    if (savedPref) {
      try { setPreferences(JSON.parse(savedPref)); } catch (e) {}
    }
    const savedTheme = localStorage.getItem('theme_mode');
    if (savedTheme === 'light') setIsDarkMode(false);
  }, []);

  const toggleTheme = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    localStorage.setItem('theme_mode', newMode ? 'dark' : 'light');
  };

  // 動態天數計算
  useEffect(() => {
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const diffTime = end.getTime() - start.getTime();
      if (diffTime >= 0) {
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        setDays(diffDays.toString());
      } else {
        setDays('0');
      }
    } else {
      setDays('0');
    }
  }, [startDate, endDate]);

  const handleSavePreferences = () => {
    localStorage.setItem('user_preferences', JSON.stringify(preferences));
    setIsPrefOpen(false);
    alert('✅ 旅行習慣與備註已儲存！Perry 會為你打造專屬的深度行程！');
  };

  const handleSend = async (customText?: string) => {
    const textToSend = customText || inputMsg;
    if (!textToSend && !isFormValid) return;

    setLoading(true);

    const dateInfo = `，日期：${startDate} 至 ${endDate} (共 ${days} 天)`;
    const promptText = customText 
      ? customText 
      : `我想去【${destination}】獨旅${dateInfo}${style ? `，風格：${style}` : ''}。請為我規劃行程！`;

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
        setShareUrl(`${window.location.origin}/share/${data.shareId}`);
      } else {
        alert('生成短網址失敗：' + (data.error || '未知錯誤'));
      }
    } catch (err) {
      alert('網路連線失敗，請稍後再試');
    } finally {
      setIsSharing(false);
    }
  };

  const shareToLine = () => window.open(`https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(shareUrl)}`, '_blank');
  const shareToFB = () => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`, '_blank');
  const shareToX = () => window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent('看看我的獨旅行程！')}`, '_blank');

  return (
    <div className={`min-h-screen flex flex-col md:flex-row transition-colors duration-300 ${isDarkMode ? 'bg-[#0D1117] text-white' : 'bg-gray-50 text-gray-900'}`}>
      
      {/* 🟢 桌機版：Gemini 風格左側邊欄 (Left Sidebar) */}
      <aside className={`hidden md:flex flex-col justify-between w-64 fixed left-0 top-0 h-screen p-6 border-r transition-colors duration-300 z-30 ${
        isDarkMode ? 'bg-[#161B22] border-neutral-800' : 'bg-white border-gray-200'
      }`}>
        <div className="space-y-6">
          <div className="space-y-1">
            <h1 className="text-xl font-bold flex items-center gap-2">🧳 獨旅 AI 幫手</h1>
            <p className="text-xs text-neutral-400">
              <a href="https://www.instagram.com/allonetrip_perry/" target="_blank" rel="noopener noreferrer" className="hover:underline hover:text-blue-400 transition">
                @allonetrip_perry
              </a> 專屬行程規劃
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsPrefOpen(true)}
            className={`w-full py-2.5 px-4 text-xs font-medium rounded-xl border transition flex items-center justify-center gap-2 shadow-sm ${
              isDarkMode ? 'bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border-neutral-700' : 'bg-gray-100 hover:bg-gray-200 text-gray-800 border-gray-300'
            }`}
          >
            📝 設定我的旅行習慣
          </button>
        </div>

        <div className="pt-4 border-t border-neutral-800/40 flex items-center justify-between">
          <span className="text-xs text-neutral-400">切換主題模式</span>
          <button
            type="button"
            onClick={toggleTheme}
            className={`w-8 h-8 rounded-full border transition flex items-center justify-center ${
              isDarkMode ? 'bg-neutral-800 border-neutral-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-800'
            }`}
          >
            <span className="text-xs leading-none">{isDarkMode ? '☀️' : '🌙'}</span>
          </button>
        </div>
      </aside>

      {/* 🟢 手機版：頂部輕量 Nav Bar */}
      <header className={`md:hidden sticky top-0 z-40 w-full px-4 py-3 border-b backdrop-blur-md flex justify-between items-center ${
        isDarkMode ? 'bg-[#0D1117]/90 border-neutral-800' : 'bg-white/90 border-gray-200'
      }`}>
        <div>
          <h1 className="text-base font-bold">🧳 獨旅 AI 幫手</h1>
          <a href="https://www.instagram.com/allonetrip_perry/" target="_blank" rel="noopener noreferrer" className="text-[10px] text-neutral-400 hover:underline">
            @allonetrip_perry
          </a>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsPrefOpen(true)}
            className={`px-3 py-1.5 text-xs rounded-full border ${
              isDarkMode ? 'bg-neutral-800 border-neutral-700 text-neutral-200' : 'bg-gray-100 border-gray-300 text-gray-800'
            }`}
          >
            📝 習慣
          </button>
          <button
            type="button"
            onClick={toggleTheme}
            className={`w-7 h-7 rounded-full border flex items-center justify-center ${
              isDarkMode ? 'bg-neutral-800 border-neutral-700' : 'bg-gray-100 border-gray-300'
            }`}
          >
            <span className="text-xs">{isDarkMode ? '☀️' : '🌙'}</span>
          </button>
        </div>
      </header>

      {/* 🟢 滑動超過 Placeholder 後出現的懸浮 Fix Bar (雙 Icon) */}
      {showFixedBar && (
        <div className="fixed top-4 right-4 md:right-8 z-50 flex items-center gap-2 bg-[#161B22]/90 dark:bg-[#161B22]/90 bg-white/90 backdrop-blur-md p-1.5 px-3 rounded-full border border-neutral-700/50 shadow-2xl animate-fade-in">
          <button
            onClick={handleOpenShareModal}
            className="p-2 rounded-full hover:bg-neutral-800/20 transition text-sm"
            title="分享行程"
          >
            🔗
          </button>
          <a
            href="https://www.instagram.com/allonetrip_perry/"
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded-full hover:bg-neutral-800/20 transition text-sm"
            title="與我聯繫"
          >
            📩
          </a>
        </div>
      )}

      {/* 🟢 主要內容區 */}
      <main className="flex-1 md:ml-64 p-4 md:p-8 flex flex-col items-center">
        <div className="w-full max-w-xl space-y-6">
          
          {/* 輸入卡片 */}
          <div className={`p-5 rounded-2xl border shadow-xl space-y-4 transition-colors duration-300 ${
            isDarkMode ? 'bg-[#161B22] border-neutral-800' : 'bg-white border-gray-200 shadow-gray-200/50'
          }`}>
            <div>
              <label className={`block text-xs font-medium mb-1.5 ${isDarkMode ? 'text-neutral-400' : 'text-gray-600'}`}>想去哪裡獨旅？</label>
              <input
                type="text"
                placeholder={isMobile ? "例如：日本環島、極光之旅" : "例如：日本環島、北歐極光之旅、西班牙朝聖之路"}
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                className={`w-full rounded-xl px-4 py-2.5 text-sm transition focus:outline-none focus:border-blue-500 border ${
                  isDarkMode ? 'bg-[#0D1117] border-neutral-800 text-white placeholder-neutral-400' : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-400'
                }`}
              />
            </div>

            {/* 旅遊日期區間 (強制必填) */}
            <div className="space-y-1.5">
              <div className={`flex justify-between items-center text-xs font-medium ${isDarkMode ? 'text-neutral-400' : 'text-gray-600'}`}>
                <span className="flex items-center gap-1">
                  旅遊日期區間 📅 <span className="text-red-500 text-xs">*</span>
                </span>
                {isDateValid && parseInt(days) > 0 && (
                  <span className={`px-2 py-0.5 rounded-md border font-mono ${
                    isDarkMode ? 'text-blue-400 bg-blue-950/60 border-blue-800/40' : 'text-blue-700 bg-blue-50 border-blue-200'
                  }`}>
                    共 {days} 天 ({parseInt(days) > 1 ? parseInt(days) - 1 : 0} 夜)
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block text-[10px] mb-1 ${isDarkMode ? 'text-neutral-400' : 'text-gray-500'}`}>出發日期</label>
                  <input
                    type="date"
                    min={todayStr}
                    value={startDate}
                    onChange={(e) => {
                      const newStart = e.target.value;
                      setStartDate(newStart);
                      if (endDate && newStart > endDate) setEndDate(newStart);
                    }}
                    className={`w-full rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500 border ${
                      isDarkMode ? 'bg-[#0D1117] border-neutral-800 text-white' : 'bg-gray-50 border-gray-300 text-gray-900'
                    }`}
                  />
                </div>
                <div>
                  <label className={`block text-[10px] mb-1 ${isDarkMode ? 'text-neutral-400' : 'text-gray-500'}`}>回程日期</label>
                  <input
                    type="date"
                    min={startDate || todayStr}
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className={`w-full rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500 border ${
                      isDarkMode ? 'bg-[#0D1117] border-neutral-800 text-white' : 'bg-gray-50 border-gray-300 text-gray-900'
                    }`}
                  />
                </div>
              </div>

              {/* 日期未填寫的錯誤提示 */}
              {destination.trim() !== '' && !isDateValid && (
                <p className="text-[11px] text-red-400 font-medium mt-1 animate-pulse">
                  ⚠️ 旅遊日期區間為必填項目，請選擇出發與回程日期
                </p>
              )}
            </div>

            <div>
              <label className={`block text-xs font-medium mb-1.5 ${isDarkMode ? 'text-neutral-400' : 'text-gray-600'}`}>獨旅風格與靈感 (選填) 🔗</label>
              <input
                type="text"
                placeholder="例如：探索登山、夜生活，或貼上連結"
                value={style}
                onChange={(e) => setStyle(e.target.value)}
                className={`w-full rounded-xl px-4 py-2.5 text-sm transition focus:outline-none focus:border-blue-500 border ${
                  isDarkMode ? 'bg-[#0D1117] border-neutral-800 text-white placeholder-neutral-400' : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-400'
                }`}
              />
              <p className={`text-[11px] mt-1.5 ${isDarkMode ? 'text-neutral-400' : 'text-gray-500'}`}>
                可輸入旅遊喜好，或貼上 IG / YouTube 公開景點圖片或影片連結
              </p>
            </div>

            <button
              type="button"
              onClick={() => handleSend()}
              disabled={loading || !isFormValid}
              className={`w-full py-3 font-bold text-sm rounded-xl transition shadow-lg flex items-center justify-center gap-2 active:scale-[0.99] ${
                isDarkMode 
                  ? 'bg-white text-black hover:bg-neutral-200 disabled:bg-neutral-800 disabled:text-neutral-500' 
                  : 'bg-gray-900 text-white hover:bg-gray-800 disabled:bg-gray-200 disabled:text-gray-400'
              }`}
            >
              {loading ? 'Perry 正在為你規劃專屬行程...' : '一鍵生成專屬行程 ✨'}
            </button>
          </div>

          {/* 導購 CTA */}
          <div className={`p-5 rounded-2xl border text-center space-y-3 transition-colors duration-300 ${
            isDarkMode ? 'bg-[#161B22] border-neutral-800' : 'bg-white border-gray-200 shadow-sm'
          }`}>
            <p className={`text-xs font-medium ${isDarkMode ? 'text-neutral-300' : 'text-gray-700'}`}>
              想要來場更客製化的旅程規劃嗎？
            </p>
            <a
              href="https://www.instagram.com/allonetrip_perry/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-xs font-bold rounded-full shadow-md hover:shadow-lg transition active:scale-95"
            >
              📩 與我聯繫
            </a>
          </div>

          {/* 對話呈現區域 */}
          {chatHistory.length > 0 && (
            <div className={`border rounded-2xl p-5 space-y-4 shadow-xl transition-colors duration-300 ${
              isDarkMode ? 'bg-[#161B22] border-neutral-800' : 'bg-white border-gray-200 shadow-gray-200/50'
            }`}>
              <div className={`flex justify-between items-center border-b pb-3 ${isDarkMode ? 'border-neutral-800' : 'border-gray-200'}`}>
                <h3 className={`text-sm font-bold flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  📍 專屬獨旅行程對話
                </h3>
                <button
                  type="button"
                  onClick={handleOpenShareModal}
                  className={`text-xs hover:underline font-medium ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}
                >
                  🔗 分享行程
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
      </main>

      {/* 📝 旅行習慣 Modal */}
      {isPrefOpen && (
        <div className={`fixed inset-0 backdrop-blur-sm flex items-center justify-center p-4 z-50 transition-colors ${isDarkMode ? 'bg-black/80' : 'bg-gray-900/40'}`}>
          <div className={`border rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4 text-left ${isDarkMode ? 'bg-[#161B22] border-neutral-800' : 'bg-white border-gray-200'}`}>
            <div className={`flex justify-between items-center border-b pb-3 ${isDarkMode ? 'border-neutral-800' : 'border-gray-200'}`}>
              <h3 className={`text-sm font-bold flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                📝 設定我的旅行習慣
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

              <div>
                <label className={`block font-medium mb-1 ${isDarkMode ? 'text-neutral-300' : 'text-gray-700'}`}>💡 補充說明 / 其他個人需求</label>
                <textarea
                  rows={2}
                  placeholder="例如：喜歡拍攝底片相機、腳程較慢需要行程鬆一點、晚上想去爵士酒吧..."
                  value={preferences.customNotes}
                  onChange={(e) => setPreferences({ ...preferences, customNotes: e.target.value })}
                  className={`w-full rounded-lg p-2.5 focus:outline-none focus:border-blue-500 transition border ${
                    isDarkMode ? 'bg-[#0D1117] border-neutral-800 text-white placeholder-neutral-400' : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-400'
                  }`}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
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

      {/* 🔗 分享行程 Modal */}
      {isShareModalOpen && (
        <div className={`fixed inset-0 backdrop-blur-sm flex items-center justify-center p-4 z-50 transition-colors ${isDarkMode ? 'bg-black/80' : 'bg-gray-900/40'}`}>
          <div className={`border rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4 text-left ${isDarkMode ? 'bg-[#161B22] border-neutral-800' : 'bg-white border-gray-200'}`}>
            <div className={`flex justify-between items-center border-b pb-3 ${isDarkMode ? 'border-neutral-800' : 'border-gray-200'}`}>
              <h3 className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>分享行程公開連結</h3>
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
    </div>
  );
}