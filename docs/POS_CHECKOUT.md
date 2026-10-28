# SalonOS online POS checkout

The Checkout and Sales tabs use the existing Nest API and PostgreSQL database. All final prices and totals are calculated by the server using Prisma Decimal. The mobile display uses bigint minor units and sends decimal strings. Quantities are whole units.

## Start on a physical Android phone (Windows Command Prompt)

1. Stop the API with Ctrl+C before generating Prisma Client, to release its Windows DLL.
2. In a Command Prompt at the repository root, run:

   ```cmd
npm run api:prisma:generate
npm run api:prisma:migrate
npm run api:dev
```

   Keep this API terminal running. The migrations preserve existing rows.
3. In another Command Prompt, run:

   ```cmd
curl http://127.0.0.1:3000/v1/health
ipconfig
```

   Health must return status "ok" and database "connected". Find the active Wi-Fi IPv4 address in ipconfig.
4. Put the phone and computer on the same Wi-Fi. Edit computerIp in src/config/env.ts to that IPv4 address. Keep localApi.enabled true and port 3000.
5. Open http://YOUR-COMPUTER-IP:3000/v1/health in Chrome on the phone. It must return the same successful health response. If it cannot, check network isolation and Node firewall access before testing the app.
6. Start Expo in the second terminal:

   ```cmd
npm run start -- --lan
```

   If Expo is already running, reload the existing project instead of starting a second instance.
7. Open Expo Go and scan the QR code. After changing computerIp, save the file and reload Expo Go.
8. Sign in with your verified email address and password. A cash shift and service staff assignment are required before confirming a cash sale with a service.

## Optional, reproducible test business

To avoid mixing test receipts with real business data, create a separate demo workspace once:

```cmd
npm run api:pos:demo
```

This creates a labeled demo business, branch, customer, active stylist, a LKR 100.25 service, and a tracked LKR 19.99 product with stock 5. It prints verified owner, cashier, and stylist emails plus a random temporary password in your terminal. No email is sent. Log in with those credentials. Do not reuse this business for real transactions. Each invocation creates a new isolated demo business; it does not reset existing data. The command refuses to run when NODE_ENV is production.

Owners/managers can also add service or product catalog items through POST /v1/checkout/catalog in /docs. priceLkr and stockQuantity are strings. Existing salon services remain available in the POS catalog.

## Android acceptance checklist

Use the demo OWNER unless a step specifies another role.

1. Open Checkout. Open a cash shift with starting cash 200.00.
2. Search for Hair, Precision, Care, and Shampoo. Category chips must filter by service/product/category. Pull down to refresh.
3. Add one Precision Cut and two Daily Shampoo. Open the bottom-sheet cart. Change quantities with the 48-point controls; reducing to zero removes an item. Assign Demo stylist to the service and select Demo Customer.
4. Enter discount 0.49 and cash received 200.00. Tap Review payment. The server total must be 139.74 and change 60.26. Tap Confirm cash received once. A successful cash receipt must show those values.
5. Tap Share receipt. Confirm Android opens its share sheet. Cancel sharing: the sale must remain saved. Open Sales, view the same receipt, and share again. A sharing error must never resubmit checkout.
6. In Checkout, check that shampoo stock is now 3 and the cash drawer expected amount is 339.74.
7. In Sales, open the receipt and issue a partial refund of 39.98 with a reason. The remaining refundable amount is 99.76. Inventory remains 3: amount-only refunds do not imply physical product returns. A refund exceeding the remaining confirmed amount must fail.
8. Open another product sale with quantity one, select Bank transfer, and enter a unique reference. Review and record it. It must say pending and NOT confirmed payment. Stock is reserved (2). The transfer must contribute zero to confirmed collections and cannot be refunded.
9. In Sales, review the transfer. On test data only, use Reject transfer to simulate a failed bank credit: the sale becomes voided and reserved stock returns to 3. For a different test sale, confirm verification only after independently checking the bank credit. Verification does not call a bank API.
10. Try reusing a live bank reference in another sale (case and surrounding spaces must not bypass duplicate detection). It must fail without another stock deduction or payment.
11. In Checkout, close the cash shift using the actual counted cash. After only the cash sale and its partial refund above, expected cash is 299.76. Entering 299.00 records a shortage of 0.76. Another cash checkout must fail until a shift is reopened.
12. Log out and use the demo CASHIER. Checkout and sales history should work, but discounts, refunds, bank verification and daily reports are restricted. Use the demo STYLIST: checkout must be denied.
13. As owner, Sales shows a date-selectable report in the branch timezone. Confirm collections, refunds paid, net collections and pending transfer counts. A transfer verified on a later day belongs to that later day's collections; a refund belongs to the day it is paid.
14. Change an item's price with the management API after adding it to the cart. Review/payment must reject a stale expected price. Tap Refresh cart prices, review again, and confirm. Existing receipts must retain the old unit prices and names.
15. Stop the API before a new confirmation attempt. The app must show a connection problem without claiming success. Restart the API and use Retry safely on the same cart. Never manually create a second sale to resolve an uncertain result. The server reuses the original checkout result for the same key and payload.
16. Disconnect Wi-Fi. Catalog/quote/payment requests must show failure. The regular online POS does not queue payments. Use the separately prepared Android offline cash till described in OFFLINE_CASH.md.

