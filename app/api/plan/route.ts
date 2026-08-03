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

    const { destination, startDate, endDate, style, messages, userPreferences } = await req.json();

    const prefText = userPreferences ? `
【使用者個人習慣與偏好設定】
- 習慣出發地點：${userPreferences.departureAirport || '未指定'}
- 飲食限制偏好：${userPreferences.dietary || '無特別限制'}
- 預算與住宿風格：${userPreferences.budget || '彈性'}
- 💡 其他補充需求/習慣：${userPreferences.customNotes || '無'}
` : '';

    const systemPrompt = `你是一位專業且貼心的獨旅 AI 助手「Perry」(@allonetrip_perry)。
你的任務是為使用者規劃極具個人化特色的獨立旅行行程。如果使用者上傳了圖片，請結合圖片內容進行分析。

${prefText}

【排版與輸出規範】
1. **結構規範**：
   - 使用簡潔 Markdown 結構。
   - 如需輸出總覽表格，請使用標準 Markdown 表格，例如：
     | 區域 | 天數 | 主要城市 |
     |---|---|---|
     | 關西地區 | Day 1 ~ Day 7 | 大阪、京都 |
2. **景點連結嵌入**：
   - 所有景點美食名稱，請直接包裹為超連結，格式如：[伏見稻荷大社](https://www.google.com/maps/search/?api=1&query=伏見稻荷大社)
   - 禁止在後方重覆輸出 URL 網址。
3. **結尾 CTA 引導**：
   - 行程最後請包含以下引導問答：
     💡 **這趟行程接下來你想先規劃哪一部分？**
     你可以隨時告訴 Perry：
     1. 🔍 **展開詳細時刻表**：「幫我展開 Day X ~ Day Y 的每日景點與美食！」
     2. 🏨 **獨旅住宿推薦**：「幫我推薦這幾天適合獨旅、安全又性價比高的住宿！」
     3. ✈️ **機票與交通建議**：「我想諮詢最佳機票安排與交通套票！」`;

    const formattedMessages = [
      { role: 'system', content: systemPrompt },
      ...(messages?.map((m: any) => {
        if (m.images && m.images.length > 0) {
          const contentParts: any[] = [{ type: 'text', text: m.content }];
          m.images.forEach((img: string) => {
            contentParts.push({ type: 'image_url', image_url: { url: img } });
          });
          return { role: m.role === 'assistant' ? 'assistant' : 'user', content: contentParts };
        }
        return { role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content };
      }) || [])
    ];

    let candidateModels: string[] = [];
    try {
      const modelsRes = await fetch('https://openrouter.ai/api/v1/models');
      if (modelsRes.ok) {
        const modelsData = await modelsRes.json();
        candidateModels = (modelsData.data || [])
          .filter((m: any) => m.id && m.id.endsWith(':free'))
          .map((m: any) => m.id)
          // 🟢 核心修復：剔除 guard, moderation, embed 等非對話稽核模型
          .filter((id: string) => {
            const lower = id.toLowerCase();
            return !lower.includes('guard') &&
                   !lower.includes('moderation') &&
                   !lower.includes('embed') &&
                   !lower.includes('eval');
          });
      }
    } catch (e) {
      console.warn('動態獲取模型失敗:', e);
    }

    if (candidateModels.length === 0) {
      candidateModels = ['google/gemini-2.0-flash-lite-001:free', 'openrouter/auto'];
    }

    let reply = '';
    let lastErrorMsg = '';

    for (const model of candidateModels.slice(0, 5)) {
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
          reply = data.choices?.[0]?.message?.content || '';
          // 排除只印出安全警示語句的回應
          if (reply && !reply.includes('User Safety: safe')) break;
        } else {
          lastErrorMsg = await res.text();
        }
      } catch (err: any) {
        lastErrorMsg = err.message || String(err);
      }
    }

    if (!reply) {
      return NextResponse.json({ error: `AI 服務繁忙，請稍後重試 (${lastErrorMsg})` }, { status: 500 });
    }

    return NextResponse.json({ reply });
  } catch (err: any) {
    return NextResponse.json({ error: `伺服器錯誤: ${err.message || '未知錯誤'}` }, { status: 500 });
  }
}