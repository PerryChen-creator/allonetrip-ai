'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';

export default function Home() {
  const [destination, setDestination] = useState('');
  const [days, setDays] = useState('');
  const [style, setStyle] = useState('');
  const [inspiration, setInspiration] = useState('');
  const [loading, setLoading] = useState(false);
  const [itinerary, setItinerary] = useState('');

  const [messages, setMessages] = useState<{ role: string; content: string }[]>([]);
  const [followUpInput, setFollowUpInput] = useState('');
  const [isAnswering, setIsAnswering] = useState(false);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setItinerary('');
    setMessages([]);

    try {
      const res = await fetch('/api/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ destination, days, style, inspiration }),
      });

      const data = await res.json();
      const resultText = data.itinerary || data.error || '無法取得行程';
      
      setItinerary(resultText);
      setMessages([{ role: 'assistant', content: resultText }]);
    } catch (err) {
      setItinerary('系統連線發生錯誤，請重試！');
    } finally {
      setLoading(false);
    }
  };

  const handleFollowUp = async () => {
    if (!followUpInput.trim()) return;

    const userQuestion = followUpInput.trim();
    setFollowUpInput('');
    setIsAnswering(true);

    const updatedMessages = [
      ...messages,
      { role: 'user', content: userQuestion }
    ];
    setMessages(updatedMessages);

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
      });

      const data = await res.json();
      const replyText = data.reply || data.itinerary || '無法取得回答';

      setMessages([
        ...updatedMessages,
        { role: 'assistant', content: replyText }
      ]);
    } catch (err) {
      setMessages([
        ...updatedMessages,
        { role: 'assistant', content: '❌ 追問失敗，請檢查網路連線。' }
      ]);
    } finally {
      setIsAnswering(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
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
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                想去哪裡獨旅？
              </label>
              <input
                type="text"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all"
                placeholder="例如：日本東京、倫敦、紐約"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                預計天數
              </label>
              <input
                type="text"
                value={days}
                onChange={(e) => setDays(e.target.value)}
                className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all"
                placeholder="例如 3 天 2 夜"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                獨旅風格
              </label>
              <input
                type="text"
                value={style}
                onChange={(e) => setStyle(e.target.value)}
                className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all"
                placeholder="例如：探索登山景點、豐富夜生活"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                旅行靈感 (選填) 🔗
              </label>
              <input
                type="text"
                value={inspiration}
                onChange={(e) => setInspiration(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all"
                placeholder="請貼上公開旅行影片或圖片連結"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-black text-white font-medium py-3 rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50 mt-2"
            >
              {loading ? 'Perry 正在為你規劃專屬行程...' : '一鍵生成專屬行程 ✨'}
            </button>
          </form>
        </div>

        {/* 📩 IG 客製化諮詢導流卡片 */}
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-6 rounded-2xl shadow-sm text-center space-y-4">
          <p className="text-base font-medium tracking-wide">
            想要來場更客製化的旅程規劃嗎？
          </p>
          <a
            href="https://www.instagram.com/allonetrip_perry/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-white text-slate-900 px-6 py-2.5 rounded-lg font-semibold text-sm hover:bg-slate-100 transition-all transform hover:-translate-y-0.5 shadow-sm"
          >
            <span>📩 與我聯繫</span>
          </a>
        </div>

        {/* 顯示結果區塊 */}
        {itinerary && (
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-6">
            <h2 className="text-xl font-bold text-slate-900 border-b border-slate-100 pb-3">
              📍 專屬獨旅行程表
            </h2>
            
            <div className="prose prose-slate max-w-none text-left space-y-4 text-slate-700">
              <ReactMarkdown>{itinerary}</ReactMarkdown>
            </div>

            {/* 💬 追問對話區塊 */}
            <div className="mt-8 pt-6 border-t border-slate-200 space-y-4">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                💬 繼續追問 Perry AI
              </h3>

              {messages.slice(1).map((msg, idx) => (
                <div
                  key={idx}
                  className={`p-4 rounded-xl text-sm ${
                    msg.role === 'user'
                      ? 'bg-slate-900 text-white ml-8 text-right'
                      : 'bg-slate-100 text-slate-800 mr-8 text-left prose max-w-none'
                  }`}
                >
                  {msg.role === 'user' ? (
                    <p className="m-0">{msg.content}</p>
                  ) : (
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  )}
                </div>
              ))}

              <div className="flex gap-2 pt-2">
                <input
                  type="text"
                  value={followUpInput}
                  onChange={(e) => setFollowUpInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleFollowUp()}
                  placeholder="例如：請問推薦的這間單人酒吧會不會很貴？"
                  className="flex-1 px-4 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-black"
                />
                <button
                  onClick={handleFollowUp}
                  disabled={isAnswering || !followUpInput.trim()}
                  className="bg-slate-900 text-white px-5 py-2.5 text-sm rounded-lg hover:bg-slate-700 transition-colors disabled:opacity-50 font-medium"
                >
                  {isAnswering ? '思考中...' : '發送'}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </main>
  );
}