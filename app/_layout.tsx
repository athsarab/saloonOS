import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, useTheme } from '../src/theme/ThemeProvider';
import { ToastProvider } from '../src/components/AppToast';
import { useAuthStore } from '../src/lib/auth';
import { startOfflineRuntime } from '../src/offline/runtime';
import '../global.css';

const queryClient = new QueryClient();

function RootStack() {
  const { colors, appearance } = useTheme();
  return (
    <>
      <StatusBar style={appearance === 'light' ? 'dark' : 'light'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />
    </>
  );
}

export default function RootLayout() {
  const hydrate = useAuthStore((state) => state.hydrate);
  React.useEffect(() => { void hydrate(); }, [hydrate]);
  React.useEffect(() => startOfflineRuntime(), []);
  return <QueryClientProvider client={queryClient}><ThemeProvider><ToastProvider><RootStack /></ToastProvider></ThemeProvider></QueryClientProvider>;
}
