# Phase 4: transactional POS core

## Scope and layout

The existing Expo app remains in app/ and src/. The new responsive Next.js App Router application lives in apps/web; NestJS and Prisma remain in apps/api. Next.js is a separate workspace on port 3001, Expo web remains on 8081, and the API remains on 3000. No appointments or offline synchronization were added in this phase. Pre-existing offline code is retained and regression-tested, not exposed in the Next.js workflow.

The financial engine is CheckoutService. PosService adds branch-aware catalog access, branch price maintenance, customer creation, inventory adjustments, stock policy, voids, and audit access. Both clients use the same PostgreSQL transactions.

## Financial invariants

- All prices, totals, tender, refunds, and reports use Prisma Decimal backed by PostgreSQL NUMERIC(12,2). HTTP money values are decimal strings. Integer cents and BigInt are used for discount allocation. No floating-point money arithmetic is used.
- Client prices/totals are expectations only. The server looks up active catalog records and branch overrides, then rejects stale expectations with 409.
- Quantities are positive whole units, bounded to 999999 per consolidated item/staff line. Identical item/staff lines are consolidated before rounding.
- Prices exclude tax. Order discount is allocated in integer cents using largest remainders, with stable item/staff ties. Tax is calculated after discount per consolidated line and rounded half-up to two decimals. Tax rate uses integer basis points (100 basis points = 1%).
- Sales snapshot item name/type, unit price, quantity, line discount, tax rate/label/amount, line total, branch name/address, and customer display name. Staff IDs remain linked. Later catalog changes never reprice historical sales.
- Checkout, payment resolution, refunds, voids, inventory movements, and financial audits run in SERIALIZABLE transactions. Serialization conflicts retry at most four times; a persistent conflict returns 409 and must be retried with the same key.
- Cash is confirmed at checkout, requires an open branch cash shift, and records tender/change. One payment method per sale is supported; split tender is not implemented.
- Bank transfers, card slips, and wallet references are manually recorded as PENDING. They are not collections and cannot be refunded until a manager verifies actual funds. These endpoints do not charge a card, contact a bank, or execute refunds externally.
- Cash refunds require an open shift in the sale's branch. Refunds may not exceed confirmed payments minus completed refunds. Partial refunds preserve original sale and payment amounts. Amount-only refunds do not restock goods; an authorized counted-return stock adjustment is separate.
- Only unpaid pending sales may be voided. Voiding/rejecting an external payment releases reserved product stock once. Paid sales require refunds.

## Isolation and permissions

Tenant comes exclusively from the authenticated, live server session; callers cannot submit tenantId. Composite tenant/branch/item foreign keys prevent cross-business stock and pricing references.

OWNER and MANAGER may use all branches in their business. CASHIER needs an active StaffProfile assigned to the selected branch. A cashier with no assignment has no branch access. Branch rules apply to quotes, checkout, replayed checkout requests, staff lookup, stock, shift access, receipts, and filtered sales history. Tenant membership is checked against the database on every authenticated request. STYLIST cannot check out.

Discounts and refunds require their existing permissions. New voids and payments.verify permissions are granted to OWNER and MANAGER. Catalog/stock changes and reports use existing management permissions. API guards enforce these restrictions even when controls are hidden in the browser.

Customers and catalog categories are business-wide. Categories use the existing catalog category field; the distinct category endpoint and searchable UI avoid introducing a competing catalog model.

## Idempotency and receipts

POST checkout/sales and POST checkout/sales/:id/refunds require idempotency-key (8-120 letters, digits, underscores or hyphens). Exact payload fingerprints prevent reuse for different operations. Payment resolution, voids, and stock adjustments use FinancialCommand with a tenant/key primary key, request hash, and result. External references are unique per tenant and method after trimming/case folding while a payment is live.

The legacy verify-transfer endpoint remains available and derives a stable resolution key for older clients. New clients must use POST pos/payments/:id/resolve with an explicit key.

A branch row counter increments atomically inside checkout. Receipts use the full branch code plus a minimum six-digit sequence, for example CMB-000001. The counter, sale, payment, inventory, and audit all roll back together. A duplicate request reuses the original number. Legacy SAL-UUID receipts remain unchanged. The sequence is unique per branch; a separate tenant-wide receipt-number constraint detects collisions. Branch codes should remain stable once trading begins. The counter is a PostgreSQL integer; capacity planning is required before approaching its limit.

