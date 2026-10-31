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
import { emailPattern, friendlyError } from '../src/lib/errors';
import { useTheme } from '../src/theme/ThemeProvider';
import { type } from '../src/theme/tokens';

type FormValues = { name: string; business: string; email: string; password: string; confirm: string };

export default function RegisterScreen() {
  const { colors } = useTheme();
  const businessRef = useRef<TextInputInstance>(null), emailRef = useRef<TextInputInstance>(null), passwordRef = useRef<TextInputInstance>(null), confirmRef = useRef<TextInputInstance>(null);
  const { control, handleSubmit, setError, formState: { isSubmitting, errors } } = useForm<FormValues>({ defaultValues: { name: '', business: '', email: '', password: '', confirm: '' }, mode: 'onTouched' });

  const submit = async (values: FormValues) => {
    const email = values.email.trim();
    try {
      await apiRequest('/v1/auth/register', { method: 'POST', body: JSON.stringify({ displayName: values.name.trim(), businessName: values.business.trim(), email, password: values.password }) });
      router.replace({ pathname: '/verify-email', params: { email } });
    } catch (error) {
      setError('root', {
        message: friendlyError(error, {
          fallback: 'We couldn’t create the account. Please check your details and try again.',
          byStatus: { 503: 'Your account may have been created, but the verification email couldn’t be sent. Use “Verify your email” to request a new code.' },
        }),
      });
    }
  };
  const onSubmit = () => { if (!isSubmitting) void handleSubmit(submit)(); };
  const minLength = (label: string) => (value: string) => value.trim().length >= 2 || `${label} must be at least 2 characters`;

  return (
    <AuthLayout
      title="Create your account"
      description="Set up your business. You’ll be the owner and can invite your team later."
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      footer={<><Text style={[type.label, { color: colors.textMuted }]}>Already have an account?</Text><TextLink label="Sign in" onPress={() => router.replace('/login')} /></>}
    >
      <Controller control={control} name="name" rules={{ validate: minLength('Your name') }} render={({ field }) => (
        <AppTextField label="Your name" autoCapitalize="words" autoComplete="name" textContentType="name" returnKeyType="next" submitBehavior="submit" onSubmitEditing={() => businessRef.current?.focus()} maxLength={120} editable={!isSubmitting} value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={errors.name?.message} />
      )} />
      <Controller control={control} name="business" rules={{ validate: minLength('Business name') }} render={({ field }) => (
        <AppTextField ref={businessRef} label="Business name" hint="Shown on receipts. You can add branches later." autoCapitalize="words" autoComplete="organization" textContentType="organizationName" returnKeyType="next" submitBehavior="submit" onSubmitEditing={() => emailRef.current?.focus()} maxLength={160} editable={!isSubmitting} value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={errors.business?.message} />
      )} />
      <Controller control={control} name="email" rules={{ validate: (value) => !value.trim() ? 'Enter your email address' : emailPattern.test(value.trim()) || 'Enter a valid email address' }} render={({ field }) => (
        <AppTextField ref={emailRef} label="Email" hint="We’ll send a 6-digit code to verify it." autoCapitalize="none" autoCorrect={false} autoComplete="email" textContentType="emailAddress" keyboardType="email-address" returnKeyType="next" submitBehavior="submit" onSubmitEditing={() => passwordRef.current?.focus()} maxLength={320} editable={!isSubmitting} value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={errors.email?.message} />
      )} />
      <Controller control={control} name="password" rules={{ required: 'Create a password', minLength: { value: 8, message: 'Use at least 8 characters' } }} render={({ field }) => (
        <AppTextField ref={passwordRef} label="Password"  placeholder="At least 8 characters" secureToggle autoCapitalize="none" autoCorrect={false} autoComplete="new-password" textContentType="newPassword" returnKeyType="next" submitBehavior="submit" onSubmitEditing={() => confirmRef.current?.focus()} editable={!isSubmitting} value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={errors.password?.message} />
      )} />
      <Controller control={control} name="confirm" rules={{ validate: (value, form) => value === form.password || 'Passwords don’t match' }} render={({ field }) => (
        <AppTextField ref={confirmRef} label="Confirm password"  secureToggle autoCapitalize="none" autoCorrect={false} autoComplete="new-password" textContentType="newPassword" returnKeyType="go" onSubmitEditing={onSubmit} editable={!isSubmitting} value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={errors.confirm?.message} />
      )} />
      <AppInlineError message={errors.root?.message} />
      <AppButton label="Create account" variant="primary" loading={isSubmitting} onPress={onSubmit} />
      <TextLink label="Already registered? Verify your email" align="center" onPress={() => router.push('/verify-email')} />
    </AuthLayout>
  );
}
