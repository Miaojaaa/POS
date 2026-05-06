---
name: point-of-sale-interface
description: >
  UX/UI rules and component patterns for building the Hair Salon Point-of-Sale (POS) cashier
  screen. Use this skill whenever generating, reviewing, or modifying any frontend code or
  UI design related to: the checkout screen, cart, payment modal, item selection grid,
  receipt view, or any cashier-facing interface in the salon system. Trigger even if the
  user says "checkout page", "billing screen", "add to cart", "payment flow", or "cashier UI".
  This skill is mandatory before writing any POS component — do not skip it.
---

# Salon POS — Cashier Screen UI Skill

This skill governs all UI/UX decisions for the **cashier-facing Point-of-Sale screen**.
The primary users are salon receptionists: fast-paced, possibly high-turnover, working
on tablets during peak hours. Every design decision must serve **speed, clarity, and
error prevention** — not aesthetics.

---

## 1. Core Philosophy

> "If a receptionist has to think, the design has failed."

- **Touch-first, always.** Assume a 10-inch tablet in portrait or landscape. Mouse/keyboard is secondary.
- **3-Tap Checkout rule.** From the item grid → cart → payment modal must be reachable in ≤ 3 taps. Never bury payment behind sub-menus or confirmation dialogs unless it's a destructive action.
- **Fail loudly, not silently.** Validation errors must appear inline and immediately — no toasts that disappear.

---

## 2. Touch Target & Layout Rules

| Element | Minimum Size | Notes |
|---|---|---|
| Item tile (service or product) | 48×48px touch target | Prefer 80×80px displayed size |
| Cart line action (remove, edit) | 48×48px | Use icon + label, not icon-only |
| Payment method buttons | 56px height minimum | Full-width on mobile, 50% split on tablet |
| Numeric keypad keys | 64×64px | High-contrast, clear press state |
| "Charge / Confirm Payment" CTA | 64px height, full-width | Always pinned to bottom of payment modal |

**Layout split (tablet landscape):**
```
┌─────────────────────────┬──────────────────┐
│  Item Grid (left ~60%)  │  Cart (right 40%)│
│  [Services Tab]         │  ─────────────── │
│  [Products Tab]         │  Line items       │
│                         │  Subtotal         │
│                         │  [Charge Button]  │
└─────────────────────────┴──────────────────┘
```
On portrait/small screens: Item grid is top, cart collapses to a drawer/bottom sheet.

---

## 3. Item Grid — Services vs. Retail Products

This is the most critical visual separation in the entire POS.

### 3a. Two-Tab or Two-Section Architecture

Always render Services and Products in clearly separated areas — never mixed in a single flat list.

**Recommended:** Tab bar at top of item grid:
```
[ 💇 Services ]  [ 🛍 Products ]
```

**Tab visual treatment:**
- Active tab: `bg-primary text-white`, bottom border 3px solid accent.
- Inactive tab: `bg-gray-100 text-gray-600`.

### 3b. Service Item Tile

Services **require a technician assignment** — the tile must communicate this.

```
┌──────────────────┐
│  ✂️  Haircut      │
│  ฿350            │
│  ── Assign ──    │  ← shown in muted text if no tech assigned
└──────────────────┘
```

- **Color:** White background, `border-l-4 border-blue-500` left accent.
- On tap: Open technician assignment bottom-sheet **before** adding to cart. Do not silently add an unassigned service.
- If technician is pre-assigned (e.g., walk-in with stylist): show the name badge on the tile.

### 3c. Product Item Tile

Products are physical retail items — no technician assignment needed.

```
┌──────────────────┐
│  🧴  Shampoo X   │
│  ฿280            │
│  Stock: 12       │  ← stock count badge
└──────────────────┘
```

- **Color:** White background, `border-l-4 border-green-500` left accent.
- On tap: Add to cart immediately. No intermediate dialog.
- Show low-stock warning (`stock ≤ 3`): amber badge, do not block the sale.
- Out-of-stock (`stock = 0`): gray out tile, show "Out of Stock", disable tap.

### 3d. Cart Line Item Rendering

Cart must visually distinguish services from products at a glance:

```
Cart
──────────────────────────────
💇 Haircut — Nong            ฿350   [✕]
   Technician: Nong

🛍 Shampoo X × 2             ฿560   [✕]
──────────────────────────────
Subtotal                     ฿910
Discount                    -฿0
──────────────────────────────
TOTAL                        ฿910
```

- Service lines: show technician name in a sub-line (`text-sm text-gray-500`).
- Product lines: show quantity badge (`× N`).
- Use emoji or icon prefix as a fast visual cue, not color alone (accessibility).

---

## 4. Payment Modal

### 4a. Trigger

The "Charge" button opens a full-screen modal (or bottom-sheet on mobile). Once opened:
- The cart behind it becomes **read-only** (see Section 5 — Immutability).
- Back/cancel is allowed only if payment has NOT been initiated.

### 4b. Payment Method Layout

