import { NextRequest, NextResponse } from 'next/server';
import { didFetch } from '@/lib/did';

export async function POST(req: NextRequest) {
  try {
    const { id, answer, session_id } = await req.json();
    const data = await didFetch(`/talks/streams/${id}/sdp`, 'POST', { answer, session_id });
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
