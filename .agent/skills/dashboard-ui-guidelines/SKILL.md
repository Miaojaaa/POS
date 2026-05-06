---
name: dashboard-ui-guidelines
description: >
  UX/UI rules and component patterns for building the Hair Salon Admin/Manager Backoffice
  dashboard, including reporting, audit logs, staff management, inventory tables, and
  commission views. Use this skill whenever generating, reviewing, or modifying any
  frontend code or UI design related to: manager dashboards, KPI summaries, data tables,
  commission reports, audit trails, inventory screens, staff schedules, or any
  admin-facing interface in the salon system. Trigger even if the user says "backoffice",
  "manager view", "report page", "staff commissions", "audit log", "inventory table", or
  "admin panel". This skill is mandatory before writing any dashboard or backoffice
  component — do not skip it.
---

# Salon Admin/Manager Dashboard — UI Skill

This skill governs all UI/UX decisions for the **manager and admin backoffice**.
The primary users are salon owners and managers: analytical, less time-pressured
than cashiers, but dealing with dense data, financial accountability, and staff
management. Every design decision must serve **data clarity, auditability, and
trust** — not decoration.

---

## 1. Core Philosophy

> "The manager needs to find the truth fast, not admire the interface."

- **Data density over whitespace.** Backoffice users are comfortable with information-rich screens. Do not over-pad tables or reduce data to make it look "clean."
- **Semantic colors only.** Every color must carry a specific, consistent meaning. Decorative colors waste cognitive bandwidth.
- **Audit-first mindset.** Every data-changing action must leave a visible trace. The UI must surface this trace without requiring the manager to dig.

---

## 2. Semantic Color System

This is the **only** approved color palette for data and status communication. Enforce it strictly across all backoffice components.

| Color | Token | Use Cases | Never Use For |
|---|---|---|---|
| **Green** | `text-green-600` / `bg-green-50` | Revenue, income, success, confirmed payment, positive delta | Decorative backgrounds, branding accents |
| **Red** | `text-red-600` / `bg-red-50` | Void, refund, deleted record, critical alert, negative delta, Previous State in diffs | Warnings (use amber), neutral info |
| **Amber** | `text-amber-600` / `bg-amber-50` | Warnings, low stock, pending approval, unresolved items | Errors (use red), success |
| **Blue** | `text-blue-600` / `bg-blue-50` | Links, navigation active state, info tooltips | Revenue/financial data |
| **Gray** | `text-gray-*` / `bg-gray-*` | Standard UI chrome, labels, borders, inactive states | Any financial or status indicator |
| **White** | `bg-white` | Card backgrounds, table rows (default) | |

**Rule:** If you are tempted to use a color not in this table, do not use it. Choose the closest semantic match.

---

## 3. Data Tables — Core Component

All dense data views (audit logs, commission reports, inventory, transaction history) must use the same base table pattern.

### 3a. Required Table Features

| Feature | Requirement |
|---|---|
| Sticky header | `position: sticky; top: 0` — always. Headers must not scroll away. |
| Pagination | Default 25 rows/page. Options: 25 / 50 / 100. Show `"Showing X–Y of Z results"`. |
| Virtual scrolling | Use for tables likely to exceed 500 rows (e.g., full audit log). Use `react-virtual` or `@tanstack/virtual`. Do not load 2000 rows into the DOM. |
| Column sorting | Click column header to sort asc/desc. Show `↑ / ↓` indicator on active column. |
| Row hover state | `hover:bg-gray-50` — subtle, not distracting. |
| Empty state | Never show a blank table. Show: icon + `"No records found"` + optional filter reset link. |
| Loading state | Show skeleton rows (gray animated bars), not a spinner that collapses the table. |

### 3b. Standard Table Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  [Search/Filter bar]               [Export CSV] [Date Range]    │
├──────┬────────────┬──────────┬──────────┬──────────┬───────────┤
│  ID  │  Date/Time │  Staff   │  Type    │  Amount  │  Status   │  ← sticky
├──────┼────────────┼──────────┼──────────┼──────────┼───────────┤
│ ...  │            │          │          │          │           │
├──────┴────────────┴──────────┴──────────┴──────────┴───────────┤
│  Showing 1–25 of 312 results    [← Prev]  Page 1 of 13  [Next →]│
└─────────────────────────────────────────────────────────────────┘
```

### 3c. Column Typography

- **IDs / Codes:** `font-mono text-sm text-gray-500` — monospace for scannable alignment.
- **Currency amounts:** `font-mono tabular-nums text-right` — always right-aligned, always monospace. Never left-align money.
- **Timestamps:** Use `DD MMM YYYY HH:mm` format. Show full datetime, not relative ("2 hours ago" breaks audit accountability).
- **Status badges:** Use pill badges `rounded-full px-2 py-0.5 text-xs font-medium` with semantic colors.

```jsx
// Status badge examples
<span className="bg-green-50 text-green-700 ...">Completed</span>
<span className="bg-red-50 text-red-700 ...">Voided</span>
<span className="bg-amber-50 text-amber-700 ...">Pending</span>
```

---

## 4. Audit Trail & Transaction History

### 4a. The Core Rule

Every audit log row that represents a **change** must show **Previous State → New State** using the semantic color system.

```
┌─────────────────────────────────────────────────────────────┐
│ [2025-06-15 14:32]  Edited by: Nong (Manager)              │
│ Field: Service Price — "Haircut"                           │
│                                                             │
│  Before:  ฿350   ← text-red-600, strikethrough             │
│  After:   ฿400   ← text-green-600, font-semibold           │
│                                                             │
│ Reason: "Price adjustment per June rate card"              │
└─────────────────────────────────────────────────────────────┘
```

**Implementation pattern:**
```jsx
<div className="flex items-center gap-3">
  <span className="text-red-600 line-through font-mono">฿350</span>
  <span className="text-gray-400">→</span>
  <span className="text-green-600 font-semibold font-mono">฿400</span>
