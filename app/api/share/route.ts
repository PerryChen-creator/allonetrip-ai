import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { nanoid } from 'nanoid';

// 1. 生成超短 ID 存入 Supabase
export async function POST(req: Request) {
  try {
    const { content, destination } = await req.json();
    const shareId = nanoid(8); // 自動生成 8 碼極短 ID

    const { error } = await supabase
      .from('itineraries')
      .insert([{ id: shareId, content, destination }]);

    if (error) throw error;

    return NextResponse.json({ shareId });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// 2. 讀取 Supabase 裡的行程
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) return NextResponse.json({ error: '缺少分享 ID' }, { status: 400 });

    const { data, error } = await supabase
      .from('itineraries')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) return NextResponse.json({ error: '行程不存在或已過期' }, { status: 404 });

    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}