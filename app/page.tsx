'use client';

import React, { useState, useRef, useEffect } from 'react';

// 輔助函式：將對話資料轉換為 URL 安全的 Base64 字串
function encodeShareData(data: any) {
  try {
    const jsonStr = JSON.stringify(data);
    const utf8Bytes = new TextEncoder().encode(jsonStr);
    let binary = '';
    utf8Bytes.forEach((b) => (binary += String.fromCharCode(b)));
    return btoa(binary)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  } catch (e) {
    return '';
  }
}

// 輔助函式：從 URL Base64 字串還原對話資料
function decodeShareData(encoded: string) {
  try {
    let base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const jsonStr = new TextDecoder().decode(bytes);
    return JSON.parse(jsonStr);
  } catch (e) {
    return null;
  }
}

// 輔助函式：解析文字中的 [連結](URL) 與 **粗體**
function parseInlineMarkdown(text: string, darkMode: boolean) {
  const regex = /(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g;
  const parts = text.split(regex);

  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={index} className={`font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>
          {part.slice(2, -2)}
        </strong>
      );
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
            className={`inline-flex items-center underline font-semibold mx-1 transition-colors ${
              darkMode ? 'text-blue-400 hover:text-blue-300' : 'text-blue-700 hover:text-blue-800'
            }`}
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

// 高階 Markdown 渲染組件
function MarkdownMessage({ content, darkMode }: { content: string; darkMode: boolean }) {
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let tableRows: string[] = [];

  const flushTable = (keyIndex: number) => {
    if (tableRows.length === 0) return;

    const parsedRows = tableRows.map((row) =>
      row.split('|').map((cell) => cell.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1)
    );

    const header = parsedRows[0] || [];
    const dataRows = parsedRows.slice(1).filter((row) => !row.every((cell) => /^:?-+:?$/.test(cell)));

    elements.push(
      <div key={`table-${keyIndex}`} className={`overflow-x-auto my-4 border rounded-xl shadow-sm ${darkMode ? 'border-slate-700' : 'border-slate-200'}`}>
        <table className={`min-w-full divide-y text-sm ${darkMode ? 'divide-slate-700' : 'divide-slate-200'}`}>
          <thead className={darkMode ? 'bg-slate-800' : 'bg-slate-100'}>
            <tr>
              {header.map((col, idx) => (
                <th key={idx} className={`px-4 py-2.5 text-left font-bold border-r last:border-r-0 ${darkMode ? 'text-white border-slate-700' : 'text-slate-900 border-slate-200'}`}>
                  {parseInlineMarkdown(col, darkMode)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className={`divide-y ${darkMode ? 'bg-slate-900 divide-slate-800' : 'bg-white divide-slate-200'}`}>
            {dataRows.map((row, rIdx) => (
              <tr key={rIdx} className={`transition ${darkMode ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50'}`}>
                {row.map((cell, cIdx) => (
                  <td key={cIdx} className={`px-4 py-2 border-r last:border-r-0 ${darkMode ? 'text-slate-200 border-slate-700' : 'text-slate-800 border-slate-200'}`}>
                    {parseInlineMarkdown(cell, darkMode)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
    tableRows = [];
  };

  lines.forEach((line, idx) => {
    const trimmed = line.trim();

    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      tableRows.push(trimmed);
      return;
    } else if (tableRows.length > 0) {
      flushTable(idx);
    }

    if (!trimmed) {
      elements.push(<div key={idx} className="h-2" />);
      return;
    }

    if (trimmed.startsWith('## ')) {
      elements.push(
        <h2 key={idx} className={`text-base font-bold mt-4 mb-2 ${darkMode ? 'text-white' : 'text-slate-900'}`}>
          {parseInlineMarkdown(trimmed.replace('## ', ''), darkMode)}
        </h2>
      );
      return;
    }

    const isListItem = trimmed.startsWith('* ') || trimmed.startsWith('- ') || /^\d+\.\s/.test(trimmed);
    if (isListItem) {
      const cleanText = trimmed.replace(/^([\*\-]\s+|\d+\.\s+)/, '');
      elements.push(
        <div key={idx} className="flex items-start space-x-2 pl-2 my-1">
          <span className="text-blue-600 font-bold">•</span>
          <div className={darkMode ? 'text-slate-200' : 'text-slate-800'}>{parseInlineMarkdown(cleanText, darkMode)}</div>
        </div>
      );
      return;
    }

    elements.push(
      <p key={idx} className={`my-1 ${darkMode ? 'text-slate-200' : 'text-slate-800'}`}>
        {parseInlineMarkdown(trimmed, darkMode)}
      </p>
    );
  });

  if (tableRows.length > 0) {
    flushTable(lines.length);
  }

  return <div className="space-y-1">{elements}</div>;
}

export default function Home() {
  const [darkMode, setDarkMode] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const [isPrefModalOpen, setIsPrefModalOpen] = useState(false);
  const [userPreferences, setUserPreferences] = useState({
    departureAirport: '台北桃園 TPE',
    dietary: '無特別限制',
    budget: '平價性價比 / 背包客棧',
    customNotes: '',
  });

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

  const [destination, setDestination] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [style, setStyle] = useState('');

  const [messages, setMessages] = useState<Array<{ role: string; content: string; images?: string[] }>>([]);
  const [inputQuery, setInputQuery] = useState('');
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatHeaderRef = useRef<HTMLDivElement>(null);
  const [todayStr, setTodayStr] = useState('');

  useEffect(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    setTodayStr(`${year}-${month}-${day}`);

    const urlParams = new URLSearchParams(window.location.search);
    const shareParam = urlParams.get('share');
    if (shareParam) {
      const decodedData = decodeShareData(shareParam);
      if (decodedData) {
        if (decodedData.destination) setDestination(decodedData.destination);
        if (decodedData.startDate) setStartDate(decodedData.startDate);
        if (decodedData.endDate) setEndDate(decodedData.endDate);
        if (decodedData.style) setStyle(decodedData.style);
        if (decodedData.messages && Array.isArray(decodedData.messages)) {
          setMessages(decodedData.messages);
        }
      }
    }
  }, []);

  useEffect(() => {
    if (messages.length > 0 && messages[messages.length - 1].role === 'assistant') {
      chatHeaderRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [messages]);

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

  const handleShare = async () => {
    if (messages.length === 0) {
      alert('目前尚無行程對話內容可分享喔！');
      return;
    }

    const payload = {
      destination,
      startDate,
      endDate,
      style,
      messages,
    };

    const encoded = encodeShareData(payload);
    if (!encoded) {
      alert('打包對話資料失敗，請重試');
      return;
    }

    const shareUrl = `${window.location.origin}${window.location.pathname}?share=${encoded}`;

    if (navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(shareUrl);
        alert('✨ 已為你生成專屬對話連結並複製至剪貼簿！\n朋友點開連結即可直接瀏覽這份完整的行程對話。');
      } catch (err) {
        prompt('請複製以下專屬對話網址分享給朋友：', shareUrl);
      }
    } else {
      prompt('請複製以下專屬對話網址分享給朋友：', shareUrl);
    }
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
          userPreferences,
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
    <div className={`min-h-screen transition-colors duration-200 ${darkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      
      {/* 🟢 手機版頂部 Header：精準固定高度 h-14 (56px) 且置頂 z-30 */}
      <div className={`md:hidden sticky top-0 h-14 z-30 backdrop-blur-md border-b px-4 flex items-center justify-between shadow-sm ${darkMode ? 'bg-slate-900/95 border-slate-800' : 'bg-white/95 border-slate-200'}`}>
        <div>
          <h1 className={`text-base font-bold flex items-center gap-1.5 ${darkMode ? 'text-white' : 'text-slate-900'}`}>
            🧳 獨旅 AI 幫手
          </h1>
          <a
            href="https://www.instagram.com/allonetrip_perry/"
            target="_blank"
            rel="noopener noreferrer"
            className={`text-[10px] underline ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}
          >
            @allonetrip_perry 專屬行程規劃
          </a>
        </div>
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className={`p-2 rounded-xl transition border ${darkMode ? 'text-slate-200 hover:bg-slate-800 border-slate-700' : 'text-slate-700 hover:bg-slate-100 border-slate-200'}`}
        >
          {isMobileMenuOpen ? '✕' : '☰'}
        </button>
      </div>

      {/* 手機版下拉選單 Drawer */}
      {isMobileMenuOpen && (
        <div className={`md:hidden sticky top-14 z-20 border-b p-4 space-y-3 shadow-lg ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <button
            onClick={() => { setIsPrefModalOpen(true); setIsMobileMenuOpen(false); }}
            className={`w-full py-2.5 rounded-xl text-xs font-bold transition border ${darkMode ? 'bg-slate-800 text-slate-200 border-slate-700' : 'bg-slate-100 text-slate-800 border-slate-200'}`}
          >
            ✏️ 設定我的旅行習慣
          </button>
          <div className="flex items-center justify-between pt-1">
            <span className={`text-xs font-bold ${darkMode ? 'text-slate-400' : 'text-slate-700'}`}>切換主題模式</span>
            <button
              onClick={() => setDarkMode(!darkMode)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition ${darkMode ? 'bg-slate-800 text-slate-200' : 'bg-slate-200 text-slate-900'}`}
            >
              {darkMode ? '🌙 深色' : '☀️ 淺色'}
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row items-start min-h-screen">
        
        {/* 桌機版側邊欄 */}
        <div className={`hidden md:flex md:w-64 md:h-screen md:sticky md:top-0 md:self-start border-r p-6 flex-col justify-between shrink-0 ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div>
            <h1 className={`text-xl font-bold flex items-center gap-2 ${darkMode ? 'text-white' : 'text-slate-900'}`}>
              🧳 獨旅 AI 幫手
            </h1>
            <a
              href="https://www.instagram.com/allonetrip_perry/"
              target="_blank"
              rel="noopener noreferrer"
              className={`text-xs transition underline block mt-1 ${darkMode ? 'text-slate-400 hover:text-pink-400' : 'text-slate-600 hover:text-pink-600'}`}
            >
              @allonetrip_perry 專屬行程規劃
            </a>
            <button
              onClick={() => setIsPrefModalOpen(true)}
              className={`mt-6 w-full py-2.5 rounded-xl text-sm font-semibold transition border shadow-sm ${darkMode ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-200'}`}
            >
              ✏️ 設定我的旅行習慣
            </button>
          </div>
          <div className={`pt-6 border-t flex items-center justify-between ${darkMode ? 'border-slate-800' : 'border-slate-200'}`}>
            <span className={`text-xs font-bold ${darkMode ? 'text-slate-400' : 'text-slate-700'}`}>切換主題模式</span>
            <button
              onClick={() => setDarkMode(!darkMode)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition ${darkMode ? 'bg-slate-800 text-slate-200 hover:bg-slate-700' : 'bg-slate-200 text-slate-900 hover:bg-slate-300'}`}
            >
              {darkMode ? '🌙' : '☀️ 淺色'}
            </button>
          </div>
        </div>

        {/* 主內容區 */}
        <div className="flex-1 max-w-3xl mx-auto p-4 md:p-8 space-y-6 w-full">
          
          {/* 表單區塊 */}
          <div className={`p-6 rounded-2xl shadow-sm border space-y-4 ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            <div>
              <label className={`block text-sm font-bold mb-1 ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>
                想去哪裡獨旅？
              </label>
              <input
                type="text"
                placeholder="例如：日本環島、北歐極光之旅"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                className={`w-full px-4 py-2.5 rounded-xl outline-none text-sm font-medium transition focus:ring-2 focus:ring-blue-500 border ${darkMode ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-400' : 'bg-white border-slate-300 text-slate-900 placeholder-slate-500'}`}
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className={`text-sm font-bold ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>
                  旅遊日期區間 📅
                </label>
                {daysCount && (
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${darkMode ? 'text-blue-300 bg-blue-900/50' : 'text-blue-700 bg-blue-50'}`}>
                    共 {daysCount} 天 ({daysCount - 1} 夜)
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="date"
                  min={todayStr}
                  value={startDate}
                  style={{ colorScheme: darkMode ? 'dark' : 'light' }}
                  onChange={(e) => setStartDate(e.target.value)}
                  className={`p-2.5 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500 border ${darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'}`}
                />
                <input
                  type="date"
                  min={startDate || todayStr}
                  value={endDate}
                  style={{ colorScheme: darkMode ? 'dark' : 'light' }}
                  onChange={(e) => setEndDate(e.target.value)}
                  className={`p-2.5 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500 border ${darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'}`}
                />
              </div>
            </div>

            <div>
              <label className={`block text-sm font-bold mb-1 ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>
                獨旅風格與靈感 (選填) 🔗
              </label>
              <input
                type="text"
                placeholder="例如：探索登山、夜生活，或貼上連結"
                value={style}
                onChange={(e) => setStyle(e.target.value)}
                className={`w-full px-4 py-2.5 rounded-xl outline-none text-sm font-medium transition focus:ring-2 focus:ring-blue-500 border ${darkMode ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-400' : 'bg-white border-slate-300 text-slate-900 placeholder-slate-500'}`}
              />
              <p className={`text-xs mt-2 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                可輸入旅遊喜好，或貼上 IG / YouTube 公開景點圖片或影片連結
              </p>
            </div>

            <button
              onClick={() => handleGenerate()}
              disabled={loading || isFormInvalid}
              className={`w-full py-3 font-bold rounded-xl shadow transition ${
                loading || isFormInvalid
                  ? (darkMode ? 'bg-slate-800 text-slate-600 cursor-not-allowed' : 'bg-slate-200 text-slate-400 cursor-not-allowed')
                  : (darkMode ? 'bg-white text-slate-900 hover:bg-slate-100' : 'bg-slate-900 hover:bg-black text-white')
              }`}
            >
              {loading ? 'Perry 正在思考中，請稍等...' : '一鍵生成專屬行程 ✨'}
            </button>
          </div>

          {/* 橫幅區塊 */}
          <div className={`rounded-2xl shadow-sm border p-6 flex flex-col items-center justify-center space-y-4 ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            <p className={`text-sm font-bold ${darkMode ? 'text-slate-200' : 'text-slate-800'}`}>想要來場更客製化的旅程規劃嗎？</p>
            <a
              href="https://www.instagram.com/allonetrip_perry/"
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-700 hover:to-pink-600 text-white text-sm font-bold rounded-full shadow transition transform hover:scale-105 inline-block"
            >
              💼 與我聯繫
            </a>
          </div>

          {/* 對話區塊 */}
          {(messages.length > 0 || loading) && (
            <div className={`rounded-2xl shadow-sm border p-4 md:p-6 space-y-4 ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
              
              {/* 🟢 核心修改：手機端頂部偏移精準設定為 top-14 (56px)，絕不與最頂部 Header 遮擋重疊 */}
              <div ref={chatHeaderRef} className={`flex items-center justify-between border-b pb-2.5 sticky top-14 md:top-0 backdrop-blur-md z-10 pt-2 px-1 ${darkMode ? 'border-slate-800 bg-slate-900/95' : 'border-slate-100 bg-white/95'}`}>
                <span className={`hidden sm:flex font-bold text-sm items-center gap-1 shrink-0 ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>
                  📍 專屬獨旅行程對話
                </span>
                
                {/* 雙 CTA 按鈕區 */}
                <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-2">
                  <button
                    onClick={handleShare}
                    className={`px-3 py-1.5 text-xs font-bold rounded-xl transition border flex items-center justify-center gap-1.5 flex-1 sm:flex-initial ${darkMode ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-200'}`}
                  >
                    🔗 分享對話
                  </button>
                  <a
                    href="https://www.instagram.com/allonetrip_perry/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`px-3 py-1.5 text-xs font-bold rounded-xl transition border flex items-center justify-center gap-1.5 flex-1 sm:flex-initial ${darkMode ? 'bg-pink-950/40 hover:bg-pink-900/50 text-pink-300 border-pink-800' : 'bg-pink-50 hover:bg-pink-100 text-pink-600 border-pink-200'}`}
                  >
                    💼 與我聯繫
                  </a>
                </div>
              </div>

              {/* 訊息列表 */}
              <div className="space-y-4">
                {messages.map((m, i) => (
                  <div key={i} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                    {m.images && m.images.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-2">
                        {m.images.map((img, imgIdx) => (
                          <img key={imgIdx} src={img} alt="上傳圖片" className={`w-20 h-20 object-cover rounded-xl border ${darkMode ? 'border-slate-700' : 'border-slate-200'}`} />
                        ))}
                      </div>
                    )}
                    <div className={`p-4 rounded-2xl max-w-[95%] text-sm ${
                      m.role === 'user'
                        ? 'bg-blue-600 text-white font-medium'
                        : (darkMode ? 'bg-slate-800 border border-slate-700' : 'bg-slate-50 border border-slate-100')
                    }`}>
                      {m.role === 'user' ? m.content : <MarkdownMessage content={m.content} darkMode={darkMode} />}
                    </div>
                  </div>
                ))}

                {loading && (
                  <div className={`flex items-center space-x-2 p-4 rounded-2xl border w-fit ${darkMode ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-slate-50 border-slate-100 text-slate-600'}`}>
                    <span className="animate-pulse">🔵</span>
                    <span className="text-sm font-bold">Perry 正在思考中，請稍等...</span>
                  </div>
                )}
              </div>

              {/* 輸入區塊 */}
              <div className={`space-y-2 pt-2 border-t ${darkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                {selectedImages.length > 0 && (
                  <div className={`flex gap-2 p-2 rounded-xl border border-dashed ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-300'}`}>
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
                    className={`w-11 h-11 p-2.5 rounded-xl transition border flex items-center justify-center shrink-0 ${darkMode ? 'text-slate-300 hover:bg-slate-800 border-slate-700' : 'text-slate-600 hover:bg-slate-100 border-slate-300'}`}
                    title="上傳行程圖片/靈感截圖 (最多5張)"
                  >
                    📎
                  </button>

                  <input
                    type="text"
                    placeholder="問問 Perry...（例如：展開 Day 1-5，或附圖）"
                    value={inputQuery}
                    onChange={(e) => setInputQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                        e.preventDefault();
                        handleGenerate(inputQuery);
                      }
                    }}
                    className={`flex-1 h-11 px-4 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500 border ${darkMode ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-400' : 'bg-white border-slate-300 text-slate-900 placeholder-slate-500'}`}
                  />

                  <button
                    onClick={() => handleGenerate(inputQuery)}
                    disabled={loading || (!inputQuery.trim() && selectedImages.length === 0)}
                    className={`w-11 h-11 p-2.5 flex items-center justify-center rounded-xl transition shrink-0 shadow-sm ${
                      loading || (!inputQuery.trim() && selectedImages.length === 0)
                        ? (darkMode ? 'bg-slate-800 text-slate-600 cursor-not-allowed' : 'bg-slate-200 text-slate-400 cursor-not-allowed')
                        : (darkMode ? 'bg-white text-slate-900 hover:bg-slate-100' : 'bg-slate-900 text-white hover:bg-black')
                    }`}
                    title="發送訊息"
                  >
                    {loading ? (
                      <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Modal 彈窗 */}
      {isPrefModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className={`border rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            <div className={`flex justify-between items-center border-b pb-3 ${darkMode ? 'border-slate-800' : 'border-slate-100'}`}>
              <h3 className={`text-lg font-bold flex items-center gap-2 ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                ✏️ 設定我的旅行習慣
              </h3>
              <button
                onClick={() => setIsPrefModalOpen(false)}
                className={`font-bold text-lg ${darkMode ? 'text-slate-400 hover:text-slate-200' : 'text-slate-400 hover:text-slate-600'}`}
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className={`block text-xs font-bold mb-1 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                  習慣出發地點 / 機場
                </label>
                <input
                  type="text"
                  value={userPreferences.departureAirport}
                  onChange={(e) => setUserPreferences({ ...userPreferences, departureAirport: e.target.value })}
                  placeholder="例如：台北桃園 TPE、高雄小港 KHH"
                  className={`w-full px-3 py-2 border rounded-xl text-sm font-medium outline-none ${darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'}`}
                />
              </div>

              <div>
                <label className={`block text-xs font-bold mb-1 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                  飲食限制 / 偏好
                </label>
                <input
                  type="text"
                  value={userPreferences.dietary}
                  onChange={(e) => setUserPreferences({ ...userPreferences, dietary: e.target.value })}
                  placeholder="例如：不吃牛肉、全素、喜歡在地拉麵"
                  className={`w-full px-3 py-2 border rounded-xl text-sm font-medium outline-none ${darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'}`}
                />
              </div>

              <div>
                <label className={`block text-xs font-bold mb-1 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                  預算與住宿風格
                </label>
                <input
                  type="text"
                  value={userPreferences.budget}
                  onChange={(e) => setUserPreferences({ ...userPreferences, budget: e.target.value })}
                  placeholder="例如：獨旅青旅、平價商旅、豪華飯店"
                  className={`w-full px-3 py-2 border rounded-xl text-sm font-medium outline-none ${darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'}`}
                />
              </div>

              <div>
                <label className={`block text-xs font-bold mb-1 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                  補充個性化習慣
                </label>
                <textarea
                  rows={2}
                  value={userPreferences.customNotes}
                  onChange={(e) => setUserPreferences({ ...userPreferences, customNotes: e.target.value })}
                  placeholder="例如：不喜歡太早起床，偏好悠閒步調、喜歡獨立咖啡廳"
                  className={`w-full px-3 py-2 border rounded-xl text-sm font-medium outline-none ${darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'}`}
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setIsPrefModalOpen(false)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition ${darkMode ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}
              >
                取消
              </button>
              <button
                onClick={handleSavePreferences}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition hover:opacity-90 shadow ${darkMode ? 'bg-white text-slate-900' : 'bg-slate-900 text-white'}`}
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