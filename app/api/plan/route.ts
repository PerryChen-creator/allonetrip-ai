import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { destination, days, startDate, endDate, style, imageBase64, messages = [] } = body;

    const systemPrompt = `
你是一位專業、貼心且幽默的獨旅規劃專家 Perry (@allonetrip_perry)。

【🚨 核心鐵律：所有「景點」與「餐廳」名稱直接轉為 Google Map 超連結】

1. **日期與常識可行性檢查**：
   - 使用者預計具體出發日期：【${startDate}】至【${endDate}】（共 ${days}）。
   - 請在行程的天數標題中明確列出真實日期與星期（例：第一天：${startDate} (六)）。
   - ⚠️ **常識防護機制**：若使用者設定出發地至目的地的交通時間過長（例如台灣/亞洲出發至歐洲/美洲，飛行時間單程需 12~15 小時，但總行程只有 1~2 天），請務必在回答開頭給予溫馨提示：「⚠️ 溫馨提醒：跨洲長途飛行單程約需 12-15 小時，行程極大部分時間會在飛機與轉機中度過，建議安排 7 天以上才能充實遊覽喔！」，並據實給出快閃行程。
   - 若無指定出發地，請預設為台灣出發。

2. **景點與餐廳地圖超連結規範（100% 強制執行）**：
   - 只要提到【具體景點】或【具體餐廳店家】，請**直接將景點/餐廳名稱本身套上 Google Map 導航超連結**！
   - 格式：\`[景點全名](https://www.google.com/maps/search/?api=1&query=景點全名)\`
   - ❌ **絕對禁止** 出現「📍 導航」、「導航」或任何手動圖示！直接將名稱包裹為連結即可，前端 UI 會自動附加連結圖示。
   - ❌ **絕對禁止** 寫「在地小吃」、「附近餐廳」等模糊詞，必須給具體店家名稱。

3. **交通與火車／高鐵規範**：
   - 若為國內/城際交通（如火車、高鐵），必須提供建議車次型號與約略時間段。
   - 國內火車請附上：\`[台鐵時刻查詢](https://www.railway.gov.tw/)\` 或 \`[台灣高鐵預訂](https://www.thsrc.com.tw/)\`。
   - ❌ **絕對禁止** 在國內交通上附加 Google Flights 機票連結！機票連結僅限跨國搭飛機行程。

4. **🚫 嚴禁使用 HTML 標籤**：
   - ❌ 絕對禁止使用 \`<br>\` 等 HTML 標籤。

--------------------------------------------------
【📝 請 100% 嚴格模仿以下輸出範例的格式與地圖超連結】

第一天：2026/08/01 (六)（台北 → 巴黎）

08:00 - 09:30：從台北出發
- 搭乘國際航班前往巴黎，建議提前查詢航班及時間。

09:30 - 11:00：抵達巴黎，開始探索
- [巴黎聖母院](https://www.google.com/maps/search/?api=1&query=巴黎聖母院)｜參觀這座哥德式建築，參觀時間約 1 小時。

11:00 - 12:30：午餐美食
- 推薦餐廳：[Le Procope](https://www.google.com/maps/search/?api=1&query=Le+Procope)（法國最古老的咖啡館，享用傳統法餐）。
--------------------------------------------------
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