import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { AppButton } from './AppButton';
import { iconSize, radius, spacing, type } from '../theme/tokens';

const dateKey = (date: Date) => {
  const copy = new Date(date);
  copy.setHours(12, 0, 0, 0);
  return copy.toISOString().slice(0, 10);
};

const parseDate = (value: string) => {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
};

export function AppDatePicker({ visible, value, onClose, onChange }: { visible: boolean; value: string; onClose: () => void; onChange: (value: string) => void }) {
  const { colors } = useTheme();
  const [draft, setDraft] = useState(value);
  const date = parseDate(draft);
  const shiftDate = (days: number) => {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    setDraft(dateKey(next));
  };
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
    <View style={[styles.backdrop, { backgroundColor: colors.overlay }]}>
      <View style={[styles.modal, { backgroundColor: colors.surfaceRaised }]}>
        <View style={styles.header}>
          <View><Text style={[type.heading, { color: colors.text }]}>Choose date</Text><Text style={[type.caption, { color: colors.textMuted }]}>Select the report day</Text></View>
          <Pressable accessibilityRole="button" accessibilityLabel="Close date picker" onPress={onClose}><Text style={[type.heading, { color: colors.textMuted }]}>×</Text></Pressable>
        </View>
        <View style={styles.body}>
          <View style={styles.dateNav}>
            <Pressable accessibilityRole="button" accessibilityLabel="Previous day" onPress={() => shiftDate(-1)} style={styles.navButton}><ChevronLeft color={colors.text} size={iconSize.md} /></Pressable>
            <Text style={[type.bodyStrong, { color: colors.text }]}>{date.toLocaleDateString('en-LK', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Next day" onPress={() => shiftDate(1)} style={styles.navButton}><ChevronRight color={colors.text} size={iconSize.md} /></Pressable>
          </View>
          <Pressable onPress={() => setDraft(dateKey(new Date()))} style={[styles.today, { backgroundColor: colors.primarySoft }]}><Text style={[type.bodyStrong, { color: colors.primary }]}>Today</Text></Pressable>
        </View>
        <AppButton label="Use this date" onPress={() => { onChange(draft); onClose(); }} />
      </View>
    </View>
  </Modal>;
}

export function formatPickerDate(value: string) {
  return value || dateKey(new Date());
}

const styles = StyleSheet.create({
  backdrop: { alignItems: 'center', flex: 1, justifyContent: 'center', padding: spacing.xl },
  modal: { borderRadius: radius.xl, gap: spacing.lg, maxWidth: 420, padding: spacing.xl, width: '100%' },
  header: { alignItems: 'flex-start', flexDirection: 'row', justifyContent: 'space-between' },
  body: { alignItems: 'center', gap: spacing.lg },
  dateNav: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', width: '100%' },
  navButton: { alignItems: 'center', height: 44, justifyContent: 'center', width: 44 },
  today: { borderRadius: radius.pill, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
});
