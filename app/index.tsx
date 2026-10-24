import { router } from 'expo-router';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../src/components/ui';
import { Logo } from '../src/components/Logo';
import { useTheme } from '../src/theme/ThemeProvider';

export default function WelcomeScreen() {
  const { colors } = useTheme();
  return <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}><View style={styles.content}><Logo /><View style={styles.hero}><Text style={[styles.title, { color: colors.text }]}>Run your salon{'\n'}with calm confidence.</Text><Text style={[styles.copy, { color: colors.textMuted }]}>A thoughtful workspace for appointments, clients, services, and the people who make your business special.</Text></View><View style={styles.actions}><Button label="Sign in to SalonOS" onPress={() => router.push('/login')} /><Button label="Create your workspace" variant="secondary" onPress={() => router.push('/register')} /><Text style={[styles.note, { color: colors.textMuted }]}>Built for Sri Lankan beauty businesses</Text></View></View></SafeAreaView>;
}

const styles = StyleSheet.create({ safe: { flex: 1 }, content: { flex: 1, justifyContent: 'space-between', padding: 28, paddingTop: 24 }, hero: { gap: 18 }, title: { fontSize: 40, fontWeight: '800', letterSpacing: -1.3, lineHeight: 46 }, copy: { fontSize: 17, lineHeight: 26 }, actions: { gap: 12 }, note: { fontSize: 13, paddingTop: 6, textAlign: 'center' } });
