import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AlertCircle, CheckCircle2, Info } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { elevation, iconSize, radius, spacing, type } from '../theme/tokens';

type ToastTone = 'success' | 'danger' | 'info';
type Toast = { id: number; message: string; tone: ToastTone };
type ToastApi = { show: (message: string, tone?: ToastTone) => void };

const ToastContext = createContext<ToastApi>({ show: () => {} });

export function ToastProvider({ children }: PropsWithChildren) {
  const [toast, setToast] = useState<Toast | null>(null);
  const counter = useRef(0);
  const show = useCallback((message: string, tone: ToastTone = 'success') => {
    counter.current += 1;
    setToast({ id: counter.current, message, tone });
  }, []);
  const hide = useCallback(() => setToast(null), []);
  const api = useMemo(() => ({ show }), [show]);
  return (
    <ToastContext.Provider value={api}>
      {children}
      {toast ? <AppToast key={toast.id} toast={toast} onHide={hide} /> : null}
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

function AppToast({ toast, onHide }: { toast: Toast; onHide: () => void }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [opacity] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const animation = Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.delay(toast.tone === 'danger' ? 4200 : 2600),
      Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]);
    animation.start(({ finished }) => { if (finished) onHide(); });
    return () => animation.stop();
  }, [opacity, onHide, toast.tone]);

  const Icon = toast.tone === 'success' ? CheckCircle2 : toast.tone === 'danger' ? AlertCircle : Info;
  const iconColor = toast.tone === 'success' ? colors.success : toast.tone === 'danger' ? colors.danger : colors.info;
  return (
    <Animated.View
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      pointerEvents="none"
      style={[styles.toast, elevation.overlay, { backgroundColor: colors.text, bottom: insets.bottom + 88, opacity }]}
    >
      <Icon color={iconColor} size={iconSize.md} />
      <Text style={[type.label, styles.message, { color: colors.background }]}>{toast.message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: { alignItems: 'center', alignSelf: 'center', borderRadius: radius.md, flexDirection: 'row', gap: spacing.sm, left: spacing.lg, maxWidth: 480, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, position: 'absolute', right: spacing.lg },
  message: { flex: 1 },
});
