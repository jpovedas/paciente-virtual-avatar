import { NextRequest, NextResponse } from 'next/server';
import { didFetch } from '@/lib/did';

// POST → create stream
export async function POST(req: NextRequest) {
  try {
    const { gender } = await req.json();
    const sourceUrl = gender === 'male'
      ? 'https://d-id-public-bucket.s3.amazonaws.com/or-roman.jpg'
      : 'https://d-id-public-bucket.s3.amazonaws.com/alice.jpg';

    const data = await didFetch('/talks/streams', 'POST', {
      source_url: sourceUrl,
      driver_url: 'bank://lively/',
      output_resolution: 512,
      stream_warmup: true,
    });
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// DELETE → close stream
export async function DELETE(req: NextRequest) {
  try {
    const { id, session_id } = await req.json();
    await didFetch(`/talks/streams/${id}`, 'DELETE', { session_id });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
