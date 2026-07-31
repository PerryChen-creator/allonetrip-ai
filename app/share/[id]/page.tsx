'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default function SharePage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const [data, setData] = useState<{ destination?: string; content?: string } | null>(null);
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

    if (resolvedParams?.id) {
      fetchItinerary();
    }
  }, [resolvedParams?.id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0D1117] text-white flex items-center justify-center p-4">
        <div className="animate-pulse text-sm text-neutral-400">⚡ 正在為你載入專屬行程...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#0D1117] text-white flex flex-col items-center justify-center p-4">
        <p className="text-red-400 mb-4">{error || '找不到行程'}</p>
        <Link href="/" className="px-4 py-2 bg-neutral-800 rounded-xl text-xs text-white">
          返回首頁自己規劃
        </Link>
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
        <Link href="/" className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded-full font-medium transition">
          我也要規劃 ✨
        </Link>
      </header>

      <div className="w-full max-w-xl bg-[#161B22] border border-neutral-800 rounded-2xl p-5 shadow-xl">
        <div className="whitespace-pre-wrap text-xs text-neutral-200 leading-relaxed">
          {data.content}
        </div>
      </div>
    </main>
  );
}