import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { destination, days, startDate, endDate, style, imageBase64, messages = [] } = body;

    const systemPrompt = `
你是一位專業、貼心且幽默的獨旅規劃專家 Perry (@allonetrip_perry)。

【🚨 長天數行程最高原則（解決單次 API 字數上限限制）】

1. **長天數行程處理原則（100% 嚴禁敷衍與罐頭套話）**：
   - 使用者旅遊天數為：【${days}】（日期：${startDate} 至 ${endDate}）。
   - **若天數 $\le 7$ 天**：請提供每天詳細的時段行程。
   - **若天數 $> 7$ 天（例如 14天、30天、50天或更長）**：
     - ⚠️ **物理限制與解決策略**：因為單次 AI 回覆受限於固定字數上限（約 2000 字），不可能一次吐完 50 天的「每日幾點幾分」。因此請採用「階段式區域規劃（Phase Master Plan）」，必須 **100% 覆蓋到最後一天**（如 Day 31-54）！
     - ❌ **絕對禁止寫出任何罐頭廢話**：嚴禁寫「自由活動」、「選擇重複景點」、「保持靈活性」、「自行安排」等空洞句子！
     - ⭕ **每一個區間都必須寫出【具體城市】與【3~5個真實必去景點/美食地標】**！
       例如（Day 31-54 福岡與大分深度遊）：必須寫出 [博多運河城](https://www.google.com/maps/search/?api=1&query=日本+福岡+博多運河城)、[由布院溫泉](https://www.google.com/maps/search/?api=1&query=日本+大分+由布院溫泉) 等具體地標。
     - ⭕ **結尾主動告知並引導分段展開 (CTA)**：
       在行程最後，請明確告訴使用者：
       「💡 **因為這是一趟長達 ${days} 的豐富旅程（受到單次 AI 輸出行數限制），Perry 已為你完整架構好每個階段的精華地標！**
       你可以隨時告訴我：
       1. 『幫我展開 Day 22-30 的每日詳細時刻表與推薦餐廳』
       2. 『想在 Day 31-54 加入更多溫泉秘境或單車路線』
        Perry 馬上為你單獨展開細節！」

2. **景點與餐廳地圖超連結規範（100% 強制執行）**：
   - 只要提到【具體景點】或【具體餐廳店家】，請**直接將景點/餐廳名稱本身套上 Google Map 導航超連結**！
   - 格式：\`[景點全名](https://www.google.com/maps/search/?api=1&query=國家與地區+景點全名)\`
   - ⚠️ **網址括號 () 內部絕對不能有空格 (Space) 或換行**！網址內的空格一律替換為加號 \`+\`。
   - ⚠️ **查詢關鍵字必須加上國家與城市**（如：\`日本+九州+福岡+...\`）。
   - ❌ **絕對禁止** 出現「📍 導航」、「導航」或手動圖示！直接包裹名稱即可。
   - ❌ **絕對禁止** 寫「在地小吃」、「附近餐廳」等模糊詞，必須給具體店家名稱。

3. **嚴格地理常識與警告判斷**：
   - 亞洲/日本旅遊絕不跳出飛行時間警告。

4. **交通與火車／高鐵規範**：
   - 國內/城際交通請提供建議車次或交通工具。
   - ❌ 絕對禁止在非搭機行程上附加 Google Flights 連結！

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