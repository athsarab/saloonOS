import { PropsWithChildren, ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { AppButton, AppButtonProps } from './AppButton';
import { AppSectionHeader } from './AppSectionHeader';
import { AppEmptyState, AppLoadingState } from './AppStates';

// Compatibility layer for screens not yet migrated to the App* components.
// New code should import the App* components directly (see docs/design-system.md).
export { AppCard as Card } from './AppCard';
export { AppTextField as Field } from './AppTextField';

export function Screen({ children }: PropsWithChildren) {
  const { colors } = useTheme();
  return <View style={[styles.screen, { backgroundColor: colors.background }]}>{children}</View>;
}

export function Button(props: Omit<AppButtonProps, 'variant'> & { variant?: 'primary' | 'secondary' | 'ghost' }) {
  return <AppButton {...props} />;
}

export function SectionTitle({ title, action }: { title: string; action?: ReactNode }) {
  return <AppSectionHeader title={title} action={action} />;
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return <AppEmptyState title={title} description={description} />;
}

export function LoadingState({ label }: { label?: string }) {
  return <AppLoadingState label={label} />;
}

const styles = StyleSheet.create({ screen: { flex: 1 } });
