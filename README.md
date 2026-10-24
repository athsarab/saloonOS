# SalonOS

SalonOS is a React Native + Expo foundation for a multi-tenant salon POS. The current app is a UI and architecture foundation: authentication controls validate local form input but do not call a backend or create accounts.

## Stack

- Expo SDK 58, React Native, TypeScript, and Expo Router
- NativeWind with a token-driven light/dark theme
- Zustand, TanStack Query, React Hook Form, and Zod-ready form boundaries
- API token helpers using SecureStore on mobile and session storage on web, with an environment-based API URL
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

### Web API connection

For Expo web at `http://localhost:8081`, set the API allowlist in `apps/api/.env`:

```text
CORS_ORIGINS=http://localhost:8081,http://127.0.0.1:8081
```

Restart the API after changing `.env`: stop its terminal with Ctrl+C, then run `npm run api:dev` again. The allowlist contains the frontend origin, including its port; use your deployed frontend origins in production.

In a separate Command Prompt (cmd) terminal, start Expo web:

```cmd
set "EXPO_PUBLIC_API_URL=http://127.0.0.1:3000"
npm run start -- --web --clear
```

### Mobile API connection

For a local Android emulator, set the Expo public API URL to the host loopback address:

```powershell
$env:EXPO_PUBLIC_API_URL="http://10.0.2.2:3000"
npm run start
```

For a physical device, use the computer's LAN IP instead, for example `http://192.168.1.20:3000`. The mobile dashboard calls `/v1/health` only; authentication is not implemented yet.

All database timestamps are stored as UTC `timestamptz`. Branches default to `Asia/Colombo`, and future API serializers should convert UTC instants to branch-local display time. Monetary columns use PostgreSQL `numeric(12,2)` and Prisma `Decimal`, with LKR as the initial currency.

## Authentication and authorization

Authentication is implemented in [apps/api/src/auth](./apps/api/src/auth) and uses Argon2id for passwords, short-lived JWT access tokens, and rotating server-tracked refresh tokens. Refresh tokens are stored only as SHA-256 hashes in PostgreSQL. Reuse of a revoked token revokes its complete token family. Password reset and email verification tokens are single-use, hashed, and expiring.

The active tenant is selected on the server through a verified membership. Tenant IDs, roles, and permissions from the mobile client are never trusted. Every future tenant-owned controller must use the authenticated tenant context and the RBAC decorators rather than accepting a tenant ID from a request body.

Roles and permissions are defined in [auth.constants.ts](./apps/api/src/auth/auth.constants.ts):

| Permission area | OWNER | MANAGER | CASHIER | STYLIST |
|---|---:|---:|---:|---:|
| Business settings | Read/write | Read/write | Read | Read |
| Staff | Read/write | Read/write | — | — |
| Appointments | Read/write | Read/write | Read | Read/write |
| Checkout | Yes | Yes | Yes | — |
| Refunds | Yes | Yes | — | — |
| Inventory | Read/write | Read/write | Read | — |
| Reports | Yes | Yes | — | — |

### Development email transport

Local development uses Nodemailer’s JSON transport. It does not send external email. The complete verification or reset message is written to the API structured log. Copy the token from the development log into the mobile verification/reset screen or use the token query parameter in the logged link.

For a real provider later, replace the transport in `apps/api/src/auth/email.service.ts` with the provider’s maintained SDK or SMTP transport. Store provider credentials only in the API deployment environment, add provider timeout/retry policy, verify the sending domain, and never expose provider keys to Expo.

### Authentication testing checklist

Run the automated checks from the repository root:

```powershell
npm run api:typecheck
npm run api:build
npm run api:test
npm run typecheck
npx expo-doctor
```

The API tests cover:

- Invalid login attempts and generic credential errors
- Revoked refresh-token reuse and family revocation
- Single-use password reset rejection
- Cross-tenant membership denial
- Unauthorized protected API access
- Cashier checkout permission and refund denial
- Owner permission coverage
- Database connectivity and health endpoints

Manual checklist after configuring a real Neon database:

1. Register with a new email and verify that only the development email log contains the token.
2. Verify the token once, then verify it again and confirm rejection.
3. Log in with a wrong password and confirm the response does not reveal whether the account exists.
4. Log in successfully, close/reopen the Android app, and confirm the session restores through refresh-token rotation.
5. Capture a refresh token, use it once, then replay the old token and confirm the entire token family is revoked.
6. Log out from the current device and confirm protected calls return `401`.
7. Use “Sign out all devices” and confirm refresh on every other device fails.
8. Request a password reset, use the token once, then reuse it and confirm rejection.
9. Add a second tenant membership and confirm business selection only shows memberships belonging to the authenticated user.
10. Attempt a tenant-owned API request with another tenant’s ID and confirm denial.
11. Confirm a CASHIER cannot call refund endpoints and a STYLIST cannot call checkout endpoints once those controllers are added.
12. Verify rate limiting with repeated login requests from the same client.

Do not describe the deployment as production-ready until the real Neon migration, provider delivery, device testing, and the full checklist have passed.

### Physical Android testing

1. Put the Android phone and development computer on the same Wi-Fi network.
2. Start the API with `npm run api:dev`.
3. Find the computer’s LAN address with `ipconfig`.
4. Set the Expo API URL to the LAN address, not `localhost`:

```powershell
$env:EXPO_PUBLIC_API_URL="http://192.168.1.20:3000"
npm run start
```

5. Open the project in Expo Go or a development build on the phone.
6. Register, retrieve the token from the API development log, verify the email, and log in.
7. Force-close and reopen the app to test SecureStore-backed session restoration.
8. Test logout, logout-all, password reset, tenant selection, and role-denied requests.

If the phone cannot reach the API, allow the Node process through Windows Firewall on the private network and confirm the phone can reach `http://192.168.1.20:3000/v1/health` in its browser.

### Connection timeout troubleshooting

`10.0.2.2` is only the Android Studio emulator alias for the development computer. It is not valid from Expo Web or from a physical phone.

- Expo Web: `$env:EXPO_PUBLIC_API_URL="http://127.0.0.1:3000"`
- Android Studio emulator: `$env:EXPO_PUBLIC_API_URL="http://10.0.2.2:3000"`
- Physical Android device: `$env:EXPO_PUBLIC_API_URL="http://<your-computer-LAN-IP>:3000"`

Start the API first, then set the variable and restart Expo because `EXPO_PUBLIC_*` values are embedded when the bundle starts:

```powershell
npm run api:dev

# Use the value for the platform you are testing:
$env:EXPO_PUBLIC_API_URL="http://127.0.0.1:3000"
npm run start -- --clear
```

Check the API independently before trying registration:

```powershell
Invoke-RestMethod http://127.0.0.1:3000/v1/health
```

Registration intentionally returns a generic success message. With the development JSON email transport, copy the verification token/link from the API terminal log and enter it on the Verify Email screen before signing in.