```
┌─────────────────────────────────────────┐
│  TOTAL DUE          ฿910               │
│─────────────────────────────────────────│
│  [ 💵 Cash ]   [ 📲 Transfer ]   [ 💳 Card ] │
│─────────────────────────────────────────│
│  Cash received:                         │
│  [ 1,000 ]  ← large numeric input      │
│─────────────────────────────────────────│
│  CHANGE DUE                             │
│  ฿90   ← LARGEST TYPOGRAPHY ON SCREEN  │
│  (font-size: 3rem+, font-weight: 800)  │
│─────────────────────────────────────────│
│  [ ✅  CONFIRM PAYMENT — ฿910 ]        │
└─────────────────────────────────────────┘
```

**Typography rule:** `Change Due` value must use the largest `font-size` on the screen when cash is entered. Use `text-5xl font-extrabold text-green-600` or equivalent. This prevents cashier miscounting.

### 4c. Split Payment (Cash + Transfer)

When the customer pays with multiple methods:

```
Split Payment
──────────────────────────────────────────
💵 Cash           [ ฿500    ]
📲 Transfer       [ ฿410    ]  ← auto-fills remainder
──────────────────────────────────────────
Allocated         ฿910 / ฿910  ✅
──────────────────────────────────────────
```

- The **second method auto-calculates** the remaining balance. The cashier enters Cash amount; Transfer fills automatically.
- Show a running `Allocated / Total` tracker. It must be `✅ green` when fully allocated, `⚠️ amber` when under, `🔴 red` when over.
- Do NOT allow `Confirm Payment` if allocated ≠ total due.

### 4d. Discount Application

Discounts must be applied **before** the payment modal is opened (in cart view), not during payment. This prevents disputes and audit gaps. If a discount code/button exists in the payment modal, make it clearly secondary (ghost button, small) and log the action.

---

## 5. Cart Immutability Lock

Once the "Charge" button is tapped and the payment modal is open:

- Cart items must render with a **visual lock state**:
  - Gray out all remove `[✕]` buttons (disabled, `opacity-40 cursor-not-allowed`).
  - Show a lock icon `🔒` in the cart header: `"Cart Locked — Payment in Progress"`.
  - If the user closes/cancels the modal without completing payment, **unlock the cart** and reset.
- This prevents accidental mid-payment cart edits that cause reconciliation errors.

**Implementation note:** Use a `cartLocked: boolean` state flag. All cart mutation actions must check this flag and no-op if true.

---

## 6. Receipt & Post-Payment

After successful payment:

1. Show a full-screen **success state** — not a toast. Green checkmark, transaction ID, amount charged.
2. Two large buttons: `[ 🖨 Print Receipt ]` and `[ ✚ New Transaction ]`.
3. Auto-reset cart and return to item grid after `[ New Transaction ]` is tapped.
4. Do NOT auto-reset on a timer — the cashier must explicitly start the next transaction.

---

## 7. Error States & Validation

| Scenario | UI Treatment |
|---|---|
| Service added without technician | Block cart add; show inline bottom-sheet to assign tech |
| Payment amount < total due | Disable confirm; show `"Short by ฿X"` in red below input |
| Payment amount > total (non-cash) | Block; show `"Amount exceeds total"` — only cash allows overpayment (change) |
| Network error on payment submit | Show error banner inside modal; keep modal open; allow retry |
| Void after payment | Requires manager PIN; show a distinct Void flow (red-themed, separate screen) |

---

## 8. What NOT to Do

- ❌ Do not use modals-within-modals for payment flows.
- ❌ Do not use horizontal scroll for the item grid — use pagination or search instead.
- ❌ Do not auto-dismiss error messages. Errors must be dismissed by the user.
- ❌ Do not use subtle color-only differentiation (e.g., light blue vs. light green) — always pair with icon or label.
- ❌ Do not add animations that delay the cashier's interaction (e.g., cart item slide-in > 150ms).
- ❌ Do not use decorative gradients, hero images, or marketing-style UI on the cashier screen.

---

## 9. Recommended Tech Patterns (React / Vue + Tailwind)

```jsx
// Touch target enforcement utility (Tailwind)
const touchTarget = "min-h-[48px] min-w-[48px]";

// Service tile
<div className={`${touchTarget} border-l-4 border-blue-500 bg-white rounded-lg p-3 flex flex-col`}>

// Product tile
<div className={`${touchTarget} border-l-4 border-green-500 bg-white rounded-lg p-3 flex flex-col`}>

// Change due — largest text on screen
<p className="text-5xl font-extrabold text-green-600 tabular-nums">
  ฿{changeDue.toFixed(2)}
</p>

// Locked cart item
<button disabled={cartLocked} className={cartLocked ? "opacity-40 cursor-not-allowed" : ""}>
  ✕
</button>
```

---

## Summary Checklist (Before Shipping Any POS Component)

- [ ] All interactive elements ≥ 48px touch target
- [ ] Services and Products are visually separated (tab + left border color)
- [ ] Services require technician assignment before entering cart
- [ ] Split payment allocator shows live `allocated / total` status
- [ ] Change Due is the largest text when cash amount is entered
- [ ] Cart is locked (visually + functionally) once payment modal opens
- [ ] No auto-dismiss on errors
- [ ] Post-payment requires explicit "New Transaction" tap
