import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { destination, days, startDate, endDate, style, imageBase64, messages = [] } = body;

    const systemPrompt = `
你是一位專業、貼心且幽默的獨旅規劃專家 Perry (@allonetrip_perry)。

【🚨 核心鐵律：Google Map 超連結語法修復與防壞規格】

1. **Google Map 超連結防壞規格（極重要，避免語法破損與定位錯誤）**：
   - 格式：\`[景點或店家全名](https://www.google.com/maps/search/?api=1&query=國家與地區+景點或店家全名)\`
   - 範例：\`[弘人市場](https://www.google.com/maps/search/?api=1&query=日本+四國+高知+弘人市場)\`
   - ⚠️ **網址括號 () 內部絕對不能有空格 (Space) 或換行**！網址內的空格必須一律替換為加號 \`+\`（例如寫 \`query=炭火燒肉+かんみ\`，絕對不能寫 \`query=炭火燒肉 かんみ\`，否則 Markdown 語法會斷裂爆開）。
   - ⚠️ **查詢關鍵字必須加上國家與城市**（如：\`日本+四國+高知+...\`），這樣使用者點擊時才不會因為目前 IP 在台灣而誤定位到台灣/彰化的在地店家！

2. **嚴禁出現模糊廢話店名**：
   - ❌ **絕對禁止** 寫「海鮮餐廳」、「當地小吃」、「附近餐廳」、「燒肉店」！
   - ⭕ 必須寫出**真實具體存在的店家全名**（例如：\`[料亭花月](https://www.google.com/maps/search/?api=1&query=日本+高知+室戶+料亭花月)\`）。

3. **長天數行程處理原則（避免字數爆掉中斷）**：
   - 使用者旅遊天數為：【${days}】（日期：${startDate} 至 ${endDate}）。
   - **若天數 $\le 7$ 天**：提供每天詳細的時段行程。
   - **若天數 $> 7$ 天（例如 32 天）**：採用「分階段/分區大綱規劃」，必須覆蓋到最後一天（Day 32），劃分每區重點景點與美食，並提供前 3 天的詳細示範，最後親切告知：「想看第 X 天到第 Y 天的詳細時刻表？隨時告訴 Perry，我為你細化！」

4. **嚴禁亂跳警告與限制**：
   - 亞洲/日本旅遊（如「四國環島」）絕不跳出飛行時間警告。

5. **🚫 嚴禁使用 HTML 標籤與無謂符號**。
`;

    const formatUserContent = (text: string, imgData?: string) => {
      if (imgData) {
        return [
          { type: 'text', text: text },
          { type: 'image_url', image_url: { url: imgData } }
        ];
      }
      return text;
    };

    let apiMessages: any[] = [];

    if (messages.length > 0) {
      const processedMessages = messages.map((m: any, idx: number) => {
        if (idx === messages.length - 1 && m.role === 'user' && m.imageBase64) {
          return {
            role: 'user',
            content: formatUserContent(m.content, m.imageBase64)
          };
        }
        return { role: m.role, content: m.content };
      });

      apiMessages = [
        { role: 'system', content: systemPrompt },
        ...processedMessages
      ];
    } else {
      const userPromptText = `我想去【${destination || '照片中的景點'}】獨旅，日期：${startDate} 至 ${endDate} (共 ${days})${style ? `，風格與靈感偏好：${style}` : ''}。請為我規劃行程！`;
      
      apiMessages = [
        { role: 'system', content: systemPrompt },
        { 
          role: 'user', 
          content: formatUserContent(userPromptText, imageBase64)
        }
      ];
    }

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://allonetrip-ai.vercel.app",
        "X-Title": "Solo Travel AI Agent",
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        messages: apiMessages,
        temperature: 0.7,
      }),
    });

    const data = await response.json();

    if (response.ok && data.choices?.[0]?.message?.content) {
      const resultText = data.choices[0].message.content;
      return NextResponse.json({ 
        reply: resultText, 
        itinerary: resultText 
      });
    } else {
      const errorMsg = data.error?.message || data.message || JSON.stringify(data.error) || "OpenRouter 驗證失敗";
      return NextResponse.json({ error: `❌ OpenRouter API 錯誤：${errorMsg}` }, { status: 500 });
    }

  } catch (error: any) {
    return NextResponse.json({ error: `❌ 系統連線失敗：${error.message || '請檢查網路'}` }, { status: 500 });
  }
}