Manual physical-device checks require a connected phone and are not replaced by the automated tests.

## Expo Go sign-in error on iPhone

If Expo Go says both Expo CLI and Expo Go must be signed in, stop the Expo terminal with Ctrl+C, then run these in Command Prompt:

```cmd
npx expo login
npx expo whoami
npm run start -- --go --lan --clear
```

Sign in to Expo Go on the iPhone with the same Expo account, then scan the new QR code using the iPhone Camera app. Keep the API in its separate terminal. This is your Expo account, not a SalonOS customer account; do not put Expo login credentials in the application's `.env` file. See [Expo CLI documentation](https://docs.expo.dev/more/expo-cli/).

## Integrity and reporting behavior

- The server ignores client arithmetic and validates expected catalog prices and totals. It rejects overprecision, invalid amounts, insufficient cash, invalid branch/customer/staff assignments, and unauthorized operations.
- Checkout, inventory deduction/reservation, one payment, receipt snapshots, and audit records commit in a single SERIALIZABLE transaction. Serialization conflicts retry with bounded attempts.
- Checkout keys are retained across retries and bound to the exact payload and actor. Reusing a key for a different request is rejected. Refunds also require idempotency keys.
- Unique constraints prevent duplicate receipts, payments, refund requests, concurrent open drawers and live bank references. Pending bank transfers are never confirmed collections.
- Pending transfers reserve stock; rejecting one releases its recorded reservation exactly once. Financial refunds do not automatically restock products.
- Cash receipts and cash refunds reference their cash shift. Closure stores counted cash, expected cash and the difference, with an audit event. Cashiers can close their own drawer; owners/managers can close a shared drawer.
- Historical unit prices and item names/types are stored on each sale line. Receipts include line quantities/prices, discount, payment state, cash/change and refund totals.
- Gross sales reflect settled sales created during the day. Collections are grouped by the actual verification time; refunds by their actual payment time. Net collections = confirmed collections minus refunds paid. These measures can differ on days when older transfers are verified.
- Receipt sharing is plain text through the Android system share sheet; web copies to the clipboard when native web sharing is unavailable.
- Legacy cash sales without a shift link are not retroactively assigned to a new drawer.

## Automated checks

Regular checks (no real database writes):

```cmd
npm run api:test
npm run api:typecheck
npm run api:build
npm run typecheck
npm run lint
npx expo export --platform android --output-dir .expo/checkout-android
npx expo export --platform web --output-dir .expo/checkout-web
```

Run the database suite explicitly in Command Prompt:

```cmd
set "CHECKOUT_DATABASE_TESTS=1"
npm exec --workspace @salonos/api -- jest --runInBand --runTestsByPath test/checkout.postgres.spec.ts
set "CHECKOUT_DATABASE_TESTS="
```

It reads apps/api/.env (or POS_TEST_DATABASE_URL if supplied), creates a UUID-isolated test business and users, and removes its test rows in afterAll. It does not touch existing business rows, send email or call a bank. Do not run demo/financial test transactions against a production database. The suite covers actual concurrent duplicate checkout, last-item stock races, forced rollback, partial/concurrent refunds, duplicate bank references, transfer rejection and verification, permissions, tenant separation and cash reconciliation.

The regular suite skips the opt-in database tests; the database suite is run separately and must be reported separately. See POS_TEST_RESULTS.md for the latest results and manual testing limits.
