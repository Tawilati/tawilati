# Guest cart and order submission: UI design

Date: 29 October 2026. Branch: `feature/ui-foundation`. Mockup: `.superpowers/brainstorm/766-1793308130/content/cart-flow-v2.html`.

## Intent

Guests at one table each scan the table's QR code and land on the same menu (`/menu/{business}/{table}?t=…`, already built). Right now they can only read it. This work lets them build an order together and submit it, then follow what the table has ordered.

The table is the unit, not the phone: **everyone at the table shares one cart and one bill.** Four friends can each add things from their own phone, see the same cart, and any one of them submits it.

The focus is the UI. The guest-session API arrives on 30 October; the cart and order endpoints come after that and do not exist yet (the schema has no cart table). So the screens are built on top of a small client-side "table cart" layer that runs on fake data for now and switches to the real API later without touching the components.

## Goals

- Add items from the menu and change quantities, on a phone, with thumbs.
- One shared cart per table: the same lines, quantities and total on every phone at that table, updating without a reload.
- Anyone can change or remove any line. Lines do not show who added them.
- "Submit your order" sends the whole cart as one round. A double tap, or two people tapping at once, produces one round.
- After a submit, the cart empties on every phone and the round appears on the table's bill with its kitchen status.
- A running bill: every round the table submitted, newest first, with its status and the table total in USD then LBP.
- Works today with fake data, so the flow can be demoed and tested before the backend exists.

## Non-goals

- Backend: no Prisma model, repository, service or route for the cart in this work. The contract the fake follows is written down below so the backend can be built to match.
- Guest-session wiring (`POST /api/guest-sessions`, token in `sessionStorage`). That lands with tomorrow's API.
- Paying from the phone, splitting the bill, notes or modifiers on items, Arabic.
- Kitchen and waiter screens.

## Anti-goals

- Changing the current menu design. The header, table chip, category tabs, item card layout and the sold-out look stay as they are. The only additions are the add/quantity control on each card and the cart bar.
- Floats in money. Prices arrive as strings (`"2.50"`, `"223750"`); totals are computed in integer cents (USD) and whole pounds (LBP), never with `parseFloat`.
- Showing error codes to guests. Every failure is a plain sentence.
- Components that call `fetch` directly. They only talk to the table cart layer, or swapping fake for real becomes a rewrite.

## What the guest sees

### 1. Menu (existing page, two additions)

