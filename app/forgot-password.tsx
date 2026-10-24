import { Link } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from 'react-native';
import { AppHeader } from '../src/components/AppHeader';
import { Button, Field, Screen } from '../src/components/ui';
import { Logo } from '../src/components/Logo';
import { useTheme } from '../src/theme/ThemeProvider';

export default function ForgotPasswordScreen() {
  const { colors } = useTheme();
  const { control, handleSubmit } = useForm<{ email: string }>({ defaultValues: { email: '' } });
  return <Screen><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}><ScrollView contentContainerStyle={styles.content}><Logo /><AppHeader title="Reset your password" description="Enter your work email and we’ll send reset instructions when the account service is connected." /><Controller control={control} name="email" rules={{ required: 'Email is required' }} render={({ field, fieldState }) => <Field label="Work email" autoCapitalize="none" keyboardType="email-address" placeholder="you@salon.com" value={field.value} onChangeText={field.onChange} error={fieldState.error?.message} />} />  <Button label="Send reset link" onPress={() => void handleSubmit(() => undefined)()} /><Link href="/login" style={[styles.back, { color: colors.primary }]}>Back to sign in</Link><Text style={[styles.status, { color: colors.textMuted }]}>No request is sent until a real backend is configured.</Text></ScrollView></KeyboardAvoidingView></Screen>;
}

const styles = StyleSheet.create({ flex: { flex: 1 }, content: { gap: 28, padding: 24, paddingTop: 20 }, back: { fontSize: 14, fontWeight: '700', textAlign: 'center' }, status: { fontSize: 12, lineHeight: 18, textAlign: 'center' } });
