import { NextResponse } from 'next/server';
import { listHouses, upsertHouse } from '@/lib/houseService';
import { isIsoDate } from '@/lib/date';
import type { House } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const houses = await listHouses();
    return NextResponse.json({ houses });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load houses';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function normalizeHouse(payload: Partial<House>): House {
  const name = String(payload.name ?? '').trim();
  if (!name) {
    throw new Error('House name is required');
  }
  const id = String(payload.id ?? name).trim();
  if (!id) {
    throw new Error('House ID is required');
  }
  const startDate = String(payload.startDate ?? '').trim();
  if (!isIsoDate(startDate)) {
    throw new Error('Start date is required in YYYY-MM-DD format');
  }
  const startAgeDays = Number(payload.startAgeDays ?? 0);
  const startingHens = Number(payload.startingHens ?? 0);
  if (!Number.isFinite(startAgeDays) || startAgeDays < 0) {
    throw new Error('Start age (days) must be >= 0');
  }
  if (!Number.isFinite(startingHens) || startingHens < 0) {
    throw new Error('Starting hens must be >= 0');
  }
  return {
    id,
    name,
    startDate,
    startAgeDays,
    startingHens
  };
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as Partial<House>;
    const house = normalizeHouse(payload);
    const saved = await upsertHouse(house);
    return NextResponse.json({ house: saved });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to save house';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
