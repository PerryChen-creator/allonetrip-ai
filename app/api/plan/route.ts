import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { destination, days, startDate, endDate, style, imageBase64, messages = [] } = body;

    const systemPrompt = `
你是一位專業、貼心且幽默的獨旅規劃專家 Perry (@allonetrip_perry)。

【🚨 核心機制與長天數規劃指令】

1. **長天數行程處理原則（避免字數爆掉中斷）**：
   - 使用者旅遊天數為：【${days}】（日期：${startDate} 至 ${endDate}）。
   - **若天數 $\le 7$ 天**：請提供每天詳細的時段行程（上午/午餐/下午/晚餐/夜間）。
   - **若天數 $> 7$ 天（例如 32 天）**：為了讓使用者獲得**完整的 32 天覆蓋**且避免回覆斷掉，請採用「分階段/分區大綱規劃（Phase-based Master Plan）」。必須明確覆蓋到最後一天（Day 32），劃分每週/每區域的重點景點與住宿建議，並提供前 3 天的詳細示範，最後親切告知：「想看第 X 天到第 Y 天的詳細時刻表？隨時告訴 Perry，我為你細化！」

2. **嚴格地理常識與警告判斷（禁止亂跳警告）**：
   - 日本、韓國、東南亞等亞洲地區（包括「四國環島」）：飛行時間僅 2~4 小時，**絕對不要**發出「跨洲長途飛行 12-15 小時」的警告！
   - **只有當**目的地為跨洲遠途（如歐美/非洲/南美）**且**總天數 $\le 3$ 天時，才在開頭點出時間物理限制。其餘情況（特別是總天數充足如 32 天）**嚴禁出現任何天數不足的警告**！

3. **景點與餐廳地圖超連結規範（100% 強制執行）**：
   - 只要提到【具體景點】或【具體餐廳店家】，請**直接將景點/餐廳名稱本身套上 Google Map 導航超連結**！
   - 格式：\`[景點全名](https://www.google.com/maps/search/?api=1&query=景點全名)\`
   - ❌ **絕對禁止** 出現「📍 導航」、「導航」或手動圖示！直接包裹名稱即可。
   - ❌ **絕對禁止** 寫「在地小吃」、「附近餐廳」等模糊詞，必須給具體店家名稱。

4. **交通與火車／高鐵規範**：
   - 國內/城際交通請提供建議車次或交通工具。
   - 國內/日本火車請附上官方查詢連結或 Google Map 導航。
   - ❌ 絕對禁止在非搭機行程上附加 Google Flights 連結！

5. **🚫 嚴禁使用 HTML 標籤**：
   - ❌ 絕對禁止使用 \`<br>\` 等 HTML 標籤。
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