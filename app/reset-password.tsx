import { useLocalSearchParams, router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AppHeader } from '../src/components/AppHeader';
import { Button, Field, Screen } from '../src/components/ui';
import { apiRequest } from '../src/lib/api';

export default function ResetPasswordScreen() {
  const params = useLocalSearchParams<{ token?: string }>();
  const [token, setToken] = useState(params.token ?? '');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const reset = async () => {
    try { await apiRequest('/v1/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, password }) }); setMessage('Password reset. You can sign in on this device.'); } catch { setMessage('This reset link is invalid or expired.'); }
  };
  return <Screen><View style={styles.content}><AppHeader title="Choose a new password" description="Use at least 8 characters." /><Field label="Reset token" value={token} onChangeText={setToken} autoCapitalize="none" /><Field label="New password" value={password} onChangeText={setPassword} secureTextEntry /><Button label="Reset password" onPress={() => void reset()} /><Button label="Back to sign in" variant="ghost" onPress={() => router.replace('/login')} /><Text>{message}</Text></View></Screen>;
}

const styles = StyleSheet.create({ content: { flex: 1, gap: 22, padding: 24, paddingTop: 50 } });
