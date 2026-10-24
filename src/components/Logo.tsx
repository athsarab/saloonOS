import { Text, View, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

export function Logo() {
  const { colors } = useTheme();
  return <View style={styles.row}><View style={[styles.mark, { backgroundColor: colors.primary }]}><Text style={styles.markText}>S</Text></View><Text style={[styles.name, { color: colors.text }]}>SalonOS</Text></View>;
}

const styles = StyleSheet.create({ row: { alignItems: 'center', flexDirection: 'row', gap: 10 }, mark: { alignItems: 'center', borderRadius: 10, height: 38, justifyContent: 'center', width: 38 }, markText: { color: '#fff', fontSize: 22, fontWeight: '800' }, name: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 } });
