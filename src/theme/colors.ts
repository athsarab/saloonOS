export type ThemeColors = {
  background: string; surface: string; surfaceMuted: string;
  text: string; textMuted: string; textSubtle: string;
  border: string; borderStrong: string;
  primary: string; primarySoft: string; onPrimary: string;
  success: string; successSoft: string; warning: string; warningSoft: string;
  danger: string; dangerSoft: string; info: string; infoSoft: string;
  overlay: string;
  /** @deprecated Alias of `warning`, kept for screens that used it for pending/attention copy. */
  accent: string;
};

const light = {
  background: '#FFFFFF', surface: '#FFFFFF', surfaceMuted: '#F7F8FA',
  text: '#202124', textMuted: '#667085', textSubtle: '#98A2B3',
  border: '#E6E8EC', borderStrong: '#D0D5DD',
  primary: '#6558D3', primarySoft: '#EFEDFB', onPrimary: '#FFFFFF',
  success: '#12805C', successSoft: '#E8F5EF', warning: '#B54708', warningSoft: '#FEF3E7',
  danger: '#C4321F', dangerSoft: '#FDECEA', info: '#1D5FD1', infoSoft: '#EAF1FD',
  overlay: 'rgba(16,24,40,0.45)',
};

const dark = {
  background: '#111214', surface: '#18191C', surfaceMuted: '#212226',
  text: '#F2F3F5', textMuted: '#A0A6B1', textSubtle: '#6F7581',
  border: '#2C2E33', borderStrong: '#3B3E44',
  primary: '#9B91F0', primarySoft: '#26233F', onPrimary: '#14112B',
  success: '#4CC38A', successSoft: '#15291F', warning: '#F5A65B', warningSoft: '#33230F',
  danger: '#F0786A', dangerSoft: '#3A1A17', info: '#76A6F5', infoSoft: '#162540',
  overlay: 'rgba(0,0,0,0.6)',
};

export const colors: Record<'light' | 'dark', ThemeColors> = {
  light: { ...light, accent: light.warning },
  dark: { ...dark, accent: dark.warning },
};
