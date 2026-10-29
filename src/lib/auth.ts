import { create } from 'zustand';
import { lockOffline } from '../offline/device';
import { apiRequest, clearAccessToken, getAccessToken, getRefreshToken, setAccessToken, setRefreshToken, setUnauthorizedHandler } from './api';

export type TenantChoice = { id: string; name: string; role: string };
export type AuthUser = { displayName: string; email: string };
type AuthState = {
  accessToken: string | null;
  tenants: TenantChoice[];
  user: AuthUser | null;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setSession: (session: { accessToken: string; refreshToken: string; tenants?: TenantChoice[]; user?: AuthUser }) => Promise<void>;
  logout: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  tenants: [],
  user: null,
  hydrated: false,
  hydrate: async () => {
    let accessToken = await getAccessToken();
    const refreshToken = await getRefreshToken();
    if (refreshToken) {
      try {
        const session = await apiRequest<{ accessToken: string; refreshToken: string }>('/v1/auth/refresh', { method: 'POST', body: JSON.stringify({ refreshToken }) }, false);
        await Promise.all([setAccessToken(session.accessToken), setRefreshToken(session.refreshToken)]);
        accessToken = session.accessToken;
      } catch {
        if (!accessToken) await clearAccessToken();
      }
    }
    set({ accessToken, hydrated: true });
  },
  setSession: async ({ accessToken, refreshToken, tenants = [], user = undefined }) => {
    await Promise.all([setAccessToken(accessToken), setRefreshToken(refreshToken)]);
    set({ accessToken, tenants, user: user ?? null, hydrated: true });
  },
  logout: async () => {
    await lockOffline();
    try {
      await apiRequest('/v1/auth/logout', { method: 'POST' });
    } finally {
      await clearAccessToken();
      set({ accessToken: null, tenants: [], user: null });
    }
  },
}));

setUnauthorizedHandler(() => {
  useAuthStore.setState({ accessToken: null, tenants: [], user: null });
});
