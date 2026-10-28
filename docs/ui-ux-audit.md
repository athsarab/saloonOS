# SalonOS mobile UI/UX audit — Phase 1

Scope: the Expo app in `app/` and `src/` (Expo SDK 58, Expo Router, React Query, Zustand, react-hook-form).
The NestJS API (`apps/api`) and the Next.js web POS (`apps/web`) are out of scope and unchanged.

## 1. Current structure

| Area | Implementation |
| --- | --- |
| Routing | Expo Router. Routes live in `app/` (not `src/app/`). Root `Stack` with header hidden; authenticated group `app/(app)` uses JS `Tabs`. |
| Auth | `src/lib/auth.ts` (Zustand) + `src/lib/api.ts`. Tokens in SecureStore (native) / sessionStorage (web). Refresh on 401 and on hydrate. The JWT carries `sub`, `tenantId`, `role`. |
| Roles | `OWNER`, `MANAGER`, `CASHIER`, `STYLIST`; server-side permission map in `apps/api/src/auth/auth.constants.ts`. |
| Data | React Query hooks in `src/lib/salon-api.ts` and `src/lib/checkout-api.ts`. |
| Offline | Android-only offline cash queue (`src/offline/*`), surfaced by `OfflineBanner` and the Sync screen. |
| Styling | Inline `StyleSheet` + a small `ThemeProvider` with light/dark tokens. NativeWind is configured but effectively unused (one `className`). |
| Shared UI | `src/components/ui.tsx` (`Screen`, `Card`, `Button`, `Field`, `SectionTitle`, `EmptyState`, `LoadingState`), `AppHeader`, `Logo`, `OfflineBanner`, `PosSheet`. |

### Implemented screens

- Public: Welcome (`/`), Login, Register, Verify email, Forgot password, Reset password, Business selection.
- Authenticated tabs: Overview, Appointments (today, read-only), Checkout (POS), Sales (history, receipts, refunds, daily report), Settings, Sync Status.
- Hidden: Account & security, Offline cash checkout.

### APIs available but with no mobile screen yet

Customers list/create, services/catalog management, inventory, staff and schedules, appointment create/update, business profile update, audit log.

## 2. Problems found

### Visual design
1. **No single design language.** Green primary (`#1C6B52`) with copper accent, 40px/800-weight hero, 30px headings, 26–28px screen titles, uppercase letter-spaced "eyebrows" ("SALONOS / POINT OF SALE", "THE DAY, AT A GLANCE") — heading sizes and weights differ on every screen.
2. **Marketing copy inside working screens** ("A smooth checkout.", "Services, finishing touches, and a little care.", "Run your salon with calm confidence.") pushes useful content down and reads as template text.
3. **Inconsistent radii and spacing** (10, 12, 13, 14, 18, 20, 24, 28 radii; paddings 12–28).
4. **Hard-coded colors** in places (`#D8DDE5` divider on dashboard, `#A4B0AA` sheet handle, raw `<Text>` with no color on reset/verify screens, which breaks in dark mode).
5. **Status shown as plain text** (`completed`, `TRANSFER PENDING`, `OPEN`) instead of a consistent badge.

### Navigation
6. **Six visible tabs** (Overview, Appointments, Checkout, Sales, Settings, Sync Status) — too many for a phone; "Sync Status" reuses the Sales icon.
7. **No Customers destination** even though customer APIs exist.
8. **Tabs not filtered by role.** A stylist sees Checkout and Sales, which fail with 403.
9. **Back behaviour is unpredictable.** Tabs default to "first route" back behaviour, so Android back from Account & security goes to Overview, not Settings. Hidden screens have no header back button.
10. **The offline banner is drawn above the tabs without a safe-area inset**, so it sits under the status bar on Android with edge-to-edge.
11. **Welcome screen ignores an existing session**: a signed-in user opening the app root sees marketing actions again.

### Authentication and onboarding
12. Validation is "required" only — no email format check, no confirm-password, no trimming on register.
13. Register maps every non-503 error to "Unable to create the account with those details", hiding useful server messages (e.g. email already in use).
14. Reset password and verify email use bare `useState`, have no loading state on reset, no double-submit guard on reset, and show results as unstyled text.
15. Forgot password success message stays beside an editable form; there is no clear "next step".
16. The login connection error prints the API URL to every user (useful only in development).
17. No password visibility toggle; no `textContentType`/`autoComplete` hints, so password managers and autofill work poorly.
18. Business selection has no loading/error handling — a failed request is an unhandled promise rejection and the tap appears to do nothing. If the app reloads on that screen the tenant list is empty with no way forward.

### Dashboard
19. Four equal statistic cards (total/upcoming/completed/cancelled) dominate the screen; no sales figures, no quick actions, no next-up appointments, no alerts.
20. Error copy says "Pull to retry" but there is no pull-to-refresh.
21. All appointments for the day are listed, including past and cancelled ones.

### Accessibility
22. Several pressables lack labels; status text relies on color; some touch targets (links) are below 44px.

## 3. Planned improvements (Phase 1)

| # | Change | Addresses |
| --- | --- | --- |
| 1 | New token set (`src/theme/tokens.ts`, updated `colors.ts`): white-first palette, `#6558D3` accent, semantic status colors, spacing/radius/type scales. Existing color keys are kept so untouched screens adopt the palette automatically. | 1, 3, 4 |
| 2 | Reusable `App*` components in `src/components/`. Legacy `ui.tsx`, `PosSheet`, `OfflineBanner` become thin re-exports so POS/Sales/Sync keep working without rewrites. | 1–5, 22 |
| 3 | Five-destination bottom bar (Home, Appointments, POS, Customers, More) via a custom tab bar that highlights the parent destination for sub-screens, filters by role, and hosts the offline banner above it. `backBehavior="history"`. Existing route paths unchanged. | 6–10 |
| 4 | New **Customers** screen (search, list, add customer) on the existing `/v1/salon/customers` API. | 7 |
| 5 | New **More** screen listing only implemented, role-permitted destinations. Settings becomes a real Business settings screen (profile and branches, read-only). | 6, 8 |
| 6 | Auth screens rebuilt on shared components with inline validation, autofill hints, password toggle, guarded submission, friendly error mapping (`src/lib/errors.ts`). | 12–18 |
| 7 | Welcome redirects authenticated users into the app. | 11 |
| 8 | Role-aware dashboard: greeting + business context, compact today summary, alerts, quick actions, next appointments, recent sales, pull-to-refresh. | 19–21 |

### Deliberately not in Phase 1
- Full redesign of POS (`checkout.tsx`), Sales, Sync and Offline checkout. They pick up new tokens and base components but layout is unchanged.
- Appointment creation, services, inventory, staff, notifications, help screens (no UI exists yet; not shown in More).
- Custom font loading (Inter would add `expo-font` + a font package; the platform font is used instead — see design-system.md).
