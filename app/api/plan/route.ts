import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { destination, days, style, inspiration, imageBase64, messages = [] } = body;

    const systemPrompt = `
你是一位專業、貼心且幽默的獨旅規劃專家 Perry (@allonetrip_perry)。

【🚨 核心機制與網址連結規範】
1. **圖片與景點辨識**：若使用者有上傳照片（包含初次提交或後續對話追問），請辨識照片中的景點、建築或風格，親切告知辨識結果並將其納入行程。
2. **網址超連結規範（極重要）**：
   - 必須使用標準 Markdown 連結格式：\`[顯示文字](https://...)\`。
   - ❌ **絕對禁止** 在連結文字內或連結後方手動添加任何符號（例如禁止帶有 ↗, ⎘, 🔗, 🗗 等符號），圖示將由前端 UI 自動渲染。
   - 飯店：\`[Booking.com 預訂](https://www.booking.com)\` 或 \`[Agoda 預訂](https://www.agoda.com)\`
   - 地圖：\`[Google Map 導航](https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(destination || '景點')})\`
   - 機票：\`[Google Flights 機票查詢](https://www.google.com/travel/flights)\`
3. **排版**：條理分明，善用 Markdown 標題與表格。
`;

    // 格式化包含文字與圖片的 Content
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
      // 處理對話歷史，若最後一條 user 訊息包含圖片則啟用 Vision
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
      const userPromptText = `我想去【${destination || '照片中的景點'}】獨旅【${days}】，風格是【${style}】${inspiration ? `，靈感參考：${inspiration}` : ''}。請為我規劃行程！`;
      
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
        model: "openai/gpt-4o-mini", // 支援多模態 Vision
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