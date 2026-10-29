import { useRef } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { Text, TextInputInstance } from 'react-native';
import { CheckCircle2 } from 'lucide-react-native';
import { AppButton } from '../src/components/AppButton';
import { AppCard } from '../src/components/AppCard';
import { AppInlineError } from '../src/components/AppStates';
import { AppTextField } from '../src/components/AppTextField';
import { AuthLayout } from '../src/components/AuthLayout';
import { apiRequest } from '../src/lib/api';
import { friendlyError } from '../src/lib/errors';
import { feedback } from '../src/lib/feedback';
import { useTheme } from '../src/theme/ThemeProvider';
import { iconSize, type } from '../src/theme/tokens';

type FormValues = { token: string; password: string; confirm: string };

export default function ResetPasswordScreen() {
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ token?: string }>();
  const fromLink = !!params.token;
  const passwordRef = useRef<TextInputInstance>(null), confirmRef = useRef<TextInputInstance>(null);
  const { control, handleSubmit, setError, formState: { isSubmitting, isSubmitSuccessful, errors } } = useForm<FormValues>({ defaultValues: { token: params.token ?? '', password: '', confirm: '' }, mode: 'onTouched' });

  const submit = async ({ token, password }: FormValues) => {
    try {
      await apiRequest('/v1/auth/reset-password', { method: 'POST', body: JSON.stringify({ token: token.trim(), password }) }, false);
    } catch (error) {
      setError('root', {
        message: friendlyError(error, {
          fallback: feedback.auth.resetFailed,
          byStatus: { 400: 'This reset code is invalid. Check that you pasted the whole code.', 401: feedback.auth.resetExpired },
        }),
      });
      throw error;
    }
  };
  const onSubmit = () => { if (!isSubmitting) void handleSubmit(submit)().catch(() => {}); };

  if (isSubmitSuccessful) {
    return (
      <AuthLayout title="Password updated">
        <AppCard muted>
          <CheckCircle2 color={colors.success} size={iconSize.lg} />
          <Text style={[type.body, { color: colors.text }]}>Your password has been changed. Sign in with your new password.</Text>
        </AppCard>
        <AppButton label="Go to sign in" onPress={() => router.replace('/login')} />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Choose a new password"
      description={fromLink ? 'Your reset link is ready. Choose a password with at least 8 characters.' : 'Paste the reset code from your email, then choose a new password.'}
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/login'))}
    >
      {fromLink ? null : (
        <Controller control={control} name="token" rules={{ validate: (value) => value.trim().length >= 20 || 'Paste the full reset code from the email' }} render={({ field }) => (
          <AppTextField label="Reset code" required placeholder="Paste the code from the email" autoCapitalize="none" autoCorrect={false} autoComplete="off" returnKeyType="next" submitBehavior="submit" onSubmitEditing={() => passwordRef.current?.focus()} editable={!isSubmitting} value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={errors.token?.message} />
        )} />
      )}
      <Controller control={control} name="password" rules={{ required: 'Enter a new password', minLength: { value: 8, message: 'Use at least 8 characters' } }} render={({ field }) => (
        <AppTextField ref={passwordRef} label="New password" required hint="Use at least 8 characters." placeholder="At least 8 characters" secureToggle autoCapitalize="none" autoCorrect={false} autoComplete="new-password" textContentType="newPassword" returnKeyType="next" submitBehavior="submit" onSubmitEditing={() => confirmRef.current?.focus()} editable={!isSubmitting} value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={errors.password?.message} />
      )} />
      <Controller control={control} name="confirm" rules={{ validate: (value, form) => value === form.password || 'Passwords don’t match' }} render={({ field }) => (
        <AppTextField ref={confirmRef} label="Confirm new password" required placeholder="Re-enter the new password" secureToggle autoCapitalize="none" autoCorrect={false} autoComplete="new-password" textContentType="newPassword" returnKeyType="go" onSubmitEditing={onSubmit} editable={!isSubmitting} value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={errors.confirm?.message} />
      )} />
      <AppInlineError message={errors.root?.message} />
      <AppButton label="Update password" variant="auth" loading={isSubmitting} onPress={onSubmit} />
      {errors.root ? <AppButton label="Request a new reset link" variant="ghost" onPress={() => router.replace('/forgot-password')} /> : null}
    </AuthLayout>
  );
}
