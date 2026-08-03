import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const apiKey = process.env.OPENROUTER_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: '伺服器未設定 OPENROUTER_API_KEY，請至 Vercel Dashboard 設定環境變數' },
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

    const formattedMessages = [
      { role: 'system', content: systemPrompt },
      ...(messages?.map((m: any) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content
      })) || [])
    ];

    // 🟢 獨立容錯模型清單：優先調用 Gemini 2.0 Flash Lite，失敗自動無縫切換
    const candidateModels = [
      'google/gemini-2.0-flash-lite-001:free',
      'qwen/qwen-2.5-72b-instruct:free',
      'meta-llama/llama-3.1-8b-instruct:free',
      'mistralai/mistral-small-24b-instruct-2501:free'
    ];

    let reply = '';
    let lastError = '';

    for (const model of candidateModels) {
      try {
        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey.trim()}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://allonetrip-ai.vercel.app',
            'X-Title': 'AllOneTrip AI',
          },
          body: JSON.stringify({
            model,
            messages: formattedMessages,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const content = data.choices?.[0]?.message?.content;
          if (content) {
            reply = content;
            break; // 成功取得回應即刻跳出迴圈
          }
        } else {
          lastError = await res.text();
        }
      } catch (err: any) {
        lastError = err.message || String(err);
      }
    }

    if (!reply) {
      return NextResponse.json(
        { error: `AI 服務暫時無法回應，請稍後再試。(${lastError})` },
        { status: 500 }
      );
    }

    return NextResponse.json({ reply });
  } catch (err: any) {
    return NextResponse.json({ error: `伺服器內部錯誤: ${err.message || '未知錯誤'}` }, { status: 500 });
  }
}