# Offline-first cash checkout (Android v1)

## Implemented scope

Use **Sync Status / Open offline cash checkout** for the Android durable cash flow. It always saves a local operation before returning a receipt, whether the API is currently reachable or not. The existing online checkout, sales history and refund screens remain online workflows; they are not converted into a general-purpose bidirectional cache. Web/iOS offline cash, appointments, offline refunds, electronic payments and offline discounts are excluded.

The server remains authoritative. A local success means **cash was recorded durably on this device**, not that PostgreSQL accepted a final invoice.

## Policy

| Control | v1 policy |
| --- | --- |
| Device registration | Owner/manager online registration; at most 3 active offline devices per business |
| Authorized user | Current business member with checkout permission, prepared online on the registered device |
| Session | Up to 8 hours, also bounded by the online refresh-session expiry at issuance |
| Catalog freshness | 4 hours, never beyond session expiry; refresh online to extend catalog freshness within the same session |
| Branch and shift | Bound to one branch and an already-open online cash shift |
| Sale limit | LKR 100,000 per sale |
| Session limit | 50 locally recorded sales, at most LKR 250,000 total |
| Customers/adjustments | Walk-in, whole-unit quantities, no discounts, no refunds |
| Upload grace | Sale must be recorded within its authorization; uploads accepted up to 7 days after session expiry |
| Final pricing | Current server price and the recorded expected price must match, or the operation becomes conflicted |
| Stock | Local cached stock is conservatively reduced by unacknowledged records; authoritative server stock may still conflict |
| Automatic retry | Foreground only, network-change/foreground events and a 15-second tick; exponential delay plus jitter, capped at about 5 minutes |
| Login expiry | Existing valid offline grant may outlive the short access JWT. Uploads require a live authenticated session for the same user/business |
| Sign-out | Locks local offline checkout without deleting cash records; server sign-out revokes that user's offline grants in this business |
| Shared till | A device cannot switch to another user/branch/shift during its active eight-hour grant. Register as manager first, then let the cashier prepare |
| Conflict/rejection | Immutable financial record; active local grant locks. No auto-repricing, deleting cash, force retry or replacement operation ID |

Refreshing the same grant does not reset its consumed budget. The server returns acknowledged operation IDs so refreshed server counters and locally retained records are not counted twice. Revocations cannot reach a disconnected phone immediately; the lease and amount limits bound that exposure. If a device is revoked, new uploads are rejected. Exact previously synchronized operations can still replay their confirmed result for the same authenticated owner/device.

## Storage and security

- Expo SQLite stores the catalog snapshot and cash outbox. WAL and FULL synchronous mode are enabled. An exclusive transaction commits the immutable operation and clock checkpoint before local success is returned.
- Financial payloads, item/staff data, provisional receipts and final server results are AES-256-GCM encrypted using Expo Crypto. AAD binds each payload to its account/business and operation ID. SQLite keeps non-secret operational metadata (IDs, state, retry counters/timestamps) in ordinary columns.
- AES keys and per-business device credentials are in Expo SecureStore with device-only/unlocked accessibility where supported. Access/refresh tokens remain in the existing SecureStore adapter, never SQLite.
- Losing the encryption key fails closed and preserves the encrypted database; the app does not silently reset pending financial records.
- Queues are scoped to the signed-in user and business. Changing accounts does not erase earlier records and does not expose their data to the new account. Signing back into the original account restores access.
- All unresolved rows remain stored; the UI also shows the 50 most recent synchronized rows. There is no automatic pruning of unsynchronized, conflicted or rejected cash.
- No device secret or access token is placed in query strings. The API logger redacts both authorization and offline-device-secret headers.
- Production authorization and synchronization require an HTTPS API URL. Development Metro sessions may use the existing LAN API.
- The device clock is checked against downloaded server time and a persisted high-water mark. This is a guard against ordinary clock errors, not cryptographic proof of the real time of a disconnected transaction.

## Synchronization behavior

