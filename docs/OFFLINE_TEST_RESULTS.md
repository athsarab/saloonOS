# Offline cash verification results

Updated 2026-10-27 (Asia/Colombo).

## Final checks

| Check | Result |
| --- | --- |
| Regular API/client-domain suites | 79 passed, 0 failed, 9 suites |
| SQLite durable queue and processor tests (included above) | 12 passed |
| Offline server authorization/replay unit tests (included above) | 15 passed |
| Explicit PostgreSQL transaction suite | 17 passed, 0 failed |
| Final targeted PostgreSQL offline recheck after canonical hashing changes | 5 passed, 0 failed; these are a subset, not five additional unique tests |
| Total unique executed tests | 96 passed, 0 failed |
| API TypeScript and Nest build | Passed |
| Mobile TypeScript | Passed |
| Expo lint | Passed without errors or warnings |
| Prisma generation/schema validation | Passed |
| Additive offline database migration | Applied successfully |
| Android production JS/Hermes export | Passed, .expo/offline-android |
| Web export/regression check | Passed, .expo/offline-web |
| Existing API health check | HTTP 200, database connected |

The regular test command skips the 17 opt-in database checks by design. They were run explicitly, not counted as passing because they were skipped. PostgreSQL fixtures used a separate UUID-isolated business and users and cleaned up their own rows. No real email or bank transfer was sent.

## SQLite/queue checks that passed

1. Record cash without a transport/internet dependency, close the database, reopen it and restore the same operation before synchronization.
2. Preview locally without recording a sale or consuming queue capacity.
3. Reconnect and receive a final server receipt.
4. Lose the response after a simulated server acceptance, restart the queue, and retry the exact ID/payload without a second simulated server sale.
5. Recover an interrupted syncing row to pending after restart.
6. Preserve the original queue row during 503/network failures, persist attempts/due time, apply bounded exponential backoff and do not retry early.
7. Block expired-authentication uploads without dropping the local cash operation; manual retry preserves its identity.
8. Keep conflicted/rejected financial records unchanged even after manual Retry.
9. Reject stale catalogs, expired offline sessions and clock rollback without showing success.
10. Enforce cash-only/no-discount policy, authorized service staff, local stock, sale-value and session-count/value limits.
11. Refresh acknowledged server counters without counting the same locally retained sales twice.
12. Encrypt payloads/item labels in a real SQLite file, reject swapped AAD contexts, isolate accounts, and roll back an injected local write failure.

The shared queue/processor runs against Node SQLite and AES-GCM adapters in these tests. This is real file persistence and encryption testing, not a certification of native Android SQLite, Expo Crypto or the platform keystore.

## New actual PostgreSQL offline checks that passed

- Concurrent repeated uploads commit one sale, one payment, one stock deduction and one consumed authorization unit.
- A changed live catalog price produces an immutable conflict; no sale/payment/stock write occurs, and later restoring the price does not silently change the recorded outcome.
- Expired recording windows produce rejected records without invented invoices; closed original shifts produce conflicts.
- A forced late server write failure rolls back sale, stock, operation and authorization counters. Retrying the same operation then succeeds.
- Revoked registered devices cannot upload new cash operations.

The other 12 PostgreSQL checks continue to cover normal cash/service checkout, price history, duplicate online checkout, stock contention, financial rollback, partial/concurrent refunds, permissions, pending transfers, duplicate references, stock release, cash reconciliation and tenant separation.

## Operational policy tested

Server-authorized registration; three active devices; eight-hour grants; four-hour catalog freshness; LKR 100,000 per sale; 50 sales and LKR 250,000 per grant; seven-day delayed-upload grace; current authentication required to upload; final prices/totals remain server-authoritative.

## Manual acceptance and deployment limits

Physical Android flight-mode collection, force-stop/reboot recovery with an embedded APK, native keystore/AES behavior, real disk-full conditions, lock-screen accessibility and Android sharing remain to be performed on a phone. No EAS cloud build, deployment or production certification was performed.

Use [the setup and full Android offline checklist](./OFFLINE_CASH.md). An installed APK with an embedded bundle and a reachable HTTPS API is required for reliable release-mode cold-start testing; Expo Go/Metro alone does not prove that behavior. Financial conflicts need an explicit manager/accountant reconciliation procedure. No offline refunds/electronic payments, background job scheduler, device attestation, external queue recovery, general bidirectional synchronization or offline appointments are implemented.

## Resolved development failure

The new Sync Status screen initially used Date.now directly during render, which Expo lint rejected as impure. It now renders the persisted due time or a stable explanation. There are no remaining failures in the checks above.
