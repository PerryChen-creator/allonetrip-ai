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

    // 🟢 1. 動態取得 OpenRouter 當前此時此刻所有線上免費模型
    let candidateModels: string[] = [];
    try {
      const modelsRes = await fetch('https://openrouter.ai/api/v1/models');
      if (modelsRes.ok) {
        const modelsData = await modelsRes.json();
        candidateModels = (modelsData.data || [])
          .filter((m: any) => m.id && m.id.endsWith(':free'))
          .map((m: any) => m.id);
      }
    } catch (e) {
      console.warn('動態獲取模型失敗:', e);
    }

    // 2. 若 OpenRouter 列表獲取異常，提供基礎備援
    if (candidateModels.length === 0) {
      candidateModels = [
        'google/gemini-2.0-flash-lite-001:free',
        'qwen/qwen-2.5-72b-instruct:free',
        'openrouter/auto'
      ];
    }

    // 優先輪詢前 5 個即時免費模型
    const modelsToTry = candidateModels.slice(0, 5);

    let reply = '';
    let lastErrorMsg = '';

    for (const model of modelsToTry) {
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
            break; // 成功即刻跳出
          }
        } else {
          const errText = await res.text();
          try {
            const errObj = JSON.parse(errText);
            lastErrorMsg = errObj.error?.message || errText;
          } catch {
            lastErrorMsg = errText;
          }
        }
      } catch (err: any) {
        lastErrorMsg = err.message || String(err);
      }
    }

    if (!reply) {
      return NextResponse.json(
        { error: `AI 免費通道繁忙，請稍後重試。(${lastErrorMsg})` },
        { status: 500 }
      );
    }

    return NextResponse.json({ reply });
  } catch (err: any) {
    return NextResponse.json({ error: `伺服器內部錯誤: ${err.message || '未知錯誤'}` }, { status: 500 });
  }
}