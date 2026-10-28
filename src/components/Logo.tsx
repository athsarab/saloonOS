import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { radius, spacing } from '../theme/tokens';

export function Logo() {
  const { colors } = useTheme();
  return (
    <View accessible accessibilityRole="image" accessibilityLabel="SalonOS" style={styles.row}>
      <View style={[styles.mark, { backgroundColor: colors.primary }]}><Text style={[styles.markText, { color: colors.onPrimary }]}>S</Text></View>
      <Text style={[styles.name, { color: colors.text }]}>SalonOS</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm + 2 },
  mark: { alignItems: 'center', borderRadius: radius.sm + 2, height: 34, justifyContent: 'center', width: 34 },
  markText: { fontSize: 19, fontWeight: '700' },
  name: { fontSize: 18, fontWeight: '700', letterSpacing: -0.2 },
});
