export type ThemeColors = {
  background: string; surface: string; surfaceMuted: string; text: string; textMuted: string;
  border: string; primary: string; primarySoft: string; accent: string; danger: string;
};

export const colors: Record<'light' | 'dark', ThemeColors> = {
  light: { background: '#F7F8FA', surface: '#FFFFFF', surfaceMuted: '#F0F2F4', text: '#16211D', textMuted: '#68736E', border: '#E2E7E4', primary: '#1C6B52', primarySoft: '#E2F1EB', accent: '#C98B4B', danger: '#B84F4F' },
  dark: { background: '#111715', surface: '#19211E', surfaceMuted: '#232D29', text: '#F4F7F5', textMuted: '#A4B0AA', border: '#2D3934', primary: '#7BC9A7', primarySoft: '#203A30', accent: '#E0A15F', danger: '#F08080' },
};
