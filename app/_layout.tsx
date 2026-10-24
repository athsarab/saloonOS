import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '../src/theme/ThemeProvider';
import '../global.css';

const queryClient = new QueryClient();

export default function RootLayout() {
  return <QueryClientProvider client={queryClient}><ThemeProvider><StatusBar style="auto" /><Stack screenOptions={{ headerShown: false }} /></ThemeProvider></QueryClientProvider>;
}
