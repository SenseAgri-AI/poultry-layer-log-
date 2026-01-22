import { NextResponse } from 'next/server';
import { archiveHouse } from '@/lib/houseService';

export const dynamic = 'force-dynamic';

type ArchivePayload = {
  id?: string;
  username?: string;
  password?: string;
};

function assertAuth(username?: string, password?: string) {
  const expectedUser = process.env.APP_AUTH_USER;
  const expectedPass = process.env.APP_AUTH_PASS;
  if (!expectedUser || !expectedPass) {
    throw new Error('Auth is not configured');
  }
  if (username !== expectedUser || password !== expectedPass) {
    throw new Error('Invalid credentials');
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as ArchivePayload;
    if (!payload.id) {
      return NextResponse.json({ error: 'House ID is required' }, { status: 400 });
    }
    assertAuth(payload.username, payload.password);
    const updated = await archiveHouse(payload.id);
    if (!updated) {
      return NextResponse.json({ error: 'House not found' }, { status: 404 });
    }
    return NextResponse.json({ house: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to archive house';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
