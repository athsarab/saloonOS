import { Link } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppHeader } from '../src/components/AppHeader';
import { Button, Field, Screen } from '../src/components/ui';
import { Logo } from '../src/components/Logo';
import { useTheme } from '../src/theme/ThemeProvider';

type FormValues = { name: string; business: string; email: string; password: string };

export default function RegisterScreen() {
  const { colors } = useTheme();
  const { control, handleSubmit } = useForm<FormValues>({ defaultValues: { name: '', business: '', email: '', password: '' } });
  return <Screen><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled"><Logo /><AppHeader title="Create your workspace" description="Set up the foundation for a calmer front desk." /><View style={styles.form}><Controller control={control} name="name" rules={{ required: 'Your name is required' }} render={({ field, fieldState }) => <Field label="Your name" placeholder="e.g. Amaya Perera" value={field.value} onChangeText={field.onChange} error={fieldState.error?.message} />} /><Controller control={control} name="business" rules={{ required: 'Business name is required' }} render={({ field, fieldState }) => <Field label="Business name" placeholder="e.g. The Green Room" value={field.value} onChangeText={field.onChange} error={fieldState.error?.message} />} /><Controller control={control} name="email" rules={{ required: 'Email is required' }} render={({ field, fieldState }) => <Field label="Work email" autoCapitalize="none" keyboardType="email-address" placeholder="you@salon.com" value={field.value} onChangeText={field.onChange} error={fieldState.error?.message} />} /><Controller control={control} name="password" rules={{ required: 'Password is required', minLength: { value: 8, message: 'Use at least 8 characters' } }} render={({ field, fieldState }) => <Field label="Password" secureTextEntry placeholder="At least 8 characters" value={field.value} onChangeText={field.onChange} error={fieldState.error?.message} />} />  <Button label="Create workspace" onPress={() => void handleSubmit(() => undefined)()} /><Text style={[styles.status, { color: colors.textMuted }]}>Workspace creation will be enabled when the SalonOS API is connected.</Text></View><View style={styles.footer}><Text style={{ color: colors.textMuted }}>Already have an account?</Text><Link href="/login" style={[styles.link, { color: colors.primary }]}>Sign in</Link></View></ScrollView></KeyboardAvoidingView></Screen>;
}

const styles = StyleSheet.create({ flex: { flex: 1 }, content: { gap: 25, padding: 24, paddingTop: 20 }, form: { gap: 16 }, link: { fontSize: 14, fontWeight: '700' }, status: { fontSize: 12, lineHeight: 18, textAlign: 'center' }, footer: { alignItems: 'center', flexDirection: 'row', gap: 5, justifyContent: 'center' } });
