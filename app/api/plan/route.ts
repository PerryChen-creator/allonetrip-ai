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

【核心任務與輸入資訊】
- 使用者指定目的地：【${destination || '未指定'}】
- 日期區間：${startDate || '未指定'} 至 ${endDate || '未指定'}
- 獨旅風格：${style || '無特別指定'}
${prefText}

⚠️ **最高優先級指令**：
1. **直接產出行程**：使用者已經明確填寫目的地【${destination}】，你必須「直接」為使用者規劃並輸出完整的獨旅行程總覽！
2. **嚴禁重複詢問**：絕對禁止發送「你想去哪裡？」、「心中有沒有模糊的目的地？」等反問句或開場引導問候套版！
3. **真實性檢查**：僅當目的地明顯為無意義亂碼或情緒字詞（如：「何必罵」、「啥事」、「12345」）時，才提示使用者確認地點。只要目的地是正常國家/城市（如：日本、韓國、台北、巴黎等），請立即生成行程！

【排版與超連結分流規範】
1. **結構規範**：
   - 使用簡潔 Markdown 結構。
   - 如需輸出總覽表格，請使用標準 Markdown 表格，例如：
     | 區域 | 天數 | 主要城市 |
     |---|---|---|
     | 關西地區 | Day 1 ~ Day 7 | 大阪、京都 |
2. **超連結精準分流規範（非常重要）**：
   - **實體景點 / 地標 / 店家 / 餐廳**：請包裹為 Google 地圖連結，格式如：[伏見稻荷大社](https://www.google.com/maps/search/?api=1&query=伏見稻荷大社)
   - **交通票券 / Pass / 周遊券（如 JR Pass、地鐵一日券等）**：請包裹為一般 Google 搜尋連結，格式如：[JR Pass](https://www.google.com/search?q=JR Pass 官網)
   - **普通名詞 / 抽象食物 / 季節名產（如松茸、秋刀魚、栗子甜點等）**：請直接輸出純文字，**絕對禁止**加入任何地圖或搜尋超連結！
3. **結尾 CTA 引導**：
   - 行程最後請包含以下引導問答：
     💡 **這趟行程接下來你想先規劃哪一部分？**
     你可以隨時告訴 Perry：
     1. 🔍 **展開詳細時刻表**：「幫我展開 Day X ~ Day Y 的每日景點與美食！」
     2. 🏨 **獨旅住宿推薦**：「幫我推薦這幾天適合獨旅、安全又性價比高的住宿！」
     3. ✈️ **機票與交通建議**：「我想諮詢最佳機票安排與交通套票！」`;

    // 角色嚴格交替清洗器 (Strict Alternating Role Sanitizer)
    const rawMsgs = messages || [];
    const sanitizedList: any[] = [];

    for (const m of rawMsgs) {
      if (!m || !m.content) continue;
      const currentRole = m.role === 'assistant' ? 'assistant' : 'user';

      if (sanitizedList.length > 0 && sanitizedList[sanitizedList.length - 1].role === currentRole) {
        const prev = sanitizedList[sanitizedList.length - 1];
        if (typeof prev.content === 'string' && typeof m.content === 'string') {
          prev.content += '\n' + m.content;
        }
      } else {
        sanitizedList.push({
          role: currentRole,
          content: m.content,
          images: m.images
        });
      }
    }

    while (sanitizedList.length > 0 && sanitizedList[0].role !== 'user') {
      sanitizedList.shift();
    }

    const formattedMessages = [
      { role: 'system', content: systemPrompt },
      ...sanitizedList.map((m: any) => {
        if (m.images && m.images.length > 0) {
          const contentParts: any[] = [{ type: 'text', text: m.content }];
          m.images.forEach((img: string) => {
            contentParts.push({ type: 'image_url', image_url: { url: img } });
          });
          return { role: m.role, content: contentParts };
        }
        return { role: m.role, content: m.content };
      })
    ];

    let candidateModels: string[] = [];
    try {
      const modelsRes = await fetch('https://openrouter.ai/api/v1/models');
      if (modelsRes.ok) {
        const modelsData = await modelsRes.json();
        candidateModels = (modelsData.data || [])
          .filter((m: any) => m.id && m.id.endsWith(':free'))
          .map((m: any) => m.id)
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
    let isRateLimited = false;
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
          if (
            reply &&
            !reply.includes('User Safety: safe') &&
            !reply.includes('這趟旅程，你心中有沒有一個模糊的目的地呢')
          ) {
            break;
          }
        } else {
          const errText = await res.text();
          if (res.status === 429 || errText.includes('Rate limit exceeded')) {
            isRateLimited = true;
          }
          lastErrorMsg = errText;
        }
      } catch (err: any) {
        lastErrorMsg = err.message || String(err);
      }
    }

    if (!reply) {
      if (isRateLimited) {
        return NextResponse.json(
          { error: '今天 AI 呼叫免費額度已達上限，請稍後再試！' },
          { status: 429 }
        );
      }
      return NextResponse.json({ error: 'AI 服務繁忙，請稍後重試！' }, { status: 500 });
    }

    return NextResponse.json({ reply });
  } catch (err: any) {
    return NextResponse.json({ error: '伺服器處理錯誤，請稍後重試！' }, { status: 500 });
  }
}