</div>
```

### 4b. Audit Log Table Columns (Required)

| Column | Type | Notes |
|---|---|---|
| Timestamp | DateTime | Full `DD MMM YYYY HH:mm:ss`, monospace |
| Action | Badge | `Created`, `Edited`, `Voided`, `Deleted`, `Login`, `Override` |
| Actor | Text | Staff name + role in sub-line |
| Entity | Text | What was affected (Transaction #, Product name, Staff name) |
| Previous Value | Diff | Red / strikethrough |
| New Value | Diff | Green / bold |
| IP / Device | Text | `text-gray-400 text-xs` — available on expand |

### 4c. Expandable Row Detail

For complex multi-field edits, the row should be expandable (accordion):

```
▶  [2025-06-15 14:32]  Edited Transaction #1042  —  Nong   [Expand ▼]

  When expanded:
  ├─ Discount:  ฿0  →  ฿50   (Staff override)
  ├─ Total:     ฿910  →  ฿860
  └─ Note:      "Loyal customer discount applied"
```

Do not show all diff fields in the collapsed row — only the primary field and the actor.

### 4d. Void / Refund Row Styling

A voided or refunded transaction row must be immediately identifiable without reading the status badge:

```jsx
<tr className="bg-red-50 opacity-75">
  {/* all cells */}
  <td className="text-red-700 font-medium">Voided</td>
</tr>
```

- Row background: `bg-red-50`
- Amount: strike through with `line-through text-red-600`
- Do NOT hide voided rows by default — they must remain visible in the audit trail.

---

## 5. Commission Reports — Manager Dashboard

### 5a. The Core Separation Rule

**Gross Sales** and **Commissionable Base** must NEVER appear in the same column or be visually ambiguous. Staff disputes almost always originate from this confusion.

```
┌───────────────────────────────────────────────────────────────┐
│  Staff: Nong          Period: June 2025                       │
│───────────────────────────────────────────────────────────────│
│  Gross Sales                               ฿28,400           │
│  Less: Voids / Refunds                    -฿800             │
│  Less: Non-commissionable (Retail Products) -฿3,200         │
│  ─────────────────────────────────────────────────────       │
│  Commissionable Base                       ฿24,400  ← bold  │
│  Commission Rate                              15%            │
│  ─────────────────────────────────────────────────────       │
│  Commission Earned                         ฿3,660  ← green  │
└───────────────────────────────────────────────────────────────┘
```

**Typography rules:**
- `Commissionable Base`: `font-semibold text-gray-900` — visually distinct, not green yet (it is not income, it is a basis).
- `Commission Earned`: `font-semibold text-green-600` — this is the actual income line.
- Deduction lines (`Less: ...`): `text-red-600 font-mono tabular-nums`.

### 5b. Commission Table (All Staff)

```
Staff Name     | Gross Sales | Deductions | Comm. Base  | Rate | Commission
─────────────────────────────────────────────────────────────────────────────
Nong           | ฿28,400    | -฿4,000    | ฿24,400     | 15%  | ฿3,660
Ploy           | ฿19,200    | -฿800      | ฿18,400     | 12%  | ฿2,208
─────────────────────────────────────────────────────────────────────────────
TOTAL          | ฿47,600    | -฿4,800    | ฿42,800     |      | ฿5,868
```

- All money columns: `font-mono tabular-nums text-right`.
- `Commission` column header and values: `text-green-700`.
- `Deductions` column: `text-red-600`.
- Total row: `font-semibold bg-gray-50 border-t-2 border-gray-300`.

### 5c. Drill-Down

Each staff row must be clickable to open a detail view showing every transaction that contributed to their Gross Sales and every deduction, line by line. This is the paper trail that resolves disputes. It must be a full transaction list table (using the standard table pattern from Section 3).

---

## 6. KPI Summary Cards

Top-of-dashboard summary cards should be data-dense but scannable.

```
┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ Today Revenue │  │ Transactions │  │  Avg. Ticket │  │  Voids Today │
│ ฿12,450      │  │     47       │  │    ฿264.9    │  │    2         │
│ ↑ +8% vs yst │  │              │  │              │  │  ฿800 value  │
└──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘
  (green delta)                                          (red value)
