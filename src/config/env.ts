import { Platform } from 'react-native';

// Edit computerIp when your computer's Wi-Fi address changes, then reload Expo Go.
// Set enabled to false to use EXPO_PUBLIC_API_URL for a remote development API.
const localApi = {
  enabled: true,
  computerIp: '10.68.40.181',
  port: 3000,
} as const;

// Local settings take priority in development, including over old terminal values.
// Release builds always use EXPO_PUBLIC_API_URL.
const apiUrl = __DEV__ && localApi.enabled
  ? `http://${Platform.OS === 'web' ? '127.0.0.1' : localApi.computerIp}:${localApi.port}`
  : process.env.EXPO_PUBLIC_API_URL;

export const env = {
  apiUrl: apiUrl ?? 'https://api.example.invalid',
  isConfigured: Boolean(apiUrl),
} as const;
