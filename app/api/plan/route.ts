import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: '伺服器未設定 GEMINI_API_KEY，請至 Vercel Dashboard 設定環境變數' },
        { status: 500 }
      );
    }

    const { destination, days, startDate, endDate, style, messages, userPreferences } = await req.json();

    const prefText = userPreferences ? `
【使用者個人習慣與偏好設定】
- 習慣出發地點：${userPreferences.departureAirport || '未指定'}
- 飲食限制偏好：${userPreferences.dietary || '無特別限制'}
- 預算與住宿風格：${userPreferences.budget || '彈性'}
- 💡 其他補充需求/習慣：${userPreferences.customNotes || '無'}
` : '';

    const systemPrompt = `你是一位專業且貼心的獨旅 AI 助手「Perry」(@allonetrip_perry)。
你的任務是為使用者規劃極具個人化特色的獨立旅行行程。

${prefText}

【排版與輸出規範】
1. 輸出格式請使用清晰的 Markdown 結構 (Headers, Bullet Points, Bold)。
2. 景點與美食請務必附上 Google Maps 搜尋連結，範例格式如下：
   [景點名稱](https://www.google.com/maps/search/?api=1&query=LocationName)
3. 請保持親切、專業且有條理的對話語氣。`;

    const formattedMessages = messages?.map((m: any, idx: number) => {
      let text = m.content;
      if (idx === 0 && m.role === 'user') {
        text = `${systemPrompt}\n\n${m.content}`;
      }
      return {
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text }]
      };
    }) || [];

    // 🟢 使用正式版 v1 端點，避免 v1beta 的 404/429 限制
    const endpoints = [
      'https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent',
      'https://generativelanguage.googleapis.com/v1/models/gemini-1.5-pro:generateContent',
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent',
    ];

    let reply = '';
    let lastErrorText = '';

    for (const endpoint of endpoints) {
      try {
        const res = await fetch(`${endpoint}?key=${apiKey.trim()}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: formattedMessages }),
        });

        if (res.ok) {
          const data = await res.json();
          reply = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
          if (reply) break;
        } else {
          lastErrorText = await res.text();
          console.warn(`Endpoint ${endpoint} failed:`, lastErrorText);
        }
      } catch (err: any) {
        lastErrorText = err.message;
      }
    }

    if (!reply) {
      return NextResponse.json(
        { error: `Google API 服務暫時無法回應: ${lastErrorText}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ reply });
  } catch (err: any) {
    return NextResponse.json({ error: `伺服器內部錯誤: ${err.message || '未知錯誤'}` }, { status: 500 });
  }
}