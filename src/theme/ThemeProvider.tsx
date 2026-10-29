import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { colors, ThemeColors } from './colors';
import { appearanceStorage } from './appearance-storage';

export type Appearance = 'light' | 'dark' | 'night';
const APPEARANCE_KEY = 'salonos-appearance';
type ThemeContextValue = { colors: ThemeColors; appearance: Appearance; setAppearance: (appearance: Appearance) => void; hydrated: boolean };
const ThemeContext = createContext<ThemeContextValue>({ colors: colors.light, appearance: 'light', setAppearance: () => {}, hydrated: false });

export function ThemeProvider({ children }: PropsWithChildren) {
  const [appearance, setAppearanceState] = useState<Appearance>('light');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let active = true;
    void appearanceStorage.getItem(APPEARANCE_KEY).then((stored) => {
      if (!active) return;
      if (stored === 'light' || stored === 'dark' || stored === 'night') setAppearanceState(stored);
      setHydrated(true);
    }).catch((error) => {
      console.warn('Unable to restore SalonOS appearance preference.', error);
      if (active) setHydrated(true);
    });
    return () => { active = false; };
  }, []);

  const setAppearance = useCallback((next: Appearance) => {
    setAppearanceState(next);
    void appearanceStorage.setItem(APPEARANCE_KEY, next).catch((error) => {
      console.warn('Unable to persist SalonOS appearance preference.', error);
    });
  }, []);

  const value = useMemo(() => ({ colors: colors[appearance], appearance, setAppearance, hydrated }), [appearance, hydrated, setAppearance]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
