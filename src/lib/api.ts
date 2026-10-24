import * as SecureStore from 'expo-secure-store';
import { env } from '../config/env';

const accessTokenKey = 'salonos.access-token';

export class ApiError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = 'ApiError';
  }
}

async function getToken() {
  return SecureStore.getItemAsync(accessTokenKey);
}

export async function setAccessToken(token: string) {
  await SecureStore.setItemAsync(accessTokenKey, token);
}

export async function clearAccessToken() {
  await SecureStore.deleteItemAsync(accessTokenKey);
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getToken();
  const response = await fetch(`${env.apiUrl}${path}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw new ApiError(`Request failed with status ${response.status}`, response.status);
  }

  return response.json() as Promise<T>;
}
