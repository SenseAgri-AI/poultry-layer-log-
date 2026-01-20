import { NextResponse } from 'next/server';
import { deleteEntry, listEntries, upsertEntry } from '@/lib/sheetService';
import { normalizeEntry } from '@/lib/validate';
import { isIsoDate } from '@/lib/date';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const entries = await listEntries();
    return NextResponse.json({ entries });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load entries';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const entry = normalizeEntry(payload);
    const saved = await upsertEntry(entry);
    return NextResponse.json({ entry: saved });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to save entry';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    if (!date || !isIsoDate(date)) {
      return NextResponse.json({ error: 'Valid date is required' }, { status: 400 });
    }

    await deleteEntry(date);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete entry';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
