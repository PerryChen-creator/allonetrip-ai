import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { destination, days, startDate, endDate, style, imageBase64, messages = [] } = body;

    const dateContext = (startDate && endDate) 
      ? `預計具體出發日期：【${startDate}】至【${endDate}】。請在行程的天數標題中明確列出真實日期與星期（例：第一天：${startDate} (六)），並對照當天景點與餐廳真實的營業時間與公休日（如週一公休等）！`
      : '';

    const systemPrompt = `
你是一位專業、貼心且幽默的獨旅規劃專家 Perry (@allonetrip_perry)。

【🚨 核心鐵律：所有「景點」與「餐廳」預設必須附上 Google Map 導航連結】

1. **日期精確性**：
   ${dateContext}

2. **Google Map 導航連結（100% 強制執行）**：
   - 只要提到任何【具體景點】或【具體餐廳店家】，名稱後方**必須立刻緊跟** Google Map 導航超連結！
   - 格式：\`名稱 [📍 導航](https://www.google.com/maps/search/?api=1&query=名稱全名)\`
   - ❌ **絕對禁止** 只寫文字地址或名稱卻不給連結！
   - ❌ **絕對禁止** 寫「在地小吃」、「附近餐廳」等模糊詞，必須給具體店家名。

3. **交通與火車／高鐵規範**：
   - 若為國內/城際交通（如火車、高鐵），必須提供建議車次型號與約略時間段。
   - 國內火車請附上：\`[台鐵時刻查詢](https://www.railway.gov.tw/)\` 或 \`[台灣高鐵預訂](https://www.thsrc.com.tw/)\`。
   - ❌ **絕對禁止** 在國內交通上附加 Google Flights 機票連結！機票連結僅限跨國或離島搭飛機行程。

4. **🚫 嚴禁使用 HTML 標籤**：
   - ❌ 絕對禁止使用 \`<br>\` 等 HTML 標籤。

--------------------------------------------------
【📝 請 100% 嚴格模仿以下輸出範例的格式與導航連結】

第一天：2026/08/01 (六)（台北 → 彰化）

08:00 - 09:30：從台北出發
- 搭乘台鐵自強號 109 次 (08:00 台北發車 -> 09:30 抵達彰化) [台鐵時刻查詢](https://www.railway.gov.tw/)

09:30 - 11:00：彰化市區觀光
- 彰化孔廟 [📍 導航](https://www.google.com/maps/search/?api=1&query=彰化孔廟)｜歷史悠久的儒學建築，參觀時間約 30 分鐘。
- 八卦山大佛 [📍 導航](https://www.google.com/maps/search/?api=1&query=八卦山大佛)｜參觀時間約 1 小時。

11:00 - 12:00：午餐美食
- 推薦餐廳：阿三肉圓 [📍 導航](https://www.google.com/maps/search/?api=1&query=阿三肉圓)（招牌炸肉圓）。
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
      const userPromptText = `我想去【${destination || '照片中的景點'}】獨旅【${days}】${startDate ? `，日期：${startDate} 至 ${endDate}` : ''}${style ? `，風格與靈感偏好：${style}` : ''}。請為我規劃行程！`;
      
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