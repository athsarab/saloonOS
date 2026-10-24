import { Link } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from 'react-native';
import { AppHeader } from '../src/components/AppHeader';
import { Button, Field, Screen } from '../src/components/ui';
import { Logo } from '../src/components/Logo';
import { apiRequest } from '../src/lib/api';
import { useTheme } from '../src/theme/ThemeProvider';

export default function ForgotPasswordScreen() {
  const { colors } = useTheme();
  const { control, handleSubmit, setError, formState: { isSubmitting, isSubmitSuccessful } } = useForm<{ email: string }>({ defaultValues: { email: '' } });
  const submit = async (values: { email: string }) => {
    try { await apiRequest('/v1/auth/forgot-password', { method: 'POST', body: JSON.stringify(values) }); } catch { setError('root', { message: 'Unable to process that request.' }); }
  };
  return <Screen><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}><ScrollView contentContainerStyle={styles.content}><Logo /><AppHeader title="Reset your password" description="Enter your work email and we’ll send reset instructions." /><Controller control={control} name="email" rules={{ required: 'Email is required' }} render={({ field, fieldState }) => <Field label="Work email" autoCapitalize="none" keyboardType="email-address" placeholder="you@salon.com" value={field.value} onChangeText={field.onChange} error={fieldState.error?.message} />} /><Button label="Send reset link" loading={isSubmitting} onPress={() => void handleSubmit(submit)()} />{isSubmitSuccessful ? <Text style={{ color: colors.primary }}>If an account exists, reset instructions have been sent.</Text> : null}<Link href="/login" style={[styles.back, { color: colors.primary }]}>Back to sign in</Link></ScrollView></KeyboardAvoidingView></Screen>;
}

const styles = StyleSheet.create({ flex: { flex: 1 }, content: { gap: 28, padding: 24, paddingTop: 20 }, back: { fontSize: 14, fontWeight: '700', textAlign: 'center' } });
