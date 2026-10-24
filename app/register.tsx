import { Link, router } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppHeader } from '../src/components/AppHeader';
import { Button, Field, Screen } from '../src/components/ui';
import { Logo } from '../src/components/Logo';
import { apiRequest } from '../src/lib/api';
import { useTheme } from '../src/theme/ThemeProvider';

type FormValues = { name: string; business: string; email: string; password: string };

export default function RegisterScreen() {
  const { colors } = useTheme();
  const { control, handleSubmit, setError, formState: { isSubmitting, errors } } = useForm<FormValues>({ defaultValues: { name: '', business: '', email: '', password: '' } });
  const submit = async (values: FormValues) => {
    try {
      await apiRequest('/v1/auth/register', { method: 'POST', body: JSON.stringify({ displayName: values.name, businessName: values.business, email: values.email, password: values.password }) });
      router.replace({ pathname: '/verify-email', params: { email: values.email } });
    } catch {
      setError('root', { message: 'Unable to create the account with those details.' });
    }
  };
  return <Screen><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled"><Logo /><AppHeader title="Create your workspace" description="Set up the foundation for a calmer front desk." /><View style={styles.form}><Controller control={control} name="name" rules={{ required: 'Your name is required' }} render={({ field, fieldState }) => <Field label="Your name" placeholder="e.g. Amaya Perera" value={field.value} onChangeText={field.onChange} error={fieldState.error?.message} />} /><Controller control={control} name="business" rules={{ required: 'Business name is required' }} render={({ field, fieldState }) => <Field label="Business name" placeholder="e.g. The Green Room" value={field.value} onChangeText={field.onChange} error={fieldState.error?.message} />} /><Controller control={control} name="email" rules={{ required: 'Email is required' }} render={({ field, fieldState }) => <Field label="Work email" autoCapitalize="none" keyboardType="email-address" placeholder="you@salon.com" value={field.value} onChangeText={field.onChange} error={fieldState.error?.message} />} /><Controller control={control} name="password" rules={{ required: 'Password is required', minLength: { value: 8, message: 'Use at least 8 characters' } }} render={({ field, fieldState }) => <Field label="Password" secureTextEntry placeholder="At least 8 characters" value={field.value} onChangeText={field.onChange} error={fieldState.error?.message} />} />{errors.root ? <Text style={{ color: colors.danger }}>{errors.root.message}</Text> : null}<Button label="Create workspace" loading={isSubmitting} onPress={() => void handleSubmit(submit)()} /><Text style={[styles.status, { color: colors.textMuted }]}>We’ll send a verification link before signing you in.</Text></View><View style={styles.footer}><Text style={{ color: colors.textMuted }}>Already have an account?</Text><Link href="/login" style={[styles.link, { color: colors.primary }]}>Sign in</Link></View></ScrollView></KeyboardAvoidingView></Screen>;
}

const styles = StyleSheet.create({ flex: { flex: 1 }, content: { gap: 25, padding: 24, paddingTop: 20 }, form: { gap: 16 }, link: { fontSize: 14, fontWeight: '700' }, status: { fontSize: 12, lineHeight: 18, textAlign: 'center' }, footer: { alignItems: 'center', flexDirection: 'row', gap: 5, justifyContent: 'center' } });
