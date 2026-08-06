import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const apiKey = process.env.OPENROUTER_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: '伺服器未設定 OPENROUTER_API_KEY，請至 Vercel Dashboard 設定環境變數' },
        { status: 500 }
      );
    }

    const { lat, lng, manualLocation, category, radius, userPreferences } = await req.json();

    const locationDesc = (lat && lng)
      ? `GPS 座標（${lat}, ${lng}）附近`
      : `地點/車站/區域【${manualLocation}】附近`;

    const prefText = userPreferences ? `
- 飲食限制偏好：${userPreferences.dietary || '無特別限制'}
- 預算與風格：${userPreferences.budget || '彈性'}
` : '';

    const systemPrompt = `你是一位專業且貼心的獨旅 AI 助手「Perry」(@allonetrip_perry)。
你的任務是擔任「📍 隨身獨旅雷達」，根據使用者目前的地理位置，精準推薦周邊高評價、非常適合「獨自一人」的美食餐廳、咖啡廳、私房景點或酒吧。

【搜尋條件與位置】
- 當前位置：${locationDesc}
- 探索類別：${category || '獨旅美食、私房景點'}
- 搜尋範圍：${radius || '1km 步行圈'}
${prefText}

【輸出與排版規範】
1. **精選推薦 3 ~ 4 個地點**：請挑選最符合「獨旅友善」且品質優良的地點。
2. **格式要求**：
   - **名稱與地圖超連結**：所有地點名稱必須包裹為 Google 地圖搜尋連結，格式如：[店名/景點名](https://www.google.com/maps/search/?api=1&query=店名或景點名)
   - **獨旅友善度標籤**：例如 👤 設有單人席/吧台、☕ 不限時附插座、🤫 氣氛安靜不尷尬、🍜 高CP值一人份。
   - **Google 評價與社群精華**：簡述 Google Maps 評分亮點（如：評分 4.5 顆星）、必點招牌美食，以及部落格/IG 網紅好評重點。
3. **結尾 CTA**：結尾附上一句親切的 Perry 獨旅溫馨提示，並鼓勵使用者點選下方輸入框帶入行程。`;

    const formattedMessages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `請為我掃描推薦${locationDesc}適合獨旅的${category}！` }
    ];

    let candidateModels: string[] = [];
    try {
      const modelsRes = await fetch('https://openrouter.ai/api/v1/models');
      if (modelsRes.ok) {
        const modelsData = await modelsRes.json();
        candidateModels = (modelsData.data || [])
          .filter((m: any) => m.id && m.id.endsWith(':free'))
          .map((m: any) => m.id)
          .filter((id: string) => {
            const lower = id.toLowerCase();
            return !lower.includes('guard') &&
                   !lower.includes('moderation') &&
                   !lower.includes('embed') &&
                   !lower.includes('eval');
          });
      }
    } catch (e) {
      console.warn('動態獲取模型失敗:', e);
    }

    if (candidateModels.length === 0) {
      candidateModels = ['google/gemini-2.0-flash-lite-001:free', 'openrouter/auto'];
    }

    let reply = '';
    let isRateLimited = false;

    for (const model of candidateModels.slice(0, 5)) {
      try {
        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey.trim()}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://allonetrip-ai.vercel.app',
            'X-Title': 'AllOneTrip AI Radar',
          },
          body: JSON.stringify({
            model,
            messages: formattedMessages,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          reply = data.choices?.[0]?.message?.content || '';
          if (reply) break;
        } else {
          const errText = await res.text();
          if (res.status === 429 || errText.includes('Rate limit exceeded')) {
            isRateLimited = true;
          }
        }
      } catch (err) {
        console.error(err);
      }
    }

    if (!reply) {
      if (isRateLimited) {
        return NextResponse.json({ error: '今天 AI 免費額度已達上限，請稍後再試！' }, { status: 429 });
      }
      return NextResponse.json({ error: 'AI 服務連線繁忙，請稍後重試！' }, { status: 500 });
    }

    return NextResponse.json({ reply });
  } catch (err: any) {
    return NextResponse.json({ error: '伺服器處理錯誤，請稍後重試！' }, { status: 500 });
  }
}