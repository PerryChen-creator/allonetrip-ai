'use client';

import React, { useState, useRef } from 'react';

// 自訂簡易 Markdown 渲染組件（解決連結與 * 號排版問題）
function MarkdownMessage({ content }: { content: string }) {
  const lines = content.split('\n');

  return (
    <div className="space-y-2 text-gray-800 leading-relaxed">
      {lines.map((line, idx) => {
        let trimmed = line.trim();
        if (!trimmed) return <div key={idx} className="h-2" />;

        // 解析列表點 (*)
        const isListItem = trimmed.startsWith('* ') || trimmed.startsWith('- ');
        if (isListItem) {
          trimmed = trimmed.replace(/^[\*\-]\s+/, '');
        }

        // 解析 [連結文字](URL) 與 **粗體**
        const parts = parseMarkdownText(trimmed);

        if (isListItem) {
          return (
            <div key={idx} className="flex items-start space-x-2 pl-2">
              <span className="text-blue-500 font-bold">•</span>
              <div>{parts}</div>
            </div>
          );
        }

        return <div key={idx}>{parts}</div>;
      })}
    </div>
  );
}

// 輔助函式：將 [文字](URL) 轉為 <a> 標籤，**粗體** 轉為 <strong>
function parseMarkdownText(text: string) {
  const regex = /(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g;
  const parts = text.split(regex);

  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index} className="font-semibold text-gray-900">{part.slice(2, -2)}</strong>;
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
            className="inline-flex items-center text-blue-600 hover:text-blue-800 underline font-medium mx-1"
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
  const [destination, setDestination] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [style, setStyle] = useState('');
  
  const [messages, setMessages] = useState<Array<{ role: string; content: string; images?: string[] }>>([]);
  const [inputQuery, setInputQuery] = useState('');
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // 計算天數
  const getDaysCount = () => {
    if (!startDate || !endDate) return null;
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays > 0 ? diffDays : null;
  };

  // 判斷按鈕是否需要停用
  const isFormInvalid = !destination.trim() || !startDate || !endDate;

  // 處理圖片選擇 (上限 5 張)
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

  // 發送請求
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
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
      {/* 側邊欄 */}
      <div className="w-full md:w-64 bg-white border-r border-gray-200 p-6 flex flex-col justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">🧳 獨旅 AI 幫手</h1>
          <p className="text-xs text-gray-400 mt-1">@allonetrip_perry 專屬行程規劃</p>
          <button className="mt-6 w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm transition">
            ✏️ 設定我的旅行習慣
          </button>
        </div>
      </div>

      {/* 主內容區 */}
      <div className="flex-1 max-w-3xl mx-auto p-4 md:p-8 space-y-6">
        {/* 表單區塊 */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">想去哪裡獨旅？</label>
            <input
              type="text"
              placeholder="例如：japan、關西環島"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              className="w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-sm font-medium text-gray-700">旅遊日期區間 📅</label>
              {daysCount && <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded-full">共 {daysCount} 天 ({daysCount - 1} 夜)</span>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="border p-2 rounded-xl text-sm" />
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="border p-2 rounded-xl text-sm" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">獨旅風格與靈感 (選填) 🔗</label>
            <input
              type="text"
              placeholder="例如：探索登山、夜生活，或貼上連結"
              value={style}
              onChange={(e) => setStyle(e.target.value)}
              className="w-full px-4 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <button
            onClick={() => handleGenerate()}
            disabled={loading || isFormInvalid}
            className={`w-full py-3 font-medium rounded-xl shadow transition ${
              loading || isFormInvalid
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-slate-900 hover:bg-black text-white'
            }`}
          >
            {loading ? 'Perry 正在思考中，請稍等...' : '一鍵生成專屬行程 ✨'}
          </button>
        </div>

        {/* 對話對話框 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
          <div className="flex justify-between items-center border-b pb-3">
            <span className="font-semibold text-gray-800 flex items-center gap-2">📍 專屬獨旅行程對話</span>
          </div>

          {/* 訊息列表 */}
          <div className="space-y-4 min-h-[200px]">
            {messages.map((m, i) => (
              <div key={i} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                {m.images && m.images.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {m.images.map((img, imgIdx) => (
                      <img key={imgIdx} src={img} alt="上傳圖片" className="w-20 h-20 object-cover rounded-lg border" />
                    ))}
                  </div>
                )}
                <div className={`p-4 rounded-2xl max-w-[90%] ${m.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-50 border border-gray-100'}`}>
                  {m.role === 'user' ? m.content : <MarkdownMessage content={m.content} />}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex items-center space-x-2 text-gray-500 bg-gray-50 p-4 rounded-2xl border w-fit">
                <span className="animate-pulse">🔵</span>
                <span className="text-sm font-medium">Perry 正在思考中，請稍等...</span>
              </div>
            )}
          </div>

          {/* 對話輸入與圖片上傳區 */}
          <div className="space-y-2 pt-2">
            {selectedImages.length > 0 && (
              <div className="flex gap-2 p-2 bg-gray-50 rounded-xl border border-dashed border-gray-300">
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
                className="p-2.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition border border-gray-200"
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
                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />

              <button
                onClick={() => handleGenerate(inputQuery)}
                disabled={loading}
                className="px-5 py-2.5 bg-slate-800 hover:bg-black text-white text-sm font-medium rounded-xl transition"
              >
                發送
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}