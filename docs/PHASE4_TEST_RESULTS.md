# Phase 4 validation and review

Run date: 2026-10-27, Windows, Node 24.21.0, Prisma 6.19.3, Next.js 16.4.3. Database tests use UUID-isolated development tenants and delete their own records.


## Exact results

| Check | Result |
| --- | --- |
| Regular API suite, npm.cmd run api:test | PASS: 80 tests, 9 suites; 29 opt-in PostgreSQL tests skipped in this command; 16.987 s |
| Opt-in PostgreSQL suite, final run | PASS: 29/29 tests, 1 suite; 308.912 s; zero failed/skipped |
| Edge browser suite, last completed run | 2 passed, 1 failed; 1.3 min |
| Browser mobile bottom-sheet checkout + pending transfer + authorized void | PASS |
| Browser HttpOnly cookies + CSRF + cross-tenant denial + cashier refund denial | PASS |
| Browser desktop cash checkout/receipt/refund/reconciliation | FAILED at exact customer-label lookup before payment; see below |
| API production build | PASS |
| Next.js webpack production build | PASS, including TypeScript and route generation, before the final aria-label-only edit |
| API typecheck | PASS |
| Expo/mobile typecheck | PASS |
| Next.js typecheck (after final label edit) | PASS |
| Expo/mobile lint | PASS, no warnings/errors |
| Next.js lint (after final label edit) | PASS, no warnings/errors |
| API lint | PASS exit code 0: 0 errors, 5 existing warnings in auth.service.ts, salon.service.ts, auth.service.spec.ts, health.e2e-spec.ts |
| Prisma generate and schema validate | PASS |
| Phase 4 migration deployment | PASS: 20261027020000_transactional_pos applied to configured development database |
| git diff --check | PASS (line-ending notices only) |

The last desktop browser failure was locator.selectOption timing out on getByLabel('Customer', { exact: true }); the actual customer select was visible. Its accessible name now has an explicit aria-label, and the test uses a role/name locator. This source fix passed lint/typecheck. The approval dialog declined stopping/rebuilding the local web server and then declined the final browser rerun, so the corrected desktop browser flow and the final label-only production rebuild are **not verified**. Do not interpret the two passing browser tests as a full desktop acceptance pass. API-level cash checkout, receipt snapshots, refunds, and shift reconciliation passed against real PostgreSQL.

Earlier test runs exposed and resolved: outdated unit mocks after adding branch balances/commands; an array-to-object proxy bug; empty API responses for no open shift; the wrong shift-opening route; and a startup race allowing actions before branch selection loaded. Earlier failures are superseded by the results above, except for the desktop browser rerun that remains pending.

All requested integration scenarios passed: normal cash checkout; mixed product/service checkout; concurrent duplicate requests; invalid prices/quantities; unauthorized refunds; partial and concurrent over-refund prevention; stock decrement/contention; transaction rollback after audit failure; cash shift reconciliation; cross-tenant denial. Added passing cases cover two-branch isolation, tax/discount snapshots, sequential receipts, idempotent voids/stock adjustments/payment commands, negative-stock policy, and report cutoff reproducibility. Seven existing offline PostgreSQL cases were retained as regression checks; no offline feature was added.

The dependency installation reported 12 advisories (2 moderate, 10 high). No dependency audit remediation or production security certification was performed in this phase. Physical Android and printer testing were not run. The local API and Next.js test servers remain running because the server-stop request was declined; their most recent build predates only the explicit customer aria-label edit. No code was committed, published, or deployed.

## Start the application

From D:\react native apps\saloonOS, in Command Prompt or PowerShell:

~~~text
npm.cmd install
npm.cmd run api:prisma:generate
npm.cmd run api:prisma:migrate
npm.cmd run api:dev
~~~

Leave the API running. In another terminal:

~~~text
npm.cmd run pos:web
~~~

Open http://localhost:3001 and sign in with a verified account. This is the new Next.js POS, separate from Expo web on port 8081. API_URL can be set once in apps/web/.env.local if the API is elsewhere; use apps/web/.env.example as the template. Restart Next.js after changing it. CORS does not need port 3001 because requests go through the same-origin BFF.

