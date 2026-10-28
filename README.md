# SalonOS

## Phase 4 transactional POS

The responsive Next.js POS is in `apps/web`. Run `npm run pos:web` and open http://localhost:3001 with the API running on port 3000. See [Phase 4 architecture and API contracts](./docs/PHASE4_ARCHITECTURE.md) and [setup, validation results, and review checklist](./docs/PHASE4_TEST_RESULTS.md).


Android offline cash: see [setup, policy, testing and production limitations](./docs/OFFLINE_CASH.md). Cash records are encrypted in SQLite, provisional until server confirmation, and visible in Sync Status.

## Mobile POS checkout

The Checkout and Sales tabs support online cash checkout, pending/verified bank transfers, receipts, refunds, inventory deduction, daily reports, and cash shifts. See [Android setup and acceptance checklist](./docs/POS_CHECKOUT.md) and [test results](./docs/POS_TEST_RESULTS.md).

SalonOS combines an Expo mobile application, a responsive Next.js POS, and an authenticated NestJS/PostgreSQL backend for multi-tenant salon operations.

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
npm run start
```

Local API addresses are configured in `src/config/env.ts`; you do not need to set an API variable in the terminal during local development.

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
npm run start -- --web --clear
```

### Mobile API connection

Edit the local API settings at the top of [src/config/env.ts](./src/config/env.ts):

```ts
const localApi = {
  enabled: true,
  computerIp: '192.168.159.181',
  port: 3000,
} as const;
```

- Physical phone: use the computer's Wi-Fi IPv4 address in `computerIp`. The current address is `192.168.159.181`; it may change when you switch networks.
- Web on this computer: automatically uses `http://127.0.0.1:3000`.
- Android Studio emulator: set `computerIp` to `10.0.2.2`.

After editing this file, save and reload the app in Expo Go. Keep Expo and the API running; no terminal API variable or server restart is needed for this frontend setting.

These local settings take precedence over `EXPO_PUBLIC_API_URL` in development. Set `enabled: false` to use an environment-configured remote API during development. Release builds always use `EXPO_PUBLIC_API_URL` and never use the local IP fallback.

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

### Gmail verification emails

Verification emails use Gmail SMTP. Configure the following in `apps/api/.env` (these are backend secrets; never add them to Expo public variables):

```env
EMAIL_TRANSPORT=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=your-sender@gmail.com
SMTP_PASSWORD=your-google-app-password
EMAIL_FROM=your-sender@gmail.com
```

Use the same Gmail address for `SMTP_USER` and `EMAIL_FROM`. Enable Google 2-Step Verification, then create an [App Password](https://myaccount.google.com/apppasswords). Use that App Password, not your normal Gmail password; copy it without the display spaces. See [Google's App Password instructions](https://support.google.com/accounts/answer/185833).

Restart the API after editing `apps/api/.env`. Registration sends a random six-digit code to the entered email address. Enter the email and code on the verification screen; codes expire after 15 minutes and can be consumed only once. The database stores an email-bound HMAC hash, not the code. Codes and email bodies are not logged in SMTP mode.

For an account created earlier, choose **Verify an existing account** on registration and then **Resend verification code**. Resending replaces outstanding codes; the endpoint is limited to three requests per minute per client. If Gmail cannot accept a message, the API returns a delivery error instead of claiming it was sent. SMTP acceptance does not guarantee inbox placement; check spam too.

Password-reset messages also use SMTP. Set `APP_BASE_URL` to your frontend URL for reset links (not the API URL). On a phone you can also paste the reset token from the received email into the app.

Tests explicitly use `EMAIL_TRANSPORT=json` to avoid sending email. For deliberate offline previews, this mode is available outside production; preview messages appear only in the API log and are not delivered.

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

1. Register with a new email and confirm the inbox receives a six-digit verification code.
2. Verify the email and code once, then reuse the code and confirm rejection.
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

## Salon management module

The first salon module is tenant-scoped and uses real PostgreSQL records:

- Business profile and branches
- Services with LKR `Decimal` prices and duration in minutes
- Customers and appointment visit history
- Staff profiles, weekly schedules, and time off
- Appointments with server-calculated end times and stylist conflict checks
- Dashboard appointment totals and upcoming schedule

After configuring `DATABASE_URL` and `DIRECT_URL`, apply the additive migration from the repository root:

```powershell
npm run api:prisma:generate
npm run api:prisma:migrate
```

Existing appointments may have no service association because the module migration keeps `Appointment.serviceId` nullable for backwards compatibility. New appointments always require an active service and the API calculates `endsAt`; clients must not calculate or trust this value.

All appointment instants are sent as UTC ISO strings. The mobile dashboard and calendar display them in `Asia/Colombo`. The API derives the tenant from the authenticated membership, validates branch/customer/service/staff ownership, rejects time-off overlaps, and rejects overlapping active appointments for the same stylist.

The intended end-to-end verification is:

1. Register and verify a user, then select a tenant.
2. Create a branch, service, customer, and staff profile through the authenticated salon endpoints.
3. Add the stylist’s weekly schedule and create an appointment.
4. Confirm it appears in the Dashboard and Appointments tabs.
5. Reschedule it, attempt an overlapping booking, and confirm the API rejects the conflict.
6. Cancel it and confirm the dashboard counters update.

The migration and API build are safe to run before adding mobile write forms; no payment or offline appointment editing is included.

### Physical Android testing

1. Put the Android phone and development computer on the same Wi-Fi network.
2. Keep the API running with `npm run api:dev` in one terminal and Expo with `npm run start` in another.
3. Set `computerIp` in `src/config/env.ts` to the computer's Wi-Fi IPv4 address (find it with `ipconfig` when it changes).
4. Scan the Expo terminal's QR code with Expo Go. After future IP edits, save the file and reload Expo Go.
5. Open `http://192.168.159.181:3000/v1/health` in the phone's browser to verify API connectivity; substitute the new address if it changes.
6. Register, retrieve the code from your inbox, verify the email, and log in.
7. Force-close and reopen the app to test SecureStore-backed session restoration.
8. Test logout, logout-all, password reset, tenant selection, and role-denied requests.

If the phone cannot reach the health URL, confirm both devices are on the same network and allow the API's Node process through Windows Firewall for that network.

### Connection timeout troubleshooting

`10.0.2.2` is only the Android Studio emulator alias for the development computer. For a physical phone, edit `computerIp` in `src/config/env.ts` to the computer's LAN address. Web uses `127.0.0.1` automatically in local development.

Keep the API and Expo running in separate terminals. Check the API from Command Prompt:

```cmd
curl http://127.0.0.1:3000/v1/health
```

Then check the equivalent LAN URL in the phone's browser. If the computer health check passes but the phone's check fails, investigate Wi-Fi isolation or firewall access. Reload Expo Go after changing `computerIp`.

Registration sends a six-digit verification code through the configured SMTP provider. Enter the code and email on the Verify Email screen before signing in. If the account already exists but is unverified, use Resend verification code.
