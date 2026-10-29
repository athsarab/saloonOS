const memory = new Map<string, string | null>();

export const appearanceStorage = {
  async getItem(key: string): Promise<string | null> {
    if (typeof window === 'undefined') return null;
    if (memory.has(key)) return memory.get(key) ?? null;
    try {
      return window.localStorage.getItem(key);
    } catch (error) {
      console.warn('Unable to read SalonOS appearance preference.', error);
      return null;
    }
  },
  async setItem(key: string, value: string): Promise<void> {
    if (typeof window === 'undefined') return;
    memory.set(key, value);
    try {
      window.localStorage.setItem(key, value);
    } catch (error) {
      console.warn('Unable to persist SalonOS appearance preference.', error);
    }
  },
};
