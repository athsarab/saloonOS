import { PropsWithChildren } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { elevation, iconSize, radius, spacing, touch, type } from '../theme/tokens';

type AppBottomSheetProps = PropsWithChildren<{
  visible: boolean;
  title: string;
  onClose: () => void;
  /** Prevents dismissal while a request is in flight. */
  locked?: boolean;
}>;

export function AppBottomSheet({ visible, title, onClose, children, locked = false }: AppBottomSheetProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const close = () => { if (!locked) onClose(); };
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.backdrop, { backgroundColor: colors.overlay }]}>
        <Pressable style={StyleSheet.absoluteFill} accessibilityLabel="Close panel" accessibilityRole="button" onPress={close} />
        <View accessibilityViewIsModal style={[styles.sheet, elevation.overlay, { backgroundColor: colors.surfaceRaised, marginTop: insets.top + spacing.xxl }]}>
          <View style={[styles.handle, { backgroundColor: colors.borderStrong }]} />
          <View style={styles.header}>
            <Text accessibilityRole="header" style={[type.heading, styles.title, { color: colors.text }]}>{title}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Close panel" accessibilityState={{ disabled: locked }} disabled={locked} onPress={onClose} style={[styles.close, locked && styles.disabled]}>
              <X size={iconSize.lg - 2} color={colors.textMuted} />
            </Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.lg }]}>
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, flexShrink: 1, paddingHorizontal: spacing.xl },
  handle: { alignSelf: 'center', borderRadius: 2, height: 4, marginTop: spacing.sm, width: 36 },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.xs },
  title: { flex: 1 },
  close: { alignItems: 'center', height: touch.min + 4, justifyContent: 'center', marginRight: -spacing.md, width: touch.min + 4 },
  disabled: { opacity: 0.4 },
  content: { gap: spacing.lg, paddingTop: spacing.sm },
});
