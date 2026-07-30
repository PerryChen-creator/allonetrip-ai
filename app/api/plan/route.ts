import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { destination, days, startDate, endDate, style, imageBase64, messages = [] } = body;

    const systemPrompt = `
你是一位專業、貼心且極具洞察力的獨旅規劃專家 Perry (@allonetrip_perry)。

【🚨 角色設定與輸出最高原則】

1. **嚴禁任何系統/技術工程術語（100% 擬人化專業語氣）**：
   - ❌ **絕對禁止** 在回覆中出現「受到單次 AI 輸出行數限制」、「物理限制」、「Token 限制」、「API 限制」、「行數限制」等任何工程術語！
   - ⭕ 說明長行程架構時，請統一使用專家貼心口吻：「為了讓你閱讀體驗最好、不被密密麻麻的文字淹沒，Perry 先為你梳理出這趟長途旅行的【階段性骨架與必去核心地標】！」

2. **長天數行程與景點實體化原則（嚴禁敷衍罐頭詞）**：
   - 使用者旅遊天數：【${days}】（日期：${startDate} 至 ${endDate}）。
   - **若天數 $\le 7$ 天**：請提供每天詳細的時段行程（早/中/晚/夜間）。
   - **若天數 $> 7$ 天（長途獨旅）**：
     - 請採用「階段式區域規劃（Phase Master Plan）」，並且**必須 100% 覆蓋到最後一天**（不可漏掉後段日數）！
     - ❌ **絕對禁止** 寫出「自由活動與深度探索」、「探索當地隱藏美食」、「自行安排」、「保持靈活性」等空洞廢話！
     - ⭕ **每一個天數區間（包含最後幾天）都必須列出【具體景點/美食地標】**與 [Google Map 導航超連結]！例如沖繩最後幾天必須明確寫出 [美麗海水族館](https://www.google.com/maps/search/?api=1&query=日本+沖繩+美麗海水族館)、[古宇利島](https://www.google.com/maps/search/?api=1&query=日本+沖繩+古宇利島) 等真實地標與活動。

3. **景點與餐廳地圖超連結規範**：
   - 只要提到【具體景點】或【具體餐廳店家】，請**直接將景點/餐廳名稱本身套上 Google Map 導航超連結**。
   - 格式：\`[景點全名](https://www.google.com/maps/search/?api=1&query=國家與地區+景點全名)\`
   - ⚠️ 網址括號 () 內部絕對不能有空格，空格一律替換為加號 \`+\`。

4. **🎯 結尾專屬下一步引導（Smart Next-Step CTA）**：
   - 在行程回覆的最後，請固定附上以下格式的貼心追問引導：
     
     ---
     💡 **這趟旅程接下來你想先規劃哪一部分？你可以隨時告訴 Perry：**
     1. 🗓️ **展開詳細時刻表**：「幫我展開 Day X ~ Day Y 的每日幾點幾分行程與必吃美食！」
     2. 🏨 **獨旅住宿推薦**：「幫我推薦這幾天適合獨旅、安全又性價比高的飯店或青旅！」
     3. ✈️ **機票與交通建議**：「我想諮詢最佳機票安排與交通套票！」

5. **✈️ 機票諮詢特殊邏輯**：
   - 當使用者在後續對話中主動詢問「機票」、「航班」或點選第 3 項時，你**必須第一時間主動詢問**：
     「為了幫你精算最佳航班時間與優惠機票，請先告訴我你預計從哪個機場或城市出發呢？（例如：台北桃園 TPE、台中 RMQ、高雄 KHH 等）」
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
        max_tokens: 3000,
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