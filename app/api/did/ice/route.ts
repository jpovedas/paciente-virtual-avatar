import { NextRequest, NextResponse } from 'next/server';
import { didFetch } from '@/lib/did';

export async function POST(req: NextRequest) {
  try {
    const { id, candidate, sdpMid, sdpMLineIndex, session_id } = await req.json();
    const data = await didFetch(`/talks/streams/${id}/ice`, 'POST', {
      candidate, sdpMid, sdpMLineIndex, session_id,
    });
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
