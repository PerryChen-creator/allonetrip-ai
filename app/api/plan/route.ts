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

【排版與輸出規範（請嚴格遵守原稿設計）】
1. **開場**：親切歡迎，說明這是為使用者梳理出的【階段性骨架與必去核心地標】。
2. **行程骨架結構**：
   - 使用粗體區分階段（例如：**旅行行程規劃**、**第一階段：地區名稱**）。
   - 禁止使用 \`####\` 或過深的 Header 標題。請統一使用粗體列表整理日期，例如：\`* **Day 1 ~ Day 7：高知**\`。
3. **景點連結嵌入**：
   - 所有景點、美食必須作為子清單，且直接將名稱嵌入 Google Maps 搜尋超連結，格式必須為：\`  * [高知城](https://www.google.com/maps/search/?api=1&query=高知城)\`。
   - 絕對禁止獨立顯示 URL 網址，也禁止將連結拆成單獨一行。
4. **旅行總結與結尾 CTA（必須包含）**：
   - 行程最後必須包含「旅行總結」段落。
   - 結尾必須附上固定結構的引導問答區塊，範例如下：

💡 **這趟行程接下來你想先規劃哪一部分？**
你可以隨時告訴 Perry：
1. 🔍 **展開詳細時刻表**：「幫我展開 Day X ~ Day Y 的每日景點幾點分行程與必吃美食！」
2. 🏨 **獨旅住宿推薦**：「幫我推薦這幾天適合獨旅、安全又性價比高的飯店或青年旅館！」
3. ✈️ **機票與交通建議**：「我想諮詢最佳機票安排與交通套票！」`;

    const formattedMessages = [
      { role: 'system', content: systemPrompt },
      ...(messages?.map((m: any) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content
      })) || [])
    ];

    // 動態取得 OpenRouter 線上免費模型
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

    if (candidateModels.length === 0) {
      candidateModels = [
        'google/gemini-2.0-flash-lite-001:free',
        'qwen/qwen-2.5-72b-instruct:free',
        'openrouter/auto'
      ];
    }

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
            break;
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