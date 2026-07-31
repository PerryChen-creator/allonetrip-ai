import { createClient } from '@supabase/supabase-js';

// 🟢 加上預設占位符，防止 Vercel 打包時因未讀取到變數而拋出 Uncaught Error
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);