import { NextRequest, NextResponse } from 'next/server';
import { apiBase } from '../../../../src/server-api';
export const runtime = 'nodejs';
async function proxy(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const route = path.join('/');
  const auth = ['auth/login', 'auth/refresh', 'auth/logout', 'auth/select-tenant'].includes(route);
  if ((!auth && !['checkout', 'pos'].includes(path[0])) || path.some(s => !/^[a-zA-Z0-9_-]+$/.test(s))) return NextResponse.json({ message: 'Unknown endpoint' }, { status: 404 });
  if (req.method !== 'GET' && req.headers.get('origin') !== req.nextUrl.origin) return NextResponse.json({ message: 'Invalid request origin' }, { status: 403 });
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const access = req.cookies.get('salonos_access')?.value;
  if (access) headers.Authorization = 'Bearer ' + access;
  const key = req.headers.get('idempotency-key');
  if (key) headers['idempotency-key'] = key;
  let body = req.method === 'GET' ? undefined : await req.text();
  if (route === 'auth/refresh') body = JSON.stringify({ refreshToken: req.cookies.get('salonos_refresh')?.value ?? '' });
  try {
    const upstream = await fetch(apiBase() + '/' + path.map(encodeURIComponent).join('/') + req.nextUrl.search, { method: req.method, headers, body, cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(30000) });
    const raw = await upstream.text();
    const data = raw ? JSON.parse(raw) : null;
    const { accessToken, refreshToken, ...safe } = data ?? {};
    const response = NextResponse.json(data === null ? null : Array.isArray(data) ? data : safe, { status: upstream.status, headers: { 'Cache-Control': 'no-store' } });
    const options = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/' };
    if (upstream.ok && accessToken) response.cookies.set('salonos_access', accessToken, { ...options, maxAge: 86400 });
    if (upstream.ok && refreshToken) response.cookies.set('salonos_refresh', refreshToken, { ...options, maxAge: 30 * 86400 });
    if ((route === 'auth/logout' && upstream.ok) || (route === 'auth/refresh' && upstream.status === 401)) {
      response.cookies.delete('salonos_access'); response.cookies.delete('salonos_refresh');
    }
    return response;
  } catch {
    return NextResponse.json({ message: 'The API is unavailable. Check the backend connection. If a payment was submitted, retry the same request.' }, { status: 503 });
  }
}
export const GET = proxy;
export const POST = proxy;
