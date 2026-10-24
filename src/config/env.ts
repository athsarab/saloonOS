const apiUrl = process.env.EXPO_PUBLIC_API_URL;

export const env = {
  apiUrl: apiUrl ?? 'https://api.example.invalid',
  isConfigured: Boolean(apiUrl),
} as const;
