import { Link } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppHeader } from '../src/components/AppHeader';
import { Button, Field, Screen } from '../src/components/ui';
import { Logo } from '../src/components/Logo';
import { useTheme } from '../src/theme/ThemeProvider';

type FormValues = { email: string; password: string };

export default function LoginScreen() {
  const { colors } = useTheme();
  const { control, handleSubmit } = useForm<FormValues>({ defaultValues: { email: '', password: '' } });
  return <Screen><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled"><Logo /><AppHeader title="Welcome back" description="Sign in to continue to your workspace." /><View style={styles.form}><Controller control={control} name="email" rules={{ required: 'Email is required' }} render={({ field, fieldState }) => <Field label="Work email" autoCapitalize="none" keyboardType="email-address" placeholder="you@salon.com" value={field.value} onChangeText={field.onChange} error={fieldState.error?.message} />} /><Controller control={control} name="password" rules={{ required: 'Password is required' }} render={({ field, fieldState }) => <Field label="Password" placeholder="Enter your password" secureTextEntry value={field.value} onChangeText={field.onChange} error={fieldState.error?.message} />} /><Link href="/forgot-password" style={[styles.link, { color: colors.primary }]}>Forgot password?</Link>  <Button label="Sign in" onPress={() => void handleSubmit(() => undefined)()} /><Text style={[styles.status, { color: colors.textMuted }]}>Authentication is not connected yet. Your details will not be submitted.</Text></View><View style={styles.footer}><Text style={{ color: colors.textMuted }}>New to SalonOS?</Text><Link href="/register" style={[styles.link, { color: colors.primary }]}>Create an account</Link></View></ScrollView></KeyboardAvoidingView></Screen>;
}

const styles = StyleSheet.create({ flex: { flex: 1 }, content: { gap: 28, padding: 24, paddingTop: 20 }, form: { gap: 18 }, link: { fontSize: 14, fontWeight: '700' }, status: { fontSize: 12, lineHeight: 18, textAlign: 'center' }, footer: { alignItems: 'center', flexDirection: 'row', gap: 5, justifyContent: 'center' } });