Optional realistic demo business (creates a new isolated business each time, never resets existing accounts):

~~~text
npm.cmd run api:pos:demo
~~~

The script prints random local-only owner, manager, cashier, and stylist demo credentials. It creates Colombo/Kandy branches, Sri Lankan fictitious customers, services from LKR 1,200, retail products from LKR 1,850, opening branch stock, staff assignments, and a Kandy price override. Tax defaults to zero; the tax fixture used in tests is a calculation example, not a tax configuration recommendation.

## Repeat automated checks

~~~text
npm.cmd run api:test
npm.cmd run lint --workspace @salonos/api
npm.cmd run api:typecheck
npm.cmd run api:build
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run pos:web:typecheck
npm.cmd run pos:web:lint
npm.cmd run pos:web:build
~~~

PostgreSQL integration tests explicitly opt in. Use a disposable development database whenever possible. POS_TEST_DATABASE_URL overrides the configured development URL; migrations must already be deployed to that database.

Command Prompt:

~~~bat
set "CHECKOUT_DATABASE_TESTS=1"
npm.cmd run test --workspace @salonos/api -- --runTestsByPath test/checkout.postgres.spec.ts
set "CHECKOUT_DATABASE_TESTS="
~~~

PowerShell:

~~~powershell
$env:CHECKOUT_DATABASE_TESTS="1"
npm.cmd run test --workspace @salonos/api -- --runTestsByPath test/checkout.postgres.spec.ts
Remove-Item Env:CHECKOUT_DATABASE_TESTS
~~~

Browser tests require the API on 3000 and the Next.js app on 3001, both using the same migrated development database. They use installed Microsoft Edge in headless mode:

~~~text
npm.cmd run test --workspace @salonos/web
~~~

If Edge is absent, install Playwright Chromium and change channel in apps/web/playwright.config.ts. Browser fixtures create their own verified users and clean them up. Test traces can contain test-session cookies; generated test-results/ is gitignored.

## Manual review

1. Sign in as demo owner, select Colombo, open Cash shift with LKR 5,000.
2. In Checkout, search Hair; add Precision Haircut and assign a stylist. Add Coconut Repair Shampoo, select Sanduni, enter an authorized discount, and review the server total.
3. Enter cash tender, confirm once, and inspect the final receipt. Print/save PDF. Open Sales and verify the line price/tax snapshots.
4. Refund part of a confirmed sale with a reason. Confirm available refundable amount falls. Stock must not change until an inspected return is recorded as an inventory adjustment.
5. Record a bank transfer with a unique reference. Confirm it is Unverified, has no refundable amount, and is excluded from confirmed collections. Verify actual funds as owner/manager or void the unpaid sale with a reason.
6. In Inventory, create an item, record delivery stock, set a branch price/tax label, and inspect the movement history. REJECT prevents insufficient-stock sales. Switching to ALLOW_NEGATIVE is explicit and audited.
7. Compare Reports with cash shift cash sales/refunds. Close the shift with a physical count; inspect the difference. Cash checkout must then be blocked.
8. Sign in as cashier: discount, refund, void, verification, and management controls are absent; direct API attempts must return 403. A cashier without an active branch staff assignment cannot trade.
9. Resize to 390 x 844: open the bottom-sheet cart, review tender/reference, complete a sale, and inspect success/failure states.
10. Review Audit for sale, refund, void, external verification, stock, price, and shift events.

## Production limits

Only browser viewport emulation is automated; a physical Android device, native printer, and real bank settlement were not tested. Amount-based refunds record an authorized financial return; operators must actually return funds and separately count saleable returned goods. Existing appointments/offline features are not extended by Phase 4. Customer search currently returns up to 50 entries and history is paginated. Inventory/audit lists show the latest 100 entries; archive/export workflows are not implemented.

Use HTTPS, backups, reviewed database access controls, stable branch codes, and validated business-specific tax settings before production. Legacy multi-branch stock needs an explicit opening count. See PHASE4_ARCHITECTURE.md for historical migration and report-cutoff limitations. This change is left local for review; it is not deployed.
