import { router } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { Text } from 'react-native';
import { MailCheck } from 'lucide-react-native';
import { AppButton } from '../src/components/AppButton';
import { AppCard } from '../src/components/AppCard';
import { AppInlineError } from '../src/components/AppStates';
import { AppTextField } from '../src/components/AppTextField';
import { AuthLayout } from '../src/components/AuthLayout';
import { apiRequest } from '../src/lib/api';
import { emailPattern, friendlyError } from '../src/lib/errors';
import { feedback } from '../src/lib/feedback';
import { useTheme } from '../src/theme/ThemeProvider';
import { iconSize, type } from '../src/theme/tokens';

export default function ForgotPasswordScreen() {
  const { colors } = useTheme();
  const { control, handleSubmit, setError, getValues, reset, formState: { isSubmitting, isSubmitSuccessful, errors } } = useForm<{ email: string }>({ defaultValues: { email: '' }, mode: 'onTouched' });
  const back = () => (router.canGoBack() ? router.back() : router.replace('/login'));

  const submit = async (values: { email: string }) => {
    try {
      await apiRequest('/v1/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email: values.email.trim() }) });
    } catch (error) {
      setError('root', { message: friendlyError(error, { fallback: feedback.auth.resetEmailFailed }) });
      throw error; // keeps isSubmitSuccessful false
    }
  };
  const onSubmit = () => { if (!isSubmitting) void handleSubmit(submit)().catch(() => {}); };

  if (isSubmitSuccessful) {
    return (
      <AuthLayout title="Check your email" onBack={back}>
        <AppCard muted>
          <MailCheck color={colors.primary} size={iconSize.lg} />
          <Text style={[type.body, { color: colors.text }]}>If an account exists for <Text style={type.bodyStrong}>{getValues('email').trim()}</Text>, we’ve sent a link to reset your password.</Text>
          <Text style={[type.caption, { color: colors.textMuted }]}>Open the link on this phone, or paste the reset code from the email into the app. It expires in 30 minutes. Check your spam folder if it hasn’t arrived.</Text>
        </AppCard>
        <AppButton label="Back to sign in" onPress={() => router.replace('/login')} />
        <AppButton label="I have a reset code" variant="secondary" onPress={() => router.push('/reset-password')} />
        <AppButton label="Use a different email" variant="ghost" onPress={() => reset({ email: getValues('email') })} />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Reset your password" description="Enter the email you sign in with and we’ll send you a reset link." onBack={back}>
      <Controller control={control} name="email" rules={{ validate: (value) => !value.trim() ? 'Enter your email address' : emailPattern.test(value.trim()) || 'Enter a valid email address' }} render={({ field }) => (
        <AppTextField label="Email" required placeholder="you@yoursalon.lk" autoCapitalize="none" autoCorrect={false} autoComplete="email" textContentType="emailAddress" keyboardType="email-address" returnKeyType="send" onSubmitEditing={onSubmit} editable={!isSubmitting} value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={errors.email?.message} />
      )} />
      <AppInlineError message={errors.root?.message} />
      <AppButton label="Send reset link" variant="primary" loading={isSubmitting} onPress={onSubmit} />
    </AuthLayout>
  );
}
