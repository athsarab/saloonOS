import { Platform, TextStyle } from 'react-native';

export const spacing = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 } as const;

export const radius = { sm: 8, md: 12, lg: 16, xl: 20, pill: 999 } as const;

export const iconSize = { sm: 16, md: 20, lg: 24 } as const;

export const touch = { min: 44 } as const;

export const control = { button: 48, buttonSm: 40, input: 48, tab: 56 } as const;

export const layout = { screenGutter: spacing.lg, sectionGap: spacing.xxl, cardGap: spacing.md, divider: 1 } as const;

const text = (fontSize: number, lineHeight: number, fontWeight: TextStyle['fontWeight']): TextStyle => ({ fontSize, lineHeight, fontWeight });

export const type = {
  display: { ...text(28, 34, '700'), letterSpacing: -0.4 },
  title: { ...text(22, 28, '700'), letterSpacing: -0.2 },
  heading: text(17, 24, '600'),
  body: text(15, 22, '400'),
  bodyStrong: text(15, 22, '600'),
  label: text(14, 20, '500'),
  caption: text(13, 18, '400'),
  micro: text(12, 16, '600'),
  metric: { ...text(24, 30, '700'), fontVariant: ['tabular-nums'] },
} satisfies Record<string, TextStyle>;

// Only floating layers (sheets, dialogs, toasts) are elevated.
export const elevation = {
  overlay: Platform.select({
    android: { elevation: 8 },
    default: { shadowColor: '#101828', shadowOpacity: 0.12, shadowRadius: 16, shadowOffset: { width: 0, height: 6 } },
  }),
} as const;
