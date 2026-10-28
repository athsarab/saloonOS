import { env } from '../config/env';
import { tokenStorage } from './token-storage';

const accessTokenKey = 'salonos.access-token';
const refreshTokenKey = 'salonos.refresh-token';
let unauthorizedHandler: (() => void) | undefined;

export function setUnauthorizedHandler(handler: () => void) {
  unauthorizedHandler = handler;
}

export class ApiError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function setAccessToken(token: string) {
  await tokenStorage.setItem(accessTokenKey, token);
}

export async function setRefreshToken(token: string) {
  await tokenStorage.setItem(refreshTokenKey, token);
}

export async function getAccessToken() {
  return tokenStorage.getItem(accessTokenKey);
}

export async function getRefreshToken() {
  return tokenStorage.getItem(refreshTokenKey);
}

export async function clearAccessToken() {
  await Promise.all([tokenStorage.removeItem(accessTokenKey), tokenStorage.removeItem(refreshTokenKey)]);
}

async function request(path: string, options: RequestInit, token: string | null) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try { return await fetch(`${env.apiUrl}${path}`, {
    ...options,
    signal: options.signal ?? controller.signal,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  }); } finally { clearTimeout(timeout); }
}

export async function apiRequest<T>(path: string, options: RequestInit = {}, allowRefresh = true): Promise<T> {
  let response = await request(path, options, await getAccessToken());
  if (response.status === 401 && allowRefresh && path !== '/v1/auth/refresh') {
    const refreshToken = await getRefreshToken();
    if (refreshToken) {
      const refreshResponse = await request('/v1/auth/refresh', { method: 'POST', body: JSON.stringify({ refreshToken }) }, null);
      if (refreshResponse.ok) {
        const refreshed = (await refreshResponse.json()) as { accessToken: string; refreshToken: string };
        await Promise.all([setAccessToken(refreshed.accessToken), setRefreshToken(refreshed.refreshToken)]);
        response = await request(path, options, refreshed.accessToken);
      } else {
        await clearAccessToken();
      }
    }
  }
  if (!response.ok) {
    if (response.status === 401) {
      await clearAccessToken();
      unauthorizedHandler?.();
    }
    let message = response.status >= 500 ? 'The server could not complete this request. Please retry.' : `Request failed with status ${response.status}`;
    try {
      const body = await response.json() as { message?: unknown };
      if (response.status < 500 && typeof body.message === 'string') message = body.message;
      if (response.status < 500 && Array.isArray(body.message)) message = body.message.join('. ');
    } catch { /* A proxy may return an empty or non-JSON error response. */ }
    throw new ApiError(message, response.status);
  }
  return response.json() as Promise<T>;
}