1. Record a UUID operation with its original grant, device, recording time, cash tender, line quantities/prices/staff and exact expected total.
2. Encrypt and commit the operation in SQLite. Only then display LOCAL-<operation UUID> and a clearly provisional receipt. No SAL/server receipt number is invented.
3. Probe actual API/database health. A connected Wi-Fi link or internet-reachable flag alone is insufficient; LAN API reachability is checked directly.
4. Claim one due operation. Persist syncing state and increment its retry counter.
5. Send the unchanged operation with the registered device credential and current account authentication.
6. PostgreSQL verifies the device, grant, recording window, catalog, actor permission, original shift, limits and current stock/prices. A SERIALIZABLE transaction creates one sale/payment, deducts stock, consumes grant budget, writes the origin audit and stores the synchronized response.
7. A repeated operation returns its original stored result. Changed content under the same ID is rejected. JSON object property order does not create a different financial request.
8. Transient network, rate-limit and server errors return to pending with persisted backoff. A crash while syncing is recovered to pending on startup.
9. Authentication failures become blocked pending reauthentication/manual retry. Permanent validation/authorization errors become rejected; financial price/stock/shift/key errors become conflicted. Neither terminal state can be changed by Retry.
10. Receipt sharing is separate from queue recording and synchronization. Sharing failure never creates another cash operation.

Server reports recognize a synchronized offline cash payment at the server's verification/synchronization time. The offline collection time remains in the operation journal and sale audit. This v1 does not retroactively rewrite closed daily reports or cash shifts. If the original shift was closed, the operation conflicts and requires reconciliation.

## Initial Android setup

1. Update/install the SDK 58 native application after installing the new Expo Network and Crypto modules. An older custom binary must be rebuilt. Expo Go is useful for foreground development, but is not the acceptance environment for a reliable cold start without Metro.
2. From the repository root, stop the API before generating Prisma on Windows if its DLL is locked, then run in Command Prompt:

```cmd
npm install
npm run api:prisma:generate
npm run api:prisma:migrate
npm run api:dev
```

Keep the API running. The migration adds device, grant and operation-journal tables without resetting existing data.

3. Start the app on Android. For Metro/LAN development:

```cmd
npm run start -- --lan
```

Keep computerIp in src/config/env.ts set to your computer's active Wi-Fi IP and use the same network. Web is online only.

4. Sign in as manager/owner. In Sync Status, register this device with a recognizable till name. If a cashier will use it, register only; sign out before preparing a grant. The cashier signs in with their own verified account.
5. Open a cash shift online in Checkout. Choose the same branch in Sync Status and tap **Download catalog and offline authorization**. Wait for confirmation that the encrypted snapshot was saved.
6. Open **Offline cash checkout**. Cached services require an assigned authorized staff member. Review locally before accepting cash, then confirm recording. Any local storage/authorization failure prevents a success receipt.

## Installed APK for offline restart acceptance

Use the included eas.json offlinePreview profile, which embeds the JavaScript bundle in an APK. This step creates a cloud build only when you run it yourself; no cloud build or app publication was performed here.

Provide a reachable HTTPS development/staging backend first. Release-mode APKs deliberately do not use the __DEV__ LAN-IP fallback. Configure the public API URL in EAS's preview environment:

```cmd
npx eas-cli@latest login
npx eas-cli@latest env:create --environment preview --name EXPO_PUBLIC_API_URL --value https://YOUR-STAGING-API --visibility plaintext
npx eas-cli@latest build --platform android --profile offlinePreview
```

