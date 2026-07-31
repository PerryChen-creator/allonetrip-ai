// 從 localStorage 取得個人偏好
const savedPreferences = typeof window !== 'undefined' 
  ? JSON.parse(localStorage.getItem('user_preferences') || '{}') 
  : {};

// 發送 API 時帶入 userPreferences
const response = await fetch('/api/plan', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    destination,
    days,
    startDate,
    endDate,
    style,
    userPreferences: savedPreferences, // 🟢 自動注入偏好設定！
    // ...其他欄位
  }),
});