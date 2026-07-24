import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    // 💡 接收新欄位：inspiration (靈感)
    const { destination, days, style, inspiration, messages } = await req.json();
    const apiKey = process.env.OPENROUTER_API_KEY || '';

    // 💡 靈感解析 Prompt：如果使用者有提供連結或描述，AI 必須結合目的地去精準推薦
    const inspirationPrompt = inspiration ? `
    【特別任務：靈感轉換與精準推薦】：
    使用者提供了一個靈感參考（可能是影片連結或畫面描述）："${inspiration}"。
    請你務必解析這個靈感背後的「活動類型、氛圍、自然景觀」，並結合使用者想去的目的地「${destination}」，推薦最適合的具體城市、島嶼或景點！
    (舉例：如果使用者給了海島 SUP 影片，且目的地寫「日本」，你必須聰明地直接幫他把行程定調在「宮古島」或「沖繩」，並把水上活動排入行程)。
    ` : '';

    const systemPrompt = `你是一位名為 Perry (@allonetrip_perry) 的獨旅規劃專家。
    使用者的需求是：大方向目的地「${destination}」、天數「${days}」、風格「${style}」。
    ${inspirationPrompt}

    【核心規則：可行性與現實檢查 (Reality Check)】：
    1. **地理可行性評估**：
       - 如果使用者輸入的地區距離過遠（如10天要跨洲，或5天要跑遍日本全島），請在開頭以親切幽默的語氣直接提醒這不切實際，並主動幫他縮小到最精華的單一區域。
    2. **獨旅友善**：
       - 景點間交通必須順暢。
       - 推薦單人友善餐廳（吧檯位、一個人吃不尷尬）。
       - 行程最後附上專屬 IG 打卡文案與 Hashtags。

    請直接以 Markdown 格式輸出，排版要乾淨好讀。`;

    const chatHistory = [
      { role: 'system', content: systemPrompt },
      ...(messages || [])
    ];

    let itinerary = "";

    if (apiKey) {
      try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey.trim()}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "http://localhost:3000",
            "X-Title": "AllOneTrip AI",
          },
          body: JSON.stringify({
            model: "openrouter/auto", // 讓 OpenRouter 自動選擇強大模型
            messages: chatHistory,
          }),
        });

        const data = await response.json();
        if (response.ok && data.choices?.[0]?.message?.content) {
          itinerary = data.choices[0].message.content;
        }
      } catch (err) {
        console.warn("連線 OpenRouter 失敗：", err);
      }
    }

    if (!itinerary) {
      itinerary = `⚠️ **Perry 的獨旅溫馨提醒：** AI 伺服器稍微塞車中，請再試一次！`;
    }

    return NextResponse.json({ reply: itinerary, itinerary });
  } catch (error) {
    console.error("❌ API 發生錯誤：", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}