# SalonOS

SalonOS is a React Native + Expo foundation for a multi-tenant salon POS. The current app is a UI and architecture foundation: authentication controls validate local form input but do not call a backend or create accounts.

## Stack

- Expo SDK 58, React Native, TypeScript, and Expo Router
- NativeWind with a token-driven light/dark theme
- Zustand, TanStack Query, React Hook Form, and Zod-ready form boundaries
- SecureStore-backed API token helpers and an environment-based API URL
- Modular `src/` boundaries for future salon, restaurant, and garage business modules

## Windows setup

1. Install Node.js LTS and Android Studio. In Android Studio, install the Android SDK, SDK Platform, and an emulator.
2. Open PowerShell and run:

```powershell
cd "D:\react native apps\saloonOS"
npm install
$env:EXPO_PUBLIC_API_URL="https://your-api.example.com"
npm run start
```

Keep the API variable unset while working on the UI; the app intentionally does not submit authentication forms without a real service.

## Android testing

Start an emulator from Android Studio, then use either:

```powershell
npm run android
```

or run `npm run start`, press `a` in the Expo terminal, and scan the development QR code with Expo Go where supported. For a physical Android device, keep the device and computer on the same network.

## Project structure

- `app/`: typed file-based navigation and screen composition
- `src/components/`: reusable UI primitives
- `src/theme/`: light/dark design tokens
- `src/lib/`: API and secure credential infrastructure
- `src/config/`: environment configuration

The dashboard intentionally renders empty states rather than fabricated business data. Connect query hooks to the backend before presenting revenue, appointment, or customer records.
