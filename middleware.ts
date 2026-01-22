import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

function unauthorized() {
  const response = new NextResponse('Authentication required', { status: 401 });
  response.headers.set('WWW-Authenticate', 'Basic realm="Poultry Log"');
  return response;
}

function decodeBasicAuth(header: string): { user: string; pass: string } | null {
  const [scheme, value] = header.split(' ');
  if (scheme !== 'Basic' || !value) return null;
  try {
    const decoded = globalThis.atob(value);
    const index = decoded.indexOf(':');
    if (index === -1) return null;
    const user = decoded.slice(0, index);
    const pass = decoded.slice(index + 1);
    return { user, pass };
  } catch {
    return null;
  }
}

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  if (pathname.startsWith('/_next') || pathname.startsWith('/favicon')) {
    return NextResponse.next();
  }

  const user = process.env.APP_AUTH_USER;
  const pass = process.env.APP_AUTH_PASS;
  if (!user || !pass) {
    return NextResponse.next();
  }

  const auth = request.headers.get('authorization');
  if (!auth) return unauthorized();
  const credentials = decodeBasicAuth(auth);
  if (!credentials) return unauthorized();
  if (credentials.user !== user || credentials.pass !== pass) return unauthorized();

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)']
};
