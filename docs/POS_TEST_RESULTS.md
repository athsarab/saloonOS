# POS checkout verification report

Report updated: 2026-10-26 (Asia/Colombo).

## Automated results

| Check | Result |
| --- | --- |
| Regular API, authorization, checkout, money, and email suites | 52 passed, 0 failed |
| Opt-in PostgreSQL checkout suite, run separately against the development database | 12 passed, 0 failed |
| Total executed tests | 64 passed, 0 failed |
| API TypeScript and Nest build | Passed |
| Mobile TypeScript | Passed |
| Expo lint | Passed, no warnings in the final run |
| Android production JavaScript/Hermes export | Passed: `.expo/checkout-android` |
| Web production export | Passed: `.expo/checkout-web` |
| Prisma schema validation/client generation and checkout migrations | Passed; both checkout migrations applied |
| API health after implementation | HTTP 200, database connected |

The normal `npm run api:test` run deliberately skips the 12 opt-in PostgreSQL tests. Those 12 were executed separately, not counted as passing merely because they were skipped. Their test business and users were removed by teardown.

## PostgreSQL tests that passed

1. Cash service/product checkout with exact totals, historical prices and staff assignment.
2. Concurrent identical requests produce one sale, payment, audit event and stock deduction.
3. Changed payloads cannot reuse a checkout key; receipts retain historical names/prices after catalog edits.
4. Competing buyers cannot oversell the final stocked item.
5. A forced audit-write failure rolls back stock, sale and payment; the same key can subsequently succeed.
6. Partial refunds replay idempotently and concurrent requests cannot over-refund confirmed payments.
7. Cashiers cannot discount, refund or verify bank transfers.
8. Unverified transfers cannot be refunded or counted as confirmed collections.
9. Duplicate live bank references cannot create another payment or stock deduction, including case/space variations.
10. Rejecting a transfer restores reserved inventory exactly once.
11. Cash shifts reconcile sales and refunds, record shortages, and block cash checkout after closure.
12. Another business cannot access receipts or supply foreign items/customers.

The regular suite additionally checks malformed money, exact client minor-unit arithmetic, stale/incorrect prices and totals, sufficient cash, service staff assignment, invalid permissions, tenant validation, receipt content, bounded serialization retries, daily report filtering, query validation and unauthenticated checkout endpoints.

## Resolved failures

The original duplicate `shift` declaration prevented API compilation. Initial verification also caught nested Prisma create-input mismatches, FlatList empty/footer typing errors, and tests incorrectly substituting serialized money strings for database Decimal values. These were corrected; none remain failing in the final checks.

## Manual tests still required

No Android device was attached when `adb devices -l` was checked. Physical Android touch interaction, keyboard behavior, Android share sheet, real customer cash handling and real bank-credit verification have not been manually certified. The iOS Expo Go account-sign-in error is an Expo login prerequisite and does not establish an application test result. Neither real card processing nor offline checkout is implemented.

Follow [the exact Android setup and acceptance checklist](./POS_CHECKOUT.md). The optional demo-seeding command was syntax-checked but intentionally not run to leave persistent demo accounts in your database.
