import { Image, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { radius, spacing } from '../theme/tokens';

export function Logo() {
  const { colors } = useTheme();
  return (
    <View accessible accessibilityRole="image" accessibilityLabel="SalonOS" style={styles.row}>
      <Image source={require('../../assets/logo 2.png')} style={styles.mark} />
      <Text style={[styles.name, { color: colors.text }]}>saloon<Text style={{ color: colors.primary }}>OS</Text></Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm + 2 },
  mark: { borderRadius: radius.sm + 2, height: 34, width: 34 },
  name: { fontSize: 18, fontWeight: '700', letterSpacing: -0.2 },
});
