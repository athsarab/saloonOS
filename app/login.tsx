import { Link, router } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppHeader } from '../src/components/AppHeader';
import { Button, Field, Screen } from '../src/components/ui';
import { Logo } from '../src/components/Logo';
import { ApiError, apiRequest } from '../src/lib/api';
import { env } from '../src/config/env';
import { useAuthStore } from '../src/lib/auth';
import { useTheme } from '../src/theme/ThemeProvider';

type FormValues = { email: string; password: string };
type LoginResponse = { accessToken: string; refreshToken: string; tenants: { id: string; name: string; role: string }[] };

export default function LoginScreen() {
  const { colors } = useTheme();
  const setSession = useAuthStore((state) => state.setSession);
  const { control, handleSubmit, setError, formState: { isSubmitting, errors } } = useForm<FormValues>({ defaultValues: { email: '', password: '' } });
  const submit = async (values: FormValues) => {
    let credentialsAccepted = false;
    try {
      const session = await apiRequest<LoginResponse>('/v1/auth/login', { method: 'POST', body: JSON.stringify({ ...values, email: values.email.trim() }) }, false);
      credentialsAccepted = true;
      await setSession(session);
      router.replace(session.tenants.length > 1 ? '/business-selection' : '/(app)');
    } catch (error) {
      const message = credentialsAccepted
        ? 'Your credentials were accepted, but this device could not save the session. Reload the app and try again.'
        : error instanceof ApiError
          ? error.status === 401 ? 'Invalid email or password' : error.status === 429 ? 'Too many sign-in attempts. Please wait a minute and try again.' : error.message
          : `Could not connect to ${env.apiUrl}. Check that your phone and computer are on the same Wi-Fi and the API is running.`;
      setError('root', { message });
    }
  };
  return <Screen><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled"><Logo /><AppHeader title="Welcome back" description="Sign in to continue to your workspace." /><View style={styles.form}><Controller control={control} name="email" rules={{ required: 'Email is required' }} render={({ field, fieldState }) => <Field label="Work email" autoCapitalize="none" autoCorrect={false} keyboardType="email-address" placeholder="you@salon.com" value={field.value} onChangeText={field.onChange} error={fieldState.error?.message} />} /><Controller control={control} name="password" rules={{ required: 'Password is required' }} render={({ field, fieldState }) => <Field label="Password" autoCapitalize="none" autoCorrect={false} secureTextEntry placeholder="Enter your password" value={field.value} onChangeText={field.onChange} error={fieldState.error?.message} />} /><Link href="/forgot-password" style={[styles.link, { color: colors.primary }]}>Forgot password?</Link>{errors.root ? <Text style={{ color: colors.danger }}>{errors.root.message}</Text> : null}<Button label="Sign in" loading={isSubmitting} onPress={() => void handleSubmit(submit)()} /><Text style={[styles.status, { color: colors.textMuted }]}>Your session is stored securely on this device.</Text></View><View style={styles.footer}><Text style={{ color: colors.textMuted }}>New to SalonOS?</Text><Link href="/register" style={[styles.link, { color: colors.primary }]}>Create an account</Link></View></ScrollView></KeyboardAvoidingView></Screen>;
}

const styles = StyleSheet.create({ flex: { flex: 1 }, content: { gap: 28, padding: 24, paddingTop: 20 }, form: { gap: 18 }, link: { fontSize: 14, fontWeight: '700' }, status: { fontSize: 12, lineHeight: 18, textAlign: 'center' }, footer: { alignItems: 'center', flexDirection: 'row', gap: 5, justifyContent: 'center' } });
