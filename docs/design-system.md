# SalonOS mobile design system

The reference for every screen in the Expo app. Tokens live in `src/theme/`, components in `src/components/`.
If a screen needs a value that is not here, add a token rather than a literal.

## Principles

1. **White first.** Screens are white; grouping uses hairline borders and the secondary background, not shadows.
2. **One accent.** `#6558D3` marks the primary action, selection, and links. Nothing else is purple.
3. **Status colors carry meaning only.** Green = confirmed/success, amber = needs attention/pending, red = error/destructive, blue = information. Never decorative.
4. **Content before chrome.** Screen titles are short nouns ("Customers"), not slogans. No eyebrows, gradients, glass, or illustration fillers.
5. **Real data or an honest state.** Every data region has loading, empty and error states. Never show fabricated numbers.

## Tokens

### Color (`src/theme/colors.ts`)

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `background` | `#FFFFFF` | `#111214` | Screen background |
| `surface` | `#FFFFFF` | `#18191C` | Cards, sheets, tab bar |
| `surfaceMuted` | `#F7F8FA` | `#212226` | Secondary background, inputs at rest, summary panels |
| `text` | `#202124` | `#F2F3F5` | Primary text |
| `textMuted` | `#667085` | `#A0A6B1` | Secondary text, labels |
| `textSubtle` | `#98A2B3` | `#6F7581` | Placeholders, disabled text |
| `border` | `#E6E8EC` | `#2C2E33` | Card and divider borders |
| `borderStrong` | `#D0D5DD` | `#3B3E44` | Input borders |
| `primary` | `#6558D3` | `#9B91F0` | Accent: primary buttons, selection, links |
| `primarySoft` | `#EFEDFB` | `#26233F` | Selected chip/tab background, icon tiles |
| `onPrimary` | `#FFFFFF` | `#14112B` | Text on `primary` |
| `success` / `successSoft` | `#12805C` / `#E8F5EF` | `#4CC38A` / `#15291F` | Confirmed, completed, online |
| `warning` / `warningSoft` | `#B54708` / `#FEF3E7` | `#F5A65B` / `#33230F` | Pending, attention needed |
| `danger` / `dangerSoft` | `#C4321F` / `#FDECEA` | `#F0786A` / `#3A1A17` | Errors, destructive actions |
| `info` / `infoSoft` | `#1D5FD1` / `#EAF1FD` | `#76A6F5` / `#162540` | Neutral information |
| `accent` | = `warning` | = `warning` | **Deprecated alias** kept for existing POS screens that used it for "pending" copy. Use `warning` in new code. |

`text`, `textMuted`, `primary` and the four status colors meet WCAG AA (4.5:1) on `background` and on their own `*Soft` color in light mode. `textSubtle` does not, and is reserved for placeholders and disabled text.

### Spacing (`spacing`)
`xxs 2 · xs 4 · sm 8 · md 12 · lg 16 · xl 20 · xxl 24 · xxxl 32`.
Screen gutter is `lg` (16). Vertical rhythm between sections is `xxl` (24). Within a card, `md` (12).

### Radius (`radius`)
`sm 8` (badges, small tiles) · `md 12` (inputs, buttons, list tiles) · `lg 16` (cards) · `xl 20` (bottom sheets) · `pill 999`.

### Typography (`type`)
Platform font (Roboto on Android, SF Pro on iOS). Inter was considered; it would add `expo-font` and a font package plus a loading gate before first render, which is not justified in Phase 1. Weights are limited to 400/500/600/700.

| Token | Size / line | Weight | Use |
| --- | --- | --- | --- |
| `display` | 28 / 34 | 700 | Auth screen titles only |
| `title` | 22 / 28 | 700 | Screen titles |
| `heading` | 17 / 24 | 600 | Section and card titles |
| `body` | 15 / 22 | 400 | Default text |
| `bodyStrong` | 15 / 22 | 600 | List item titles, values |
| `label` | 14 / 20 | 500 | Field labels, buttons (small) |
| `caption` | 13 / 18 | 400 | Secondary lines, helper text |
| `micro` | 12 / 16 | 600 | Badges, tab labels |
| `metric` | 24 / 30 | 700 | Dashboard figures |

### Icons (`iconSize`)
`lucide-react-native` only. `sm 16` (inline), `md 20` (list items, buttons), `lg 24` (tab bar, header actions). Stroke width default (2).

### Elevation
Flat by default. Only floating layers get a shadow: bottom sheet, dialog, toast (`elevation.overlay`).

### Touch targets
Minimum 44×44 (`touch.min`). Buttons are 48 tall (`md`), 40 (`sm`). Tab bar items are ≥ 56 tall.

## Components

All live in `src/components/` and read colors via `useTheme()`.

