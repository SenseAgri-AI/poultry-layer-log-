import { NextResponse } from 'next/server';
import { listPrices, addPrice } from '@/lib/pricesService';
import type { Price } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const prices = await listPrices();
    return NextResponse.json({ prices });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load prices';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<Price>;
    const effectiveDate = String(body.effectiveDate ?? '').trim();
    if (!effectiveDate) throw new Error('effectiveDate is required');
    const price: Price = {
      effectiveDate,
      small: Number(body.small ?? 0),
      medium: Number(body.medium ?? 0),
      large: Number(body.large ?? 0),
      xl: Number(body.xl ?? 0),
      j: Number(body.j ?? 0)
    };
    await addPrice(price);
    return NextResponse.json({ price });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to save price';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
