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

## Backend setup

The NestJS API lives in [apps/api](./apps/api). It owns Prisma, PostgreSQL, credentials, tenant-scoped data access, and all database connectivity. The mobile app only receives the public API URL; never put `DATABASE_URL`, `DIRECT_URL`, or any database credential in Expo environment variables.

### Create a free Neon database

1. Open [neon.tech](https://neon.tech/) and create an account.
2. Select **New project**, choose a project name such as `salonos-development`, and select the closest available region.
3. In the Neon dashboard, choose **Connect** and copy the pooled connection string. It includes `sslmode=require`.
4. Copy the direct connection string too if Neon displays one. Prisma uses the pooled URL for application traffic and `DIRECT_URL` for migrations.
5. Create `apps/api/.env` from the template:

```powershell
Copy-Item "apps\api\.env.example" "apps\api\.env"
```

Set the two private values in `apps/api/.env`:

```text
DATABASE_URL=postgresql://...-pooler....neon.tech/...?...&sslmode=require
DIRECT_URL=postgresql://....neon.tech/...?...&sslmode=require
```

Do not commit this file. It is ignored by `apps/api/.gitignore`.

### Install, migrate, and verify

From the repository root:

```powershell
npm install
npm run api:prisma:generate
npm run api:prisma:migrate
npm run api:build
npm run api:dev
```

`api:prisma:migrate` runs `prisma migrate deploy`, which applies committed migrations safely and does not reset the database. For creating a new development migration after changing the schema, use:

```powershell
npm run prisma:migrate:dev --workspace @salonos/api -- --name describe_change
```

Verify the API:

```powershell
Invoke-RestMethod http://localhost:3000/v1/health
Invoke-RestMethod http://localhost:3000/v1/system/version
Start-Process http://localhost:3000/docs
```

The expected health response reports both `"status": "ok"` and `"database": "connected"`. The OpenAPI document is available at `/docs`.

### Mobile API connection

For a local Android emulator, set the Expo public API URL to the host loopback address:

```powershell
$env:EXPO_PUBLIC_API_URL="http://10.0.2.2:3000"
npm run start
```

For a physical device, use the computer's LAN IP instead, for example `http://192.168.1.20:3000`. The mobile dashboard calls `/v1/health` only; authentication is not implemented yet.

All database timestamps are stored as UTC `timestamptz`. Branches default to `Asia/Colombo`, and future API serializers should convert UTC instants to branch-local display time. Monetary columns use PostgreSQL `numeric(12,2)` and Prisma `Decimal`, with LKR as the initial currency.
