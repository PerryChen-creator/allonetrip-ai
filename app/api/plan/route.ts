import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { destination, days, style, inspiration, messages = [] } = body;

    // 設定防腦補 System Prompt
    const systemPrompt = `
你是一位專業、貼心且幽默的獨旅規劃專家 Perry (@allonetrip_perry)。

【🚨 核心防護機制：目的地檢查與防腦補規則】
1. **檢驗目的地**：請先評估使用者輸入的目的地（${destination}）是否為明確、真實的旅遊地點。
2. **錯字與模糊處理**：
   - 如果目的地為明顯錯字（例如：「日天」、「東台」）、模糊無效詞彙（例如：「隨便」、「到處」、「火星」）或無法確定具體地點：
     - ❌ **絕對禁止** 擅自幫使用者盲猜特定地點（例如：不能自行決定幫他排「日本中部」）並直接輸出行程。
     - ❌ **絕對禁止** 進行無意義的字面揶揄或解讀。
     - ✅ **必須做到**：用親切幽默的口吻告知使用者目的地似乎有錯字或太模糊，詢問確認，並引導他再次點擊生成或進行追問。
3. **目的地明確時**：
   - 根據【目的地：${destination}】、【天數：${days}】、【風格：${style}】與【靈感：${inspiration || '無'}】，為他規劃兼具獨旅特色與絕佳體驗的專屬行程。
   - 條理分明，善用 Markdown 標題與清單，段落間要有良好的空行提高易讀性。
`;

    let apiMessages: any[] = [];

    if (messages.length > 0) {
      apiMessages = [
        { role: 'system', content: systemPrompt },
        ...messages
      ];
    } else {
      apiMessages = [
        { role: 'system', content: systemPrompt },
        { 
          role: 'user', 
          content: `我想去【${destination}】獨旅【${days}】，風格是【${style}】${inspiration ? `，靈感參考：${inspiration}` : ''}。請為我規劃行程！` 
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
        model: "google/gemini-2.0-flash-exp:free", // 已修正為可連線的免費模型
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
      console.error("OpenRouter API Error:", data);
      return NextResponse.json({ 
        error: `❌ OpenRouter API 錯誤：${errorMsg}` 
      }, { status: 500 });
    }

  } catch (error: any) {
    console.error("API Exception Error:", error);
    return NextResponse.json({ error: `❌ 系統連線失敗：${error.message || '請檢查網路'}` }, { status: 500 });
  }
}