The web app retains an uncertain checkout payload/key in sessionStorage before submission and offers Check / retry request. It never generates another payment key merely because a response was lost. This is online request recovery, not offline checkout. Do not clear an uncertain request or close its browser tab before checking sale history. Success is displayed only after an authoritative API result.

## Inventory

StockBalance(tenantId, branchId, itemId) is authoritative. InventoryMovement records signed delta, resulting balance, reason, actor, and optional sale. An SQL deferred composite sale FK allows stock movements and sale creation in the same transaction. No API edits or deletes movements.

REJECT is the default stock policy. A conditional balance decrement prevents overselling under concurrency. ALLOW_NEGATIVE is an explicit, audited branch management choice. CatalogItem.stockQuantity remains a compatibility aggregate for older mobile consumers; it is not used to decide branch availability.

Migration 20261027020000_transactional_pos is additive. It imports legacy global stock only for businesses with exactly one branch and writes opening movements. Multi-branch legacy stock cannot be assigned safely: count and adjust each branch before trading. New catalogs with multiple branches start at zero and must receive branch stock explicitly.

## Reporting

GET checkout/report/daily accepts branchId, date (YYYY-MM-DD), optional from/to timestamps (inclusive start, exclusive end), and optional asOf timestamp. Calendar dates use branch timezone, default Asia/Colombo. Responses include explicit boundaries, timezone, and cutoff.

Confirmed collections use Payment.verifiedAt; refunds use Refund.createdAt. Gross, discount, tax, and sale count derive from immutable sale snapshots associated with confirmations in the period, irrespective of the sale's later REFUNDED status. Pending count uses creation and resolution time at the cutoff. Repeating identical date/range/asOf inputs yields the same financial report after later verification or refunds. Without asOf, the cutoff is the time of the report. All-branch reports use Asia/Colombo.

Legacy branch/customer snapshots are backfilled from current records at migration time; earlier names cannot be reconstructed. Legacy resolved-payment timestamps without verifiedAt are approximated by createdAt. Deterministic historical pending counts before migration have that limitation. Audit records are append-only through application endpoints, not tamper-proof against direct database administrators.

## API additions

All paths below are prefixed /v1 and authenticated.

| Method and path | Purpose |
| --- | --- |
| GET pos/branches | Branches permitted to this operator |
| GET pos/catalog?branchId=UUID | Active items, effective branch price/tax, branch stock |
| GET pos/categories | Distinct active catalog categories |
| POST pos/branches/:branchId/prices/:itemId | Override price/tax/availability; priceLkr string, taxRateBps integer, taxLabel, active |
| POST pos/customers | firstName, optional lastName/phone/email |
| GET pos/inventory?branchId=UUID | Latest 100 branch stock movements |
| POST pos/inventory/adjust | Idempotent branchId/itemId/delta integer string/reason |
| POST pos/branches/:id/stock-policy | policy: REJECT or ALLOW_NEGATIVE |
| POST pos/sales/:id/void | Idempotent reason |
| POST pos/payments/:id/resolve | Idempotent status VERIFIED or FAILED and optional note |
| GET pos/audit | Latest 100 business audit entries |

Existing checkout routes remain: access, catalog, customers, staff, quote, sales, receipt, refunds, verify-transfer, report/daily, shifts/current, POST shifts, and POST shifts/:id/close. Global ValidationPipe rejects unknown fields, including injected totals.

## Web session boundary

The browser calls a same-origin Next.js backend route. API_URL is server-only and defaults to http://127.0.0.1:3000. Only fixed auth/checkout/pos route families are proxied. Access/refresh tokens are removed from response bodies and stored in HttpOnly, SameSite=Lax cookies, Secure in production. No token is stored in localStorage, sessionStorage, or SQLite by this new web app. The browser coordinates refresh requests and retries the original operation with its original idempotency key.

Mutating BFF requests require the same Origin as the Next.js origin. Production must preserve the public origin through its reverse proxy and use HTTPS. Receipt routes fetch authorized API data server-side and render escaped React content with print styles for 80mm-width content and browser PDF printing.

The existing Expo web token helper is separate and unchanged. Physical receipt printers, bank settlement automation, multi-currency, fractional retail units, split tender, item-level return accounting, full ledger accounting, and production tax certification are outside this phase.
