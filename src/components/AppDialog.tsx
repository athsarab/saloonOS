import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { elevation, radius, spacing, type } from '../theme/tokens';
import { AppButton } from './AppButton';

type AppDialogProps = {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: 'default' | 'danger';
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function AppDialog({ visible, title, message, confirmLabel, cancelLabel = 'Cancel', tone = 'default', loading, onConfirm, onCancel }: AppDialogProps) {
  const { colors } = useTheme();
  const cancel = () => { if (!loading) onCancel(); };
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={cancel}>
      <View style={[styles.backdrop, { backgroundColor: colors.overlay }]}>
        <Pressable style={StyleSheet.absoluteFill} accessibilityLabel={cancelLabel} accessibilityRole="button" onPress={cancel} />
        <View accessibilityViewIsModal style={[styles.dialog, elevation.overlay, { backgroundColor: colors.surface }]}>
          <Text accessibilityRole="header" style={[type.heading, { color: colors.text }]}>{title}</Text>
          {message ? <Text style={[type.body, { color: colors.textMuted }]}>{message}</Text> : null}
          <View style={styles.actions}>
            <AppButton label={cancelLabel} variant="secondary" fullWidth={false} style={styles.action} disabled={loading} onPress={cancel} />
            <AppButton label={confirmLabel} variant={tone === 'danger' ? 'danger' : 'primary'} fullWidth={false} style={styles.action} loading={loading} onPress={onConfirm} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { alignItems: 'center', flex: 1, justifyContent: 'center', padding: spacing.xxl },
  dialog: { borderRadius: radius.xl, gap: spacing.md, maxWidth: 420, padding: spacing.xxl, width: '100%' },
  actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
  action: { flex: 1 },
});