- Each available item card gets, on the right, the existing `AddButton` (green round +). Once the item is in the table's cart it becomes the existing `QuantityStepper` (− n +). The number is the **table's** quantity, so it changes when a friend adds the same item. Going below 1 removes the line. Maximum 99 per line (the stepper's default).
- Sold-out cards keep the "Sold out" badge and get no add control.
- When the cart has at least one item, a bar is fixed to the bottom of the screen: item count (amber pill), "Table cart", and the cart total in USD. Tapping it opens the panel. Respect the bottom safe area; add bottom padding to the page so the bar never hides the last card or the footer. The existing "just sold out" notice must sit above the bar, not under it.

### 2. Panel with two tabs: Cart and Bill

A bottom sheet over the menu (built on the existing `Modal` / `ModalFrame` if they fit a sheet, otherwise a new sheet component in the same style). Header: "Table {label}". A two-tab switch: **Cart** | **Bill**. Opens on Cart.

**Cart tab**
- One row per line: item name, "$2.50 each", the `QuantityStepper`, the line total in USD.
- Under the rows: "Cart total" with USD and LBP under it (tabular figures, USD first).
- Primary button at the bottom: **"Submit your order"**. Disabled while submitting (shows a spinner), when the cart is empty, or when a line is blocked (below).
- Empty cart: a short line such as "Your table's cart is empty. Add something from the menu." and the button is not shown.
- Blocked lines: if an item in the cart becomes sold out (the menu already refreshes every 10 s), its row shows the "Sold out" badge and the message "Remove sold-out items to submit." appears above the button. If an item disappears from the menu entirely (archived or deleted), its row shows "No longer available" with the same rule. The guest can still remove these lines.

**Bill tab**
- One block per submitted round, newest first: "Order {n} · {time}", the `StatusBadge` for its status (New, Preparing, Ready, Served), a one-line summary ("2 × Espresso · 1 × Croissant"), and the round total in USD.
- A cancelled round (`CANCELLED`, set by staff later) stays in the list, greyed, with a "Cancelled" badge (new `StatusBadge` variant on the muted served/closed look, always with the word), and does **not** count in the table total. The fake never cancels, but the `Round` type and the total maths include it.
- Under the rounds: "Table total" in USD and LBP.
- Small line at the end: "Pay your waiter when you're ready."
- Nothing submitted yet: "Nothing ordered yet."

### 3. After a submit

- The cart empties on every phone at the table, the panel switches to the Bill tab, and a success toast says "Order submitted" / "The kitchen has it."
- With fake data the round stays "New" (there is no kitchen yet).
- If the submit fails: an error toast with a plain sentence ("We couldn't submit your order. Please try again."), the cart is kept as it was, and the button is enabled again.

## The table cart layer

A client module (e.g. `src/components/menu/cart/`), split in three:

1. **Pure cart logic** (no React, no storage): add/remove/set quantity, totals, joining cart lines with the current menu (to get names and prices and to spot sold-out or missing items), turning a cart into a round. Money in integer cents / whole pounds; output formatted with the existing `formatUSD` / `formatLBP`.
2. **A client interface** the components use, with two implementations: `fakeTableCartClient` now, `apiTableCartClient` later. Suggested shape:
   - `load(): Promise<TableCartState>` where `TableCartState = { version, lines: { menuItemId, qty }[], rounds: Round[] }`
   - `changeQty(menuItemId, delta)`: a **change by +1/−1**, not "set to n", so two people tapping + at the same moment both count. The result never goes below 0 (0 removes the line) or above 99.
   - `removeLine(menuItemId)`
   - `submit(lines, idempotencyKey)`: the guest's phone sends **the lines it is showing** (`{ menuItemId, qty }[]`), the same request shape as `POST /api/orders` in `CLAUDE.md` (lines in the body, `payloadHash`, `Idempotency-Key`). On success the table's cart is emptied and the new round is returned. Possible results, one shared type for both implementations:
     - `created` (the round) or `replayed` (same key and same lines: the original round, nothing new);
     - `cart_changed`: a submit is accepted only if every sent line is still in the table's cart in at least that quantity. If not, a friend submitted or edited first (two phones tapping Submit at the same moment each have their own key, so the key alone can't stop a second ticket; this check does). The UI refreshes; if the cart is now empty it treats this as success and shows the Bill, otherwise it shows the updated cart with "Your table's cart just changed. Check it and submit again.";
     - `blocked` with the ids of items that are sold out or no longer on the menu (server codes `item_sold_out`, `item_archived`, `item_not_found`): the cart rows for those items get flagged and the "Remove sold-out items to submit." message shows;
     - `tab_closed` (`tab_not_open`): "This table's bill has been closed. Please ask a member of staff." and submitting stops;
     - `failed` (network or anything else): the generic error toast, cart kept, retry allowed.
   - `subscribe(onChange)`: tells the UI when the shared state changed.

   The fake is created with the current menu (and updated when the menu refreshes), so at submit time it re-checks sold-out and missing items and freezes each line's name and prices into the round from it. It also copies the `idempotency_key_mismatch` rule (same key, different lines) so the hook is tested against it.

   **Retry rule:** when the guest taps Submit, the hook freezes the lines being sent together with a new idempotency key. A retry after a failure re-sends the **same frozen lines with the same key**, so it can never trigger a mismatch even if a friend edited the cart in between. The key and frozen lines are dropped on any final result (created, replayed, cart changed, blocked, tab closed); the next tap starts fresh from the current cart. On a successful submit, the submitted quantities are **taken out** of the cart rather than wiping it: a line that went out in full disappears, and anything a friend added after the freeze stays in the cart for the next round. In the normal case (nobody edits during the second it takes) this looks exactly like "the cart empties". The fake and, later, the server both work this way.
