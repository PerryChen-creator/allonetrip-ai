'use client';

import { useEffect, useState, use } from 'react';

export default function SharePage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchItinerary() {
      try {
        const res = await fetch(`/api/share?id=${resolvedParams.id}`);
        const result = await res.json();

        if (res.ok) {
          setData(result);
        } else {
          setError(result.error || '無法載入行程');
        }
      } catch (err) {
        setError('連線失敗');
      } finally {
        setLoading(false);
      }
    }

    fetchItinerary();
  }, [resolvedParams.id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0D1117] text-white flex items-center justify-center p-4">
        <div className="animate-pulse text-sm text-neutral-400">⚡ 正在為你載入專屬行程...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0D1117] text-[#FFFFFF] flex flex-col items-center justify-center p-4">
        <p className="text-red-400 mb-4">{error}</p>
        <a href="/" className="px-4 py-2 bg-neutral-800 rounded-xl text-xs">返回首頁自己規劃</a>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#0D1117] text-white p-4 md:p-8 flex flex-col items-center">
      <header className="w-full max-w-xl flex justify-between items-center mb-6 pt-2 border-b border-neutral-800 pb-4">
        <div>
          <h1 className="text-xl font-bold text-white">🧳 Perry 分享的獨旅行程</h1>
          <p className="text-xs text-neutral-400">目的地：{data.destination || '專屬行程'}</p>
        </div>
        <a href="/" className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded-full font-medium transition">
          我也要規劃 ✨
        </a>
      </header>

      <div className="w-full max-w-xl bg-[#161B22] border border-neutral-800 rounded-2xl p-5 shadow-xl">
        <div className="whitespace-pre-wrap text-xs text-neutral-200 leading-relaxed">
          {data.content}
        </div>
      </div>
    </main>
  );
}// 🟢 點擊按鈕時，呼叫 Supabase API 生成短網址
const handleShare = async () => {
  if (chatHistory.length === 0) return;
  const lastAssistantMsg = [...chatHistory].reverse().find(m => m.role === 'assistant');
  if (!lastAssistantMsg) return alert('請先生成行程後再分享喔！');

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
      const shareUrl = `${window.location.origin}/share/${data.shareId}`;
      await navigator.clipboard.writeText(shareUrl);
      alert(`🎉 專屬超短網址已複製到剪貼簿！\n\n${shareUrl}`);
    } else {
      alert('分享失敗：' + (data.error || '未知錯誤'));
    }
  } catch (err) {
    alert('分享失敗，請檢查網路連線');
  }
};