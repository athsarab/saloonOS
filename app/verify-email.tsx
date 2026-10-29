import { useLocalSearchParams, router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CheckCircle2, Info } from 'lucide-react-native';
import { AppButton } from '../src/components/AppButton';
import { AppCard } from '../src/components/AppCard';
import { AppInlineError } from '../src/components/AppStates';
import { AppTextField } from '../src/components/AppTextField';
import { AuthLayout } from '../src/components/AuthLayout';
import { apiRequest } from '../src/lib/api';
import { emailPattern, friendlyError } from '../src/lib/errors';
import { feedback } from '../src/lib/feedback';
import { useTheme } from '../src/theme/ThemeProvider';
import { iconSize, radius, spacing, type } from '../src/theme/tokens';

type Notice = { tone: 'info' | 'error'; text: string } | null;

export default function VerifyEmailScreen() {
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ token?: string; email?: string }>();
  const fromLink = !!params.token;
  const [email, setEmail] = useState(params.email ?? '');
  const [token, setToken] = useState(params.token ?? '');
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; token?: string }>({});
  const [notice, setNotice] = useState<Notice>(null);
  const [pending, setPending] = useState<'verify' | 'resend' | null>(null);
  const [verified, setVerified] = useState(false);

  const validEmail = () => {
    if (!email.trim()) return 'Enter the email you registered with';
    if (!emailPattern.test(email.trim())) return 'Enter a valid email address';
    return undefined;
  };

  const verify = async () => {
    if (pending) return;
    const errors = {
      email: fromLink && !email.trim() ? undefined : validEmail(),
      token: !token.trim() ? 'Enter the 6-digit code' : !fromLink && !/^\d{6}$/.test(token.trim()) ? 'The code has 6 digits' : undefined,
    };
    setFieldErrors(errors);
    if (errors.email || errors.token) return;
    setPending('verify');
    setNotice(null);
    try {
      await apiRequest('/v1/auth/verify-email', { method: 'POST', body: JSON.stringify({ token: token.trim(), ...(email.trim() ? { email: email.trim() } : {}) }) }, false);
      setVerified(true);
    } catch (error) {
      setNotice({ tone: 'error', text: friendlyError(error, { fallback: feedback.auth.verificationFailed, byStatus: { 401: feedback.auth.verificationFailed, 400: 'Check the email and code, then try again.' } }) });
    } finally {
      setPending(null);
    }
  };

  const resend = async () => {
    if (pending) return;
    const emailError = validEmail();
    setFieldErrors({ email: emailError });
    if (emailError) return;
    setPending('resend');
    setNotice(null);
    try {
      await apiRequest('/v1/auth/resend-verification', { method: 'POST', body: JSON.stringify({ email: email.trim() }) }, false);
      setToken('');
      setNotice({ tone: 'info', text: feedback.auth.verificationSent });
    } catch (error) {
      setNotice({ tone: 'error', text: friendlyError(error, { fallback: 'We could not send a new code. Check the email and try again.', byStatus: { 429: 'Please wait a minute before requesting another code.', 400: 'Enter a valid email address.' } }) });
    } finally {
      setPending(null);
    }
  };

  if (verified) {
    return (
      <AuthLayout title="Email verified">
        <AppCard muted>
          <CheckCircle2 color={colors.success} size={iconSize.lg} />
          <Text style={[type.body, { color: colors.text }]}>Your email is confirmed. Sign in to start using SalonOS.</Text>
        </AppCard>
        <AppButton label="Sign in" onPress={() => router.replace('/login')} />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Verify your email"
      description="Enter the 6-digit code we emailed you. Codes expire in 15 minutes."
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/login'))}
    >
      <AppTextField label="Email" required placeholder="you@yoursalon.lk" value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} autoComplete="email" textContentType="emailAddress" keyboardType="email-address" editable={!pending} error={fieldErrors.email} />
      <AppTextField
        label="Verification code"
        placeholder={fromLink ? undefined : '6-digit code'}
        value={token}
        onChangeText={setToken}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete={fromLink ? 'off' : 'one-time-code'}
        textContentType="oneTimeCode"
        keyboardType={fromLink ? 'default' : 'number-pad'}
        maxLength={fromLink ? 128 : 6}
        returnKeyType="done"
        onSubmitEditing={() => void verify()}
        editable={!pending}
        error={fieldErrors.token}
      />
      {notice?.tone === 'error' ? <AppInlineError message={notice.text} /> : notice ? (
        <View accessibilityLiveRegion="polite" style={[styles.info, { backgroundColor: colors.infoSoft }]}>
          <Info color={colors.info} size={iconSize.md} />
          <Text style={[type.caption, styles.infoText, { color: colors.text }]}>{notice.text}</Text>
        </View>
      ) : null}
      <AppButton label="Verify email" variant="auth" loading={pending === 'verify'} disabled={pending === 'resend'} onPress={() => void verify()} />
      <AppButton label="Send a new code" variant="secondary" loading={pending === 'resend'} disabled={pending === 'verify'} onPress={() => void resend()} />
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  info: { alignItems: 'flex-start', borderRadius: radius.md, flexDirection: 'row', gap: spacing.sm, padding: spacing.md },
  infoText: { flex: 1 },
});
