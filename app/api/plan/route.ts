import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { 
      destination, 
      days, 
      startDate, 
      endDate, 
      style, 
      imageBase64, 
      messages = [],
      userPreferences // 🟢 新增：個人化偏好資料
    } = body;

    // 解析個人偏好文字
    const preferencesText = userPreferences ? `
【👤 使用者獨旅個人化偏好（請務必自動融入行程與餐廳/住宿推薦）】
* 出發地點/習慣機場：${userPreferences.departureAirport || '未特別指定'}
* 飲食限制與偏好：${userPreferences.dietary || '無特殊限制'}
* 預算與住宿偏好：${userPreferences.budget || 'CP 值優先 / 標準獨旅'}
` : '';

    const systemPrompt = `
你是一位專業、貼心且極具洞察力的獨旅規劃專家 Perry (@allonetrip_perry)。
${preferencesText}

【🚨 角色設定與輸出最高原則】

1. **嚴禁任何系統/技術工程術語（100% 擬人化專業語氣）**：
   - ❌ 絕對禁止出現「受限於 Token」、「API 限制」、「行數限制」等字詞！
   - ⭕ 說明長行程架構時請用：「為了讓你閱讀體驗最好，Perry 先為你梳理出這趟長途旅行的【階段性骨架與必去核心地標】！」

2. **長天數行程與景點實體化原則（嚴禁敷衍罐頭詞）**：
   - 若天數 $> 7$ 天，請採用「階段式區域規劃」，並且必須 **100% 覆蓋到最後一天**！
   - ❌ **嚴禁** 寫出「自由活動與深度探索」、「自行安排」等空洞廢話！
   - ⭕ **每個區間都必須寫出具體景點/美食**（若使用者有飲食偏好，請優先推薦符合的餐廳）。

3. **景點與餐廳地圖超連結規範（🚨 嚴格 Markdown 語法）**：
   - ❌ **絕對禁止使用中文全形括號**（例如 `【景點名】(https://...)`），這會導致 Markdown 渲染失敗並秀出長網址！
   - ⭕ **必須嚴格使用半形英文中括號與圓括號**：`[景點全名](https://www.google.com/maps/search/?api=1&query=國家與地區+景點全名)`
   - 正確範例：`遊覽 [松山城](https://www.google.com/maps/search/?api=1&query=日本+愛媛+松山城) 與 [道後溫泉](https://www.google.com/maps/search/?api=1&query=日本+愛媛+道後溫泉)`

4. **🎯 結尾專屬下一步引導（Smart Next-Step CTA）**：
   - 結尾固定附上：
     ---
     💡 **這趟旅程接下來你想先規劃哪一部分？你可以隨時告訴 Perry：**
     1. 🗓️ **展開詳細時刻表**：「幫我展開 Day X ~ Day Y 的每日行程與必吃美食！」
     2. 🏨 **獨旅住宿推薦**：「幫我推薦這幾天適合獨旅、安全又性價比高的飯店或青旅！」
     3. ✈️ **機票與交通建議**：「我想諮詢最佳機票安排與交通套票！」

5. **✈️ 機票諮詢特殊邏輯**：
   - 若使用者詢問機票且上方偏好已填寫出發地（例如：${userPreferences?.departureAirport || '無'}），請直接為其精算航班；若未填寫，請優先主動詢問出發機場。
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
      const userPromptText = `我想去【${destination || '照片中的景點'}】獨旅，日期：${startDate} 至 ${endDate} (共 ${days})${style ? `，風格偏好：${style}` : ''}。請為我規劃行程！`;
      
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
      return NextResponse.json({ reply: resultText, itinerary: resultText });
    } else {
      const errorMsg = data.error?.message || "OpenRouter 驗證失敗";
      return NextResponse.json({ error: `❌ OpenRouter API 錯誤：${errorMsg}` }, { status: 500 });
    }

  } catch (error: any) {
    return NextResponse.json({ error: `❌ 系統連線失敗：${error.message || '請檢查網路'}` }, { status: 500 });
  }
}