3. **A React hook** (e.g. `useTableCart(table, menu)`) that the menu page and panel use. It generates the idempotency key when the guest taps Submit and keeps it until that submit succeeds (so a retry reuses it), applies quantity taps immediately on screen and rolls back if the client rejects them.

**The fake:** stores the table's state in `localStorage` under a key that includes the table id, and uses the browser's `storage` event to implement `subscribe`. Result: two tabs or windows on the same table share one cart and see each other's changes straight away, which is enough to demo "several phones, one cart" on one laptop. Rounds keep a frozen copy of each line's name and prices at submit time, like `OrderLine` does on the server.

**The real one (later, not in this work):** same interface over HTTP, guest token from the guest session, refreshed by polling every few seconds (the same approach the menu uses). What the backend team needs to add or change, beyond `CLAUDE.md`:
- New: a shared cart per `TableSession` (new table) with `GET /api/cart`, `POST /api/cart/lines` `{ menuItemId, delta }`, `DELETE /api/cart/lines/:menuItemId`.
- `POST /api/orders` keeps its documented shape (lines in the body, `Idempotency-Key`, `payloadHash`, 409 on mismatch). Two additions, in the same transaction: refuse with a "cart changed" code if any sent line is no longer in the cart in that quantity, otherwise subtract the submitted quantities from the cart.
- The bill is **per table**, not per phone: `GET /api/orders/me` (as documented, one guest session's rounds) isn't enough. It should return every round on the guest's `TableSession`, or a new table-level endpoint should.

## Constraints

- Follow `CLAUDE.md`: brand tokens only, Inter, touch targets ≥ 44 px, tabular figures, USD then LBP, status badges always show a word, `@/` imports, test files in `src/test/`.
- Unit tests run in the `node` environment (`vitest.config.ts`): keep the pure logic and the fake testable without a browser by letting the fake take its storage object as a parameter.
- Mobile first; the panel must also look right on a tablet width (the menu column is `max-w-xl`).
- Respect `prefers-reduced-motion` for the sheet's slide-in.

## Tests

Unit tests in `src/test/`:
- Cart logic: adding and removing, the 0 and 99 limits, USD/LBP totals including amounts that would go wrong with floats (e.g. 3 × $0.10, many lines), joining with the menu (sold-out and missing items flagged), round summary text.
- Fake client: two clients on the same storage see the same cart; `changeQty` from two clients adds up; submit empties the cart and adds one round; the same idempotency key twice gives one round; two clients submitting the same cart with different keys give one round and one `cart_changed`; a sold-out item gives `blocked`; a friend's addition after the freeze stays in the cart.

Manual check in the browser: two tabs on the same table link, add from both, submit from one, watch the other empty and show the bill; 390 px and tablet widths.

## Calls made without asking (check these)

- No confirmation dialog before submitting; the cart is visible right above the button.
- The panel opens on the Cart tab; after a submit it switches to Bill.
- The bar label is "Table cart" and shows the USD total only (LBP is in the panel).
- Quantity changes are deltas (+1/−1) so simultaneous taps don't overwrite each other.
- An item that sells out while in the cart blocks the submit until removed, instead of being dropped silently.
- Max 99 per line.
- The fake shares the cart between tabs through `localStorage`, so it can be demoed before the backend exists.
- Submitting sends the lines the phone shows (matching the documented `POST /api/orders`), and a retry re-sends the same frozen lines with the same key.
- A submit takes the sent quantities out of the cart, so a friend's last-second addition isn't lost.
- Cancelled rounds stay on the bill, greyed, and don't count in the total.
- `.superpowers/` gets added to `.gitignore`.

## Left to the builder

File and component names, whether the sheet reuses `Modal`, how the optimistic update is coded, exact spacing and copy within the tone above.
