---
name: pos-salon-logic
description: Standard POS calculation logic for retail and salon services. Focuses on integer math, simple discount stacking, and straightforward payment validation.
---

# 1. Calculation Rules
- **Integer Math:** Always process monetary values as integers (e.g., 100.00 THB = 10000). Avoid floating-point math during calculation.
- **Discount Order:** 1. Item-level discounts.
  2. Cart-level discounts (distributed proportionally based on item net price).
  - Assign any 1-satang rounding differences to the highest-priced item in the cart to balance the total.

# 2. Cart Schema
- Differentiate `item_type` as `"service"` (requires `technician_id`) or `"retail"`.
- Store `unit_price` as a frozen snapshot at the time of adding to the cart. Do not re-fetch from the database during checkout.

# 3. Simple Idempotency & Validation
- Prevent duplicate checkouts by requiring a unique `order_reference` from the frontend.
- Ensure `sum(payments)` matches `grand_total` before marking as `"PAID"`.
- Do not process checkouts if the cart is empty or the grand total is negative.