```

**Rules:**
- 4 cards maximum in a single row. Do not cram 8 KPIs at equal size.
- Positive delta (`↑ +X%`): `text-green-600`.
- Negative delta (`↓ -X%`): `text-red-600`.
- Void/refund cards: border-left accent `border-l-4 border-red-400`, value in `text-red-600`.
- Revenue cards: border-left accent `border-l-4 border-green-400`.
- Do NOT use large background color fills on KPI cards (it conflicts with the semantic system). Use border accents only.

---

## 7. Inventory Management Table

```
Product Name    | SKU      | Category  | Stock | Low Stock | Cost  | Retail  | Margin
────────────────────────────────────────────────────────────────────────────────────
Shampoo X 500ml | SKU-0041 | Retail    | 3     | ⚠️  Yes   | ฿120  | ฿280    | 57%
Wax Strong      | SKU-0082 | Retail    | 0     | 🔴 Out    | ฿90   | ฿220    | 59%
```

- `Stock = 0`: row `bg-red-50`, stock cell `text-red-700 font-semibold`, `"Out of Stock"` badge.
- `Stock ≤ threshold`: row `bg-amber-50`, stock cell `text-amber-700`, amber warning badge.
- `Stock > threshold`: normal `bg-white`, `text-gray-900`.
- Margin column: purely informational, `text-gray-600` — do not color-code margins (it creates visual noise with the stock color system).
- All cost/price/margin columns: right-aligned, `font-mono tabular-nums`.

---

## 8. Staff Management Views

### Schedule / Roster Table

- Rows: Staff members
- Columns: Days of the week (or dates in a date range)
- Cell states:
  - Working: `bg-green-50 text-green-800` — show shift time
  - Day off: `bg-gray-50 text-gray-400` — `"Off"`
  - Absent/No-show: `bg-red-50 text-red-700` — `"Absent"`
  - Not scheduled: `bg-white` — empty

No complex calendar widgets. A simple grid table is sufficient and loads faster on older salon tablets.

### Staff Performance Row (within commission/schedule views)

Do not show staff photos, avatars, or decorative profile cards. Use plain name + role text. This is a data tool, not an HR portal.

---

## 9. Navigation & Information Architecture

```
Sidebar (collapsed icon-only on narrow screens):
├── 📊  Dashboard (KPIs)
├── 🧾  Transactions
├── 📋  Audit Log
├── 👥  Staff & Commission
├── 📦  Inventory
├── ⚙️   Settings
└── 🔒  Roles & Permissions
```

- Max sidebar depth: 2 levels. No nested sub-menus within sub-menus.
- Active route: `bg-gray-100 text-gray-900 font-semibold border-l-4 border-blue-500`.
- All icons must have visible text labels — do not rely on icon-only navigation in a backoffice tool.

---

## 10. What NOT to Do

- ❌ Do not use charts as the primary data representation for financial reports. Charts are **supplementary** — the table is the source of truth.
- ❌ Do not use pie charts for revenue breakdown — use horizontal bar charts or grouped bar charts only.
- ❌ Do not use animations on table row renders or card load-ins. They slow down perception of data.
- ❌ Do not auto-delete or auto-archive voided records from any view. Managers must explicitly filter them out.
- ❌ Do not use a single aggregated "Total" number anywhere without showing the breakdown that produced it.
- ❌ Do not use dark mode as the default for the backoffice — data tables are significantly harder to read on dark backgrounds. Offer it as a user preference, not the default.
- ❌ Do not use color gradients on charts — use flat semantic colors only.
- ❌ Do not show commission amounts before showing the commissionable base. Always show the derivation chain.

---

## 11. Export & Reporting

- **CSV Export:** Available on every data table. Use `"Export CSV"` button, top-right of table. Exports all pages, not just the current view.
- **Print View:** Commission reports and audit logs must have a `print:` stylesheet that renders a clean, monochrome, print-friendly version. No sidebars, no navigation.
- **Date Range Picker:** Required on all financial and audit tables. Default to "Today". Options: Today / This Week / This Month / Custom Range. Use a standard date picker (e.g., `react-day-picker`) — do not build a custom one.

---

## Summary Checklist (Before Shipping Any Backoffice Component)

- [ ] All table headers are sticky
- [ ] Tables have pagination (25/50/100) with row count display
- [ ] All money values are right-aligned, monospace, tabular-nums
- [ ] Timestamps are full datetime format (not relative)
- [ ] Audit log shows Previous → New state with red/green diff
- [ ] Voided rows are `bg-red-50` with strikethrough amounts
- [ ] Commission view separates Gross Sales from Commissionable Base with explicit deduction lines
- [ ] Color usage matches the semantic color table only (Section 2)
- [ ] KPI deltas use green (positive) / red (negative) only
- [ ] Empty table states are handled (not blank)
- [ ] CSV export available on financial tables
