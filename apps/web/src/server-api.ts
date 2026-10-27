import 'server-only';
import { cookies } from 'next/headers';
export const apiBase = () => (process.env.API_URL ?? 'http://127.0.0.1:3000').replace(/\/$/, '') + '/v1';
export async function serverGet(path: string) {
  const token = (await cookies()).get('salonos_access')?.value;
  if (!token) return null;
  const response = await fetch(apiBase() + path, { headers: { Authorization: 'Bearer ' + token }, cache: 'no-store', signal: AbortSignal.timeout(15000) });
  if (!response.ok) return null;
  return response.json();
}
