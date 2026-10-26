import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '../src/theme/ThemeProvider';
import { useAuthStore } from '../src/lib/auth';
import { startOfflineRuntime } from '../src/offline/runtime';
import '../global.css';

const queryClient = new QueryClient();

export default function RootLayout() {
  const hydrate = useAuthStore((state) => state.hydrate);
  React.useEffect(() => { void hydrate(); }, [hydrate]);
  React.useEffect(() => startOfflineRuntime(), []);
  return <QueryClientProvider client={queryClient}><ThemeProvider><StatusBar style="auto" /><Stack screenOptions={{ headerShown: false }} /></ThemeProvider></QueryClientProvider>;
}
