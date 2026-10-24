import { createContext, PropsWithChildren, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { colors, ThemeColors } from './colors';

const ThemeContext = createContext<{ colors: ThemeColors; mode: 'light' | 'dark' }>({ colors: colors.light, mode: 'light' });

export function ThemeProvider({ children }: PropsWithChildren) {
  const mode: 'light' | 'dark' = useColorScheme() === 'dark' ? 'dark' : 'light';
  const value = useMemo(() => ({ colors: colors[mode], mode }), [mode]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
