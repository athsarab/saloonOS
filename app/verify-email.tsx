import { useLocalSearchParams, router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AppHeader } from '../src/components/AppHeader';
import { Button, Field, Screen } from '../src/components/ui';
import { apiRequest } from '../src/lib/api';

export default function VerifyEmailScreen() {
  const params = useLocalSearchParams<{ token?: string; email?: string }>();
  const [token, setToken] = useState(params.token ?? '');
  const [message, setMessage] = useState(params.token ? '' : 'Check your development email output for the verification link.');
  const verify = async () => {
    try { await apiRequest('/v1/auth/verify-email', { method: 'POST', body: JSON.stringify({ token }) }); setMessage('Email verified. You can now sign in.'); } catch { setMessage('This verification link is invalid or expired.'); }
  };
  return <Screen><View style={styles.content}><AppHeader title="Verify your email" description={`We sent instructions to ${params.email ?? 'your email address'}.`} /><Field label="Verification token" value={token} onChangeText={setToken} autoCapitalize="none" /><Button label="Verify email" onPress={() => void verify()} /><Button label="Back to sign in" variant="ghost" onPress={() => router.replace('/login')} /><Text>{message}</Text></View></Screen>;
}

const styles = StyleSheet.create({ content: { flex: 1, gap: 22, padding: 24, paddingTop: 50 } });
