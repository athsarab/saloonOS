import { useRef } from 'react';
import { router } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { Text, TextInputInstance } from 'react-native';
import { AppButton } from '../src/components/AppButton';
import { AppInlineError } from '../src/components/AppStates';
import { AppTextField } from '../src/components/AppTextField';
import { AuthLayout } from '../src/components/AuthLayout';
import { TextLink } from '../src/components/TextLink';
import { apiRequest } from '../src/lib/api';
import { useAuthStore } from '../src/lib/auth';
import { emailPattern, friendlyError } from '../src/lib/errors';
import { feedback } from '../src/lib/feedback';
import { useTheme } from '../src/theme/ThemeProvider';
import { type } from '../src/theme/tokens';

type FormValues = { email: string; password: string };
type LoginResponse = { accessToken: string; refreshToken: string; tenants: { id: string; name: string; role: string }[] };

export default function LoginScreen() {
  const { colors } = useTheme();
  const setSession = useAuthStore((state) => state.setSession);
  const passwordRef = useRef<TextInputInstance>(null);
  const { control, handleSubmit, setError, getValues, formState: { isSubmitting, errors } } = useForm<FormValues>({ defaultValues: { email: '', password: '' }, mode: 'onTouched' });

  const submit = async (values: FormValues) => {
    let credentialsAccepted = false;
    try {
      const session = await apiRequest<LoginResponse>('/v1/auth/login', { method: 'POST', body: JSON.stringify({ ...values, email: values.email.trim() }) }, false);
      credentialsAccepted = true;
      await setSession(session);
      router.replace(session.tenants.length > 1 ? '/business-selection' : '/(app)');
    } catch (error) {
      setError('root', {
        message: credentialsAccepted
          ? feedback.auth.sessionSaveFailed
          // The API returns the same 401 for a wrong password and an unverified email, by design.
          : friendlyError(error, { fallback: feedback.auth.signInFailed, byStatus: { 401: feedback.auth.signInFailed } }),
      });
    }
  };
  const onSubmit = () => { if (!isSubmitting) void handleSubmit(submit)(); };

  return (
    <AuthLayout
      title="Sign in"
      description="Welcome back. Sign in to your SalonOS business."
      footer={<><Text style={[type.label, { color: colors.textMuted }]}>New to SalonOS?</Text><TextLink label="Create an account" onPress={() => router.push('/register')} /></>}
    >
      <Controller control={control} name="email" rules={{ validate: (value) => !value.trim() ? 'Enter your email address' : emailPattern.test(value.trim()) || 'Enter a valid email address' }} render={({ field }) => (
        <AppTextField
          label="Email"
          required
          placeholder="you@yoursalon.lk"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="username"
          keyboardType="email-address"
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => passwordRef.current?.focus()}
          editable={!isSubmitting}
          value={field.value}
          onChangeText={field.onChange}
          onBlur={field.onBlur}
          error={errors.email?.message}
        />
      )} />
      <Controller control={control} name="password" rules={{ required: 'Enter your password' }} render={({ field }) => (
        <AppTextField
          ref={passwordRef}
          label="Password"
          required
          placeholder="Your password"
          secureToggle
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="current-password"
          textContentType="password"
          returnKeyType="go"
          onSubmitEditing={onSubmit}
          editable={!isSubmitting}
          value={field.value}
          onChangeText={field.onChange}
          onBlur={field.onBlur}
          error={errors.password?.message}
        />
      )} />
      <TextLink label="Forgot password?" align="right" onPress={() => router.push('/forgot-password')} />
      <AppInlineError message={errors.root?.message} />
      <AppButton label="Sign in" variant="auth" loading={isSubmitting} onPress={onSubmit} />
      <TextLink label="Verify your email" align="center" onPress={() => router.push({ pathname: '/verify-email', params: { email: getValues('email').trim() } })} />
    </AuthLayout>
  );
}
