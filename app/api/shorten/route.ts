import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { url } = await req.json();
    if (!url) {
      return NextResponse.json({ error: '缺少網址參數' }, { status: 400 });
    }

    // 使用 TinyURL 的免費用戶端 API (免金鑰) 進行縮網址
    const res = await fetch(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(url)}`);
    
    if (!res.ok) {
      throw new Error('TinyURL 服務暫時無法使用');
    }

    const shortUrl = await res.text();
    return NextResponse.json({ shortUrl });
  } catch (err: any) {
    console.error('縮網址轉換失敗:', err);
    return NextResponse.json({ error: '縮網址轉換失敗' }, { status: 500 });
  }
}