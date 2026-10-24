// Keep browser credentials within this tab's session. Some browsers block storage,
// so retain changes in memory for the lifetime of the page as well.
const memory = new Map<string, string | null>();

export const tokenStorage = {
  async getItem(key: string): Promise<string | null> {
    if (typeof window === 'undefined') return null;
    if (memory.has(key)) return memory.get(key) ?? null;
    try {
      return window.sessionStorage.getItem(key);
    } catch {
      return null;
    }
  },
  async setItem(key: string, value: string): Promise<void> {
    if (typeof window === 'undefined') return;
    memory.set(key, value);
    try {
      window.sessionStorage.setItem(key, value);
    } catch {
      // The in-memory value remains available when browser storage is blocked.
    }
  },
  async removeItem(key: string): Promise<void> {
    if (typeof window === 'undefined') return;
    memory.set(key, null);
    try {
      window.sessionStorage.removeItem(key);
    } catch {
      // Keep the null entry so a removed token cannot be read again on this page.
    }
  },
};
