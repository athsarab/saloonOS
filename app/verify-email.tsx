import { useLocalSearchParams, router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppHeader } from '../src/components/AppHeader';
import { Button, Field, Screen } from '../src/components/ui';
import { ApiError, apiRequest } from '../src/lib/api';

export default function VerifyEmailScreen() {
  const params = useLocalSearchParams<{ token?: string; email?: string }>();
  const [email, setEmail] = useState(params.email ?? '');
  const [token, setToken] = useState(params.token ?? '');
  const [message, setMessage] = useState('Enter the six-digit code from your email. Codes expire in 15 minutes.');
  const [pending, setPending] = useState<'verify' | 'resend' | null>(null);
  const [verified, setVerified] = useState(false);

  const verify = async () => {
    if ((!params.token && !email.trim()) || !token.trim()) {
      setMessage('Enter your email address and verification code.');
      return;
    }
    setPending('verify');
    try {
      await apiRequest('/v1/auth/verify-email', { method: 'POST', body: JSON.stringify({ token: token.trim(), ...(email.trim() ? { email: email.trim() } : {}) }) }, false);
      setVerified(true);
      setMessage('Email verified. You can now sign in.');
    } catch (error) {
      setMessage(error instanceof ApiError
        ? error.status === 429 ? 'Too many attempts. Please wait a minute and try again.' : 'The email or code is incorrect, expired, or already used.'
        : 'Could not connect. Check your connection and try again.');
    } finally {
      setPending(null);
    }
  };

  const resend = async () => {
    if (!email.trim()) {
      setMessage('Enter the email address you used to register.');
      return;
    }
    setPending('resend');
    try {
      await apiRequest('/v1/auth/resend-verification', { method: 'POST', body: JSON.stringify({ email: email.trim() }) }, false);
      setToken('');
      setMessage('If this email belongs to an unverified account, a new code has been sent. Check your inbox and spam folder.');
    } catch (error) {
      setMessage(error instanceof ApiError
        ? error.status === 429 ? 'Please wait a minute before requesting another code.'
          : error.status === 400 ? 'Enter a valid email address.' : 'The email could not be sent. Please try again later.'
        : 'Could not connect. Check your connection and try again.');
    } finally {
      setPending(null);
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <AppHeader title="Verify your email" description="Check your inbox for your SalonOS verification code." />
          <View style={styles.form}>
            <Field label="Email address" value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" editable={!pending && !verified} />
            <Field label="Verification code" value={token} onChangeText={setToken} autoCapitalize="none" autoCorrect={false} keyboardType={params.token ? 'default' : 'number-pad'} maxLength={params.token ? 128 : 6} editable={!pending && !verified} />
            <Button label="Verify email" loading={pending === 'verify'} disabled={pending !== null || verified} onPress={() => void verify()} />
            <Button label="Resend verification code" variant="secondary" loading={pending === 'resend'} disabled={pending !== null || verified} onPress={() => void resend()} />
          </View>
          <Text>{message}</Text>
          <Button label="Back to sign in" variant="ghost" onPress={() => router.replace('/login')} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({ flex: { flex: 1 }, content: { gap: 22, padding: 24, paddingTop: 50 }, form: { gap: 16 } });
