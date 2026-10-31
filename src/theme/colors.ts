export type ThemeColors = {
  background: string; backgroundSecondary: string; surface: string; surfaceRaised: string; surfaceMuted: string;
  text: string; textMuted: string; textSubtle: string;
  border: string; borderStrong: string; divider: string;
  primary: string; primarySoft: string; onPrimary: string; onDanger: string;
  success: string; successSoft: string; warning: string; warningSoft: string; onInfo: string;
  danger: string; dangerSoft: string; info: string; infoSoft: string;
  input: string; inputPlaceholder: string; navigation: string; navigationActive: string;
  dialog: string; disabled: string; focus: string; overlay: string;
  /** @deprecated Alias of `warning`, kept for screens that used it for pending/attention copy. */
  accent: string;
};

const light = {
  background: '#FBF9FF', backgroundSecondary: '#F5F1FF', surface: '#FFFFFF', surfaceRaised: '#FFFFFF', surfaceMuted: '#F5F1FF',
  text: '#11102E', textMuted: '#686584', textSubtle: '#9290AB',
  border: '#E8E4F2', borderStrong: '#D8D1EE', divider: '#E8E4F2',
  primary: '#5B2BC5', primarySoft: '#EEE8FF', onPrimary: '#FFFFFF', onDanger: '#FFFFFF',
  success: '#12805C', successSoft: '#E8F5EF', warning: '#B54708', warningSoft: '#FEF3E7', onInfo: '#FFFFFF',
  danger: '#C4321F', dangerSoft: '#FDECEA', info: '#1D5FD1', infoSoft: '#EAF1FD',
  input: '#FFFFFF', inputPlaceholder: '#9290AB', navigation: '#FFFFFF', navigationActive: '#EEE8FF',
  dialog: '#FFFFFF', disabled: '#B8B8B3', focus: '#5B2BC5',
  overlay: 'rgba(16,24,40,0.45)',
};

const dark = {
  background: '#111214', backgroundSecondary: '#18191C', surface: '#18191C', surfaceRaised: '#212226', surfaceMuted: '#212226',
  text: '#F2F3F5', textMuted: '#A0A6B1', textSubtle: '#6F7581',
  border: '#2C2E33', borderStrong: '#3B3E44', divider: '#2C2E33',
  primary: '#9B91F0', primarySoft: '#26233F', onPrimary: '#14112B', onDanger: '#FFFFFF',
  success: '#4CC38A', successSoft: '#15291F', warning: '#F5A65B', warningSoft: '#33230F', onInfo: '#FFFFFF',
  danger: '#F0786A', dangerSoft: '#3A1A17', info: '#76A6F5', infoSoft: '#162540',
  input: '#18191C', inputPlaceholder: '#6F7581', navigation: '#18191C', navigationActive: '#26233F',
  dialog: '#212226', disabled: '#5D626B', focus: '#9B91F0',
  overlay: 'rgba(0,0,0,0.6)',
};

const night = {
  ...dark,
  background: '#070809', backgroundSecondary: '#0D0F11', surface: '#101214', surfaceRaised: '#171A1D', surfaceMuted: '#171A1D',
  text: '#F5F5F2', textMuted: '#A7AAA6', textSubtle: '#686D6A',
  border: '#252927', borderStrong: '#343936', divider: '#252927',
  primary: '#A69BFF', primarySoft: '#211E3B', onPrimary: '#0D0B1C', onDanger: '#FFFFFF',
  input: '#101214', inputPlaceholder: '#686D6A', navigation: '#101214', navigationActive: '#211E3B',
  dialog: '#171A1D', disabled: '#505652', focus: '#A69BFF',
  overlay: 'rgba(0,0,0,0.72)',
};

export const colors: Record<'light' | 'dark' | 'night', ThemeColors> = {
  light: { ...light, accent: light.warning },
  dark: { ...dark, accent: dark.warning },
  night: { ...night, accent: night.warning },
};