| Component | Purpose | Key props |
| --- | --- | --- |
| `AppButton` | Every tappable action rendered as a button | `label`, `variant` (`primary` · `secondary` · `ghost` · `danger`), `size` (`md` · `sm`), `loading`, `disabled`, `icon`, `fullWidth` |
| `AppTextField` | Labelled text input | `label`, `error`, `hint`, `secureToggle`, all `TextInput` props |
| `AppHeader` | Screen title area with optional back button and right action | `title`, `description`, `onBack`/`back`, `right`, `size` (`screen` · `auth`) |
| `AppCard` | Bordered container | `padded`, `style`, `onPress` |
| `AppDialog` | Modal confirmation | `visible`, `title`, `message`, `confirmLabel`, `tone`, `onConfirm`, `onCancel`, `loading` |
| `AppToast` | Transient feedback; mount `ToastProvider` once, call `useToast().show()` | `message`, `tone` |
| `AppBottomSheet` | Slide-up panel for forms and details | `visible`, `title`, `onClose`, `locked` |
| `AppSearchBar` | Search input with icon and clear button | `value`, `onChangeText`, `placeholder` |
| `AppSectionHeader` | Title above a group, optional action link | `title`, `actionLabel`, `onAction` |
| `AppListItem` | Row with leading visual, text, trailing content | `title`, `subtitle`, `leading`, `trailing`, `onPress`, `chevron` |
| `AppStatusBadge` | Status pill | `label`, `tone` (`success` · `warning` · `danger` · `info` · `neutral` · `accent`) |
| `AppLoadingState` / `AppEmptyState` / `AppErrorState` | Region states | `label` / `title`, `description`, `action` / `message`, `onRetry` |
| `AppOfflineBanner` | Connectivity + unsynced cash warning, shown above the tab bar | — |
| `AppTabBar` | Bottom navigation (custom `tabBar` for Expo Router JS tabs) | — |

Helpers built from the above: `AppInlineError` (form/server error block, in `AppStates.tsx`), `AppListIcon` and `AppAvatar` (list leading visuals, in `AppListItem.tsx`), `AuthLayout` (keyboard-safe frame for auth screens), `TextLink` (inline text action with a 44px target), `AppointmentRow` (shared by Home and Appointments).

Note: in this Expo Router version the custom `tabBar` receives `{ state, descriptors, emitter, navigateToTab, insets }` — not React Navigation's `navigation` prop.

### Rules
- **Buttons:** one `primary` per view region. Destructive confirmations use `danger`. Buttons show a spinner and are disabled while `loading`; forms also guard with a ref or `isSubmitting` so double taps can't submit twice.
- **Forms:** label above the input; placeholder is an example, never the label. Errors appear under the field in `danger` and are announced (`accessibilityLiveRegion`). Server errors go in an inline error block above the submit button. Set `keyboardType`, `autoComplete`, `textContentType`, `autoCapitalize` on every field. Wrap forms in `KeyboardAvoidingView` + `ScrollView` with `keyboardShouldPersistTaps="handled"`.
- **Status:** always `AppStatusBadge` with a text label — never color alone.
- **Lists:** `AppListItem` inside an `AppCard padded={false}` with hairline dividers, or a `FlatList` for long lists.
- **Errors:** user-facing copy comes from `friendlyError()` (`src/lib/errors.ts`). It never surfaces stack traces, tokens, URLs (outside `__DEV__`) or 5xx bodies.
- **Legacy names:** `Button`, `Field`, `Card`, `SectionTitle`, `EmptyState`, `LoadingState` (`ui.tsx`), `PosSheet`, `OfflineBanner` re-export the new components for screens not yet migrated. Use the `App*` names in new code.

## Navigation

```
/                     Welcome (redirects to /(app) when signed in)
/login /register /verify-email /forgot-password /reset-password
/business-selection   (multi-business accounts)
/(app)                Bottom tabs
  Home          index
  Appointments  appointments
  POS           checkout          (hidden for roles without `checkout`)
  Customers     customers
  More          more
    ├ sales              Sales & reports
    ├ sync               Offline & sync (Android, checkout roles)
    ├ settings           Business settings
    └ account-security   Account & security
  offline-checkout      (reached from POS / Sync, highlights POS)
```

- The tab bar is a custom component (`src/components/AppTabBar.tsx`). It always renders the five destinations (minus those the role cannot use) and highlights the **parent** destination for sub-screens, e.g. Sales highlights More.
- `backBehavior="history"`: Android back from a More sub-screen returns to More, not Home.
- Sub-screens render `AppHeader` with a back button (`router.back()`, falling back to `/(app)/more`).
- Route paths did not change, so existing links (`/(app)/sync`, `/(app)/sales`, …) still work.

### Role visibility (UI hint only — the API enforces permissions)

`src/lib/permissions.ts` reads `role` from the access token and mirrors the server's role → permission map.
**If `apps/api/src/auth/auth.constants.ts` changes, update this file too.**

| Destination / element | Owner | Manager | Cashier | Stylist |
| --- | --- | --- | --- | --- |
| Home, Appointments, Customers, More | ✓ | ✓ | ✓ | ✓ |
| POS, Sales history, Cash shift, Offline & sync | ✓ | ✓ | ✓ | — |
| Today's sales figures, Reports | ✓ | ✓ | — | — |
| Add customer | ✓ | ✓ | ✓ | ✓ |
| Device registration (Sync) | ✓ | ✓ | — | — |