Complete Expo project/package/signing setup if prompted and install the resulting APK on the Android phone. Never put DATABASE_URL, SMTP credentials or JWT signing secrets in EAS public variables. Read the [Expo APK guide](https://docs.expo.dev/build-reference/apk/).

## Exact offline acceptance checklist

Use a separate demo/test business; the optional existing api:pos:demo command creates test identities/items. Do not perform test cash collections in the real business.

1. Prepare the registered till online, as above. Add a product and/or service in Offline cash checkout, assign staff, and enter cash tender.
2. Disable Wi-Fi and mobile data. The indicator must show API unreachable. Review and confirm the cash record. Verify a LOCAL- receipt appears only after durable storage succeeds.
3. Force-stop the installed APK, keep the phone offline, and reopen it. Sync Status must retain the pending operation and its original UUID and provisional receipt. The app must not require Metro to load its JS.
4. Reconnect. Leave the app in the foreground or use **Check connection and synchronize**. The same row must become synchronized and show a final SAL- receipt and server sale ID.
5. Simulate a lost response/repeat upload with the automated PostgreSQL and queue tests. One operation must produce one server sale/payment/stock deduction, even when requests are concurrent.
6. Let the access JWT expire. With a still-valid offline grant, local collection remains limited to the grant window. A failed upload requiring login becomes blocked; sign in to the same account and retry without changing the UUID.
7. Once the four-hour catalog deadline or eight-hour grant deadline passes, local review/recording must fail without a new receipt. Clock rollback beyond tolerance must also block recording.
8. After downloading the catalog, change a price on the server. Record against the original cached price, then reconnect. The operation must become conflicted, retain the original cash amount and provisional receipt, and acquire no final invoice. Restoring the price and tapping Retry must not silently rewrite that terminal outcome.
9. Stop the API or return a temporary 503 during upload. The original row must remain durable, show pending and a future retry time, survive force-stop/reopen, and synchronize after the API is restored.
10. Revoke the registered device as manager while the phone is offline, then reconnect. A new upload must be rejected and kept for reconciliation. Registration requires a manager and a fourth active device must not be allowed.
11. Attempt an electronic payment, discount, foreign-branch item/customer or offline refund. The offline flow must not permit these operations.
12. Attempt to close a shift on this phone while local operations remain unresolved. The UI must block it. If another device already closed it, synchronization must show a shift conflict rather than silently moving the cash into another drawer.
13. Sign out. New offline collection must lock; earlier encrypted rows must remain. Signing back into the original account permits viewing and retrying eligible records. Another account must not see the old receipts.
14. Cancel Android receipt sharing. The cash row must remain saved and its UUID unchanged.

## Automated tests

```cmd
npm run api:test
npm run api:typecheck
npm run api:build
npm run typecheck
npm run lint
```

The regular suite includes a real SQLite-file queue test with AES-GCM encryption and close/reopen durability, plus backend authorization and replay tests. It uses Node's SQLite and crypto adapters to test the shared queue/processor without React Native.

Run the actual PostgreSQL transaction suite separately:

```cmd
set "CHECKOUT_DATABASE_TESTS=1"
npm exec --workspace @salonos/api -- jest --runInBand --runTestsByPath test/checkout.postgres.spec.ts
set "CHECKOUT_DATABASE_TESTS="
```

It creates a UUID-isolated test business, tests real concurrent synchronization and rollback, then deletes its own test rows. It reads the configured development database or POS_TEST_DATABASE_URL. Do not point test fixtures at production.

## Limits before production deployment

This is a bounded offline cash workflow, not a guarantee of final sale acceptance while disconnected.

- A physically collected sale may later conflict on price, stock, authorization or shift state. A manager/accountant needs a written reconciliation procedure; v1 deliberately offers no force-accept, silent rewrite, deletion or automated conflict resolution.
- Stock is not globally reserved across disconnected tills. Concurrent offline devices can sell the same stock; one may be rejected/conflicted by PostgreSQL.
- A disconnected phone cannot immediately learn of revocation. No device attestation, MDM enrollment or independent hardware timestamp proof is implemented.
- Foreground synchronization is implemented. Android background-job scheduling, unattended uploads while force-stopped and server push revocation are not.
- Uninstalling/clearing app data, losing device credentials or losing the SecureStore encryption key can make unsynchronized cash unrecoverable. There is no secure external queue backup/recovery in v1. Protect and reconcile devices before replacement.
- Expo Crypto/SecureStore/native SQLite integration, device lock/reboot behavior, disk-full behavior and tamper resistance still require physical Android acceptance testing. Automated SQLite/crypto adapters do not certify the native keystore or Android filesystem.
- A proper embedded-bundle APK, reachable HTTPS backend, production credentials, managed device passcode/lock policy, audit retention/export, operational monitoring and staff training are prerequisites. No production deployment or cloud APK build was performed.
- Existing online POS is still online-only. Offline cash is explicitly entered through the prepared Android offline till. There is no general-purpose bidirectional sync or offline appointment scheduling.

See [the complete test results](./OFFLINE_TEST_RESULTS.md) for counts, passing scenarios and physical-device testing limits.
