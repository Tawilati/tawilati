# Tawilati

QR table ordering for cafés and casual restaurants (SE-NEXT SaaS Challenge, "Table Order" brief, level Advanced).
A guest scans the QR code on the table, orders from their phone, the kitchen sees the order live, the waiter serves it and closes the bill.
Name: Tawilati (طاولتي, "my table"). Wordmark: `tawilati.` Tagline: "Good food, smoother service."

**Status (Oct 2026):** Next.js 16 app scaffolded (`src/app/`, Tailwind 4, TypeScript, Prisma 7 with the pg adapter in `src/prisma/`, client in `src/lib/db.ts`); repo at https://github.com/Tawilati/tawilati (branch `main`). The brand kit is committed in `brand/` but not yet wired into the app (see "Moving into the app" in `brand/README.md`). Review is after **8 November 2026**.

## Code layout and commands

- `src/app/api/**/route.ts`: route handlers. Wrap the body in `handle()` and parse input with `parseQuery()` (`src/lib/http.ts`); thrown `HttpException`s and Zod errors become `{ "success": false, "message": "<code>", "details?" }`, the same shape as `src/proxy.ts` and `authGuard`. The route wires the service to the real repository (`new MenuService(menuRepo)`).
- `src/proxy.ts`: JWT check on every `/api/*` route; public routes (login, register, `/api/menu`, `/api/guest-sessions`) are listed there. Staff identity arrives as `x-user-id`, `x-user-role`, `x-business-id` headers (`src/lib/auth/requestHelper.ts`, `authGuard` in `src/lib/auth/gaurd.ts`).
- `src/validation/`: Zod schemas. `src/service/`: business rules, classes taking their repository in the constructor and importing it as a type only (so unit tests never load Prisma). `src/repository/`: Prisma only, singleton classes (`XRepo.getInstance()`) implementing an interface the service depends on.
- Errors: `src/utils/exceptions/http/` (`HttpException(status, message)`; for API errors the message is the contract code, e.g. `new NotFoundException("invalid_qr")`, `new ConflictException("table_disabled")`).
- Path alias `@/` → `src/`. Ids are UUID strings.
- Tests: `*.test.ts` are unit tests (`npm test`, services with fake repositories); `*.int.test.ts` hit the database at `DATABASE_URL` (`npm run test:integration`), create their own businesses and delete them afterwards.
- Database: Postgres in Docker on port 5434 (5432 is taken by a local Windows Postgres on Souad's machine). `npx prisma migrate dev`, `npx prisma generate` (client in `src/app/generated/prisma`, gitignored), `npm run db:seed` (demo café, re-runnable, prints the menu links). Prisma config is `prisma7.config.ts`. After merging `main`, verify migrations with `npx prisma migrate reset --force` then `npx prisma migrate diff --from-config-datasource --to-schema src/prisma/schema.prisma --script` (must print an empty migration).

## Core flow (build first)

Table scans and orders → kitchen sees it live → waiter closes the bill.

## Version one must

- Menu opened from a per-table QR code, prices in USD and LBP
- Live kitchen screen; status updates for the waiter and the table
- Running bill per table
- Sold-out switch that applies to every open screen at once
- Daily sales report

Engineering heart: live updates (SSE or polling, a choice we must defend), several phones ordering for one table without duplicates, idempotent submission (a double tap never sends two kitchen tickets), menu changes mid-service.
Outcome to prove: order-to-kitchen time and order mistakes per service vs a baseline shift.
Stretch: split the bill by person. Scored extras: pricing page with test-mode checkout (Whish Money test or Stripe test), Arabic interface.

## Definition of done (checked at review)

1. Live at a public URL, deployed by CI that runs the tests on every PR
2. Next.js route handlers in TypeScript + Prisma; **repository layer separate from service layer**; validation (Zod) on every route
3. Multi-business: any business signs up into its own workspace; **a test proves one business cannot read another's data**
4. Sign-in with at least two roles
5. Comfortable on a phone
6. README (setup, architecture, key decisions), FR/NFR one-pager, ERD, OpenAPI contract
7. Unit tests on business logic, integration tests on main endpoints
8. 3-minute demo video + 60-second backup video

## Architecture rules

- Layers: route handler (auth + Zod parse) → service (business rules) → repository (Prisma only). Only repositories touch Prisma; services are unit-tested with fake repositories.
- **Tenant isolation:** every query filters by `session.businessId`. Never take `businessId` from the request body (ignore it if sent). Cross-tenant access returns 403/404.
- Role checks server-side in every endpoint before the service layer. Roles: `OWNER`, `WAITER`, `KITCHEN`.
- Staff auth: signed JWT in an HttpOnly, Secure, SameSite=Lax cookie holding `userId`, `businessId`, `role`. Every protected request re-checks `User.isActive` in the DB (deactivation must take effect immediately).
- Guest auth: `GuestSession.token` (32 random bytes hex) issued by `POST /api/guest-sessions`, stored in `sessionStorage`, valid while `revokedAt IS NULL AND expiresAt > now()`; `expiresAt = TableSession.openedAt + 4h`. Closing the tab revokes all its sessions.
- Money: `Decimal`, never float. `priceLBP = round(priceUSD × Business.exchangeRate)`, computed when an item is created or its USD price is edited; never recomputed on read. Order lines snapshot `priceUSD`, `priceLBP`, `rateSnapshot`.
- Passwords: bcrypt cost ≥ 10 (12 used in the spec). Emails normalised with `trim().toLowerCase()` before lookup and insert.
- Invalid login (unknown email, wrong password, deactivated) always returns the same generic 401.

## Data model (`src/prisma/schema.prisma`, matches the team's latest ERD)

The schema is the source of truth; this table summarises it. Ids are UUID strings.

| Model | Fields | Constraints |
|---|---|---|
| Business | id, name, slug, exchangeRate Decimal(10,4), timezone, createdAt | name unique; slug unique, set once at sign-up with `makeSlug(name, "cafe")` and never changed; rate > 0; timezone in allowlist (Asia/Beirut, Asia/Dubai, Europe/Paris, UTC) |
| User | id, businessId, name, email, passwordHash, role, isActive, isVerified, createdAt | email unique globally (one email = one account) |
| MenuCategory | id, businessId, name, createdAt | unique (businessId, name); delete blocked while it has items (409) |
| MenuItem | id, businessId, categoryId, name, priceUSD Decimal(10,2), priceLBP Decimal(12,2), soldOut, archivedAt, createdAt, updatedAt | category must be same business; archive is soft (archivedAt); FK to category is RESTRICT |
| DiningTable | id, businessId, label, slug, qrToken Char(64), isDisabled, createdAt | unique (businessId, label) and (businessId, slug); slug set once with `makeSlug(label, "table")`, never changed; qrToken unique, 32 random bytes hex, never rotates |
| TableSession (the tab) | id, businessId, tableId, status (OPEN/CLOSED), activeTableId, openedAt, closedAt, totalUSD, totalLBP, amountPaidUSD, amountPaidLBP | `activeTableId` is unique: set to tableId while open, null on close → at most one open tab per table (replaces the partial index of open issue 1) |
| GuestSession | id, sessionId → TableSession, token Char(64), expiresAt, revokedAt, createdAt | token unique |
| DiningOrder (one round) | id, businessId, sessionId, tableId, guestSessionId, status, totalUSD, totalLBP, createdAt | one per submitted round; carries the kitchen status |
| Submission | id, businessId, idempotencyKey, payloadHash, orderId → DiningOrder, createdAt | unique (businessId, idempotencyKey) |
| OrderLine | id, orderId → DiningOrder, menuItemId, qty, priceUSD, priceLBP, rateSnapshot, createdAt | qty ≥ 1; FK to MenuItem is RESTRICT |
| Payment | id, sessionId → TableSession, amountUSD, amountLBP, method (CASH/EXTERNAL_CARD), recordedById, createdAt | no idempotency key yet (the spec asks for unique (orderId, idempotencyKey)) |

**Customer menu link (what the QR code encodes):** `/menu/{business.slug}/{table.slug}?t={qrToken}`, e.g. `/menu/tawilati-demo-cafe/t1?t=1e64…`. The names make the address bar readable; the token is what authorises the table (without it anyone could order to any table by typing a URL). Slugs never follow renames, so printed QR codes keep working. Sign-up must reject a taken name or slug with 409 `business_name_taken`. Slug helpers: `src/utils/slug.ts`.

Round status (`DiningOrder.status`): `NEW → PREPARING → READY → SERVED`, strictly in that order (plus `CANCELLED`); anything else is 400 `invalid_transition` with no write. Kitchen moves NEW→PREPARING→READY; waiter moves READY→SERVED. Because status is per round, a second round on a tab shows up in the kitchen as its own NEW ticket (settles open issue 2). Closing the tab sets `TableSession.status = CLOSED`, `closedAt`, clears `activeTableId` and revokes its guest sessions in one transaction. Closed tabs are immutable. UI label for NEW in the kitchen is "New".

## Order submission (POST /api/orders, guest)

1. requireGuest (401 if missing, revoked or expired) 2. require `Idempotency-Key` header (400) 3. `payloadHash = sha256(canonical lines)` 4. look up Submission by (businessId, key): same hash → 200 with the original, no new lines; different hash → 409 `idempotency_key_mismatch` 5. load the session's order; not open → 409 `tab_not_open` 6. validate each line (item in business, not archived, not sold out, qty ≥ 1) 7. insert Submission 8. insert OrderLines with snapshots 9. update order totals 10. notify kitchen 11. 201 (new) or 200 (retry). All in one transaction.

## API (36 endpoints; the spec says 37)

| Area | Endpoints | Auth |
|---|---|---|
| Auth | POST /api/auth/register, POST /api/auth/login (public); POST /api/auth/logout, GET /api/auth/me | staff |
| Staff | POST, GET /api/staff; PATCH /api/staff/:id | OWNER |
| Business settings | GET /api/business (staff); PATCH /api/business (OWNER) | |
| Categories | POST, GET, PATCH /:id, DELETE /:id under /api/categories | GET staff, rest OWNER |
| Menu items | POST, GET, PATCH /:id, POST /:id/archive, POST /:id/unarchive under /api/menu-items | GET staff, rest OWNER |
| Sold out | PATCH /api/menu-items/:id/sold-out | OWNER, KITCHEN |
| Tables | POST, GET, PATCH /:id, POST /:id/disable, POST /:id/enable, GET /:id/qr (PNG) under /api/tables | GET staff, rest OWNER |
| Guest | GET /api/menu?b={business slug}&t={qrToken} (public, resolves QR); POST /api/guest-sessions (public); POST /api/orders, GET /api/orders/me (guest) | |
| Kitchen | GET /api/kitchen/orders | KITCHEN |
| Status | PATCH /api/orders/:id/status | KITCHEN, WAITER |
| Waiter | GET /api/waiter/tables | WAITER |
| Bill | GET /api/orders/:id/bill; POST /api/orders/:id/payments; POST /api/orders/:id/close | WAITER, OWNER |
| Reports | GET /api/reports/daily?date=YYYY-MM-DD (restaurant-local day) | OWNER |

Error codes used in the spec: `email_already_in_use` 409, `invalid_credentials` 401, `business_name_taken` 409, `invalid_role` 400, `invalid_exchange_rate` 400, `invalid_timezone` 400, `validation_error` 400, `invalid_qr` 404, `invalid_table` 404, `table_disabled` 409, `idempotency_key_mismatch` 409, `item_sold_out` 409, `item_archived` 409, `item_not_found` 404, `tab_not_open` 409, `invalid_transition` 400, `tab_not_settleable` 409, `amount_exceeds_outstanding` 409, `not_found` 404.

## Open issues in the spec (decide before coding)

1. **(Settled by the schema's `TableSession.activeTableId` unique column.)** **Bug:** the "one open tab per table" partial unique index is `WHERE status = 'OPEN'`, and guest-session lookup uses `status = 'OPEN'`. Once a tab moves to PREPARING, a second scan would open a second tab. Use `WHERE status <> 'CLOSED'` (or `closedAt IS NULL`) in both. Prisma can't express partial indexes: add it in a raw SQL migration.
2. **(Settled: status is per `DiningOrder` round.)** Status lives on the Order (tab), but a tab gets more submissions after the first (E-09). Decide what the kitchen sees when a second round arrives on a tab that is already READY or SERVED (per-submission status, or reset the tab to OPEN).
3. Live updates: the kitchen and waiter sequence diagrams poll every 2–3 s; the order flow says "Broadcast SSE to kitchen". Pick one and document the reasoning in the README.
4. JWT lifetime: 2 h in the A-03 note, 24 h (`Max-Age=86400`) in the register/login diagrams.
5. Default exchange rate at sign-up is 1500 in the diagram; the real rate is about 89,500 LBP per USD.
6. Kitchen status route: `/api/orders/:id/status` in the endpoint table, `/api/kitchen/orders/:id/status` in section 5. Typo `/api/menuitems/:id/unarchive` should be `/api/menu-items/:id/unarchive`.
7. Payments are only allowed once the tab is SERVED (`tab_not_settleable`); check this fits waiters taking payment before the last round is served.

## Brand and UI

Approved identity lives in `brand/` (source of truth: `brand/brand-guidelines.md` and `brand/reference/brand-board.png`; full book: `brand/guidelines.html`, PDF `brand/Tawilati-Brand-Guidelines.pdf`).

- **Never invent or change the logo.** Use the SVGs in `brand/logo/` (cup + amber Wi-Fi signal, Playfair Display wordmark with amber period). Never substitute an icon-library cup or Wi-Fi glyph.
- Colours: Forest Green `#254D3B` (primary actions, nav), Sage `#8BA88B`, Cream `#F8F5EC` (backgrounds), Amber `#E5A45B` (accents only), Charcoal `#202B26` (text). Use tokens from `brand/tokens.css`, never hard-coded hexes.
- Amber and Sage fail contrast as text on cream. For text use `--brand-accent-ink` / `--brand-secondary-ink`.
- Order status badges use the `--status-*` tokens and always show a text label.
- Fonts: Playfair Display only for the wordmark and marketing headings; Inter for all app UI. Neither has Arabic; an Arabic pairing is still undecided.
- Icons: `lucide-react` plus four custom icons (menu, tables, kitchen, reports) in `brand/icons/`. 24 px, 2 px stroke.
- Component reference styles: `brand/components.css` (buttons, fields, toast, menu item card, stepper, sidebar, badges). Rebuild them as React components on the same tokens.
- Mobile-first for guests; tablet-friendly kitchen and waiter screens; touch targets ≥ 44 px; prices with tabular figures, USD first then LBP.
- Voice: plain and friendly ("Scan to view the menu."). Never show error codes to guests or staff; map them to sentences.

## Regenerating brand assets

`brand/tools/gen-logos.mjs` and `brand/tools/gen-icons.mjs` rebuild `brand/logo/` and `brand/icons/` (setup steps in `brand/README.md`). After changing assets, republish the brand book from `brand/guidelines.html` to https://claude.ai/artifact/DS7CHCDioySP6nYcYzJVSV.
