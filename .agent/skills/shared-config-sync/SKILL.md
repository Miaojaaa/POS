---
name: shared-config-sync
description: >
  Workflow and rules for keeping two snapshots in sync between multiple
  developers' local SQLite databases:
    (1) shared-config.json — SystemConfig keys (logo, theme, tax ID, shop
        address, receipt format, commission config, PINs).
    (2) shared-catalog.json — catalog rows (branches, users incl. password
        hashes, service groups/categories/services, products, retail products).
  Use this skill whenever: (a) a dev reports that branding/theme/tax-ID/PIN
  looks wrong after a git pull, (b) a dev reports that services/staff/products
  are missing or different after a pull, (c) a dev adds a new SystemConfig key
  or a new row to a synced catalog table, (d) anyone asks how to share data
  between machines, (e) writing or modifying any scripts/{export,import,check}-{config,catalog}-sync.* file,
  (f) the pre-commit hook reports "Settings sync check failed" or "Catalog
  sync check failed", or (g) one dev sees defaults (e.g. shop.name "Salon",
  theme olive, tax ID 0505567002730, empty service list, missing staff)
  while another sees customised values after a pull. Trigger even if the user
  says: "settings reset after pull", "logo disappeared", "theme color wrong",
  "tax ID is default again", "config not synced", "services missing", "staff
  list empty", "can't login after pull", "อีกฝั่งไม่เห็น settings", "logo
  หาย", "ธีมเพี้ยน", "การตั้งค่าหาย", "บริการหาย", "data บริการหาย",
  "พนักงานหาย", "login ไม่ได้หลัง pull", "รหัส pin ไม่มี". Also trigger when
  triaging an untracked prisma/shared-config.json or prisma/shared-catalog.json
  in git status.
---

# Shared Config Sync — Salon POS

The salon-pos project uses a **local SQLite DB** (`prisma/dev.db` — git-ignored)
to store everything from staff records to branding. Most data is per-environment
(orders, customers, transfers) and **should not** sync. But a small subset — the
stuff you configure once in Settings — must look the same on every dev's machine.

This skill governs that subset.

---

## 1. What's in scope

Two snapshots live in `prisma/`, both committed:

| Snapshot | Source tables | Whitelist defined in |
|---|---|---|
| `shared-config.json` | `SystemConfig` rows | `scripts/export-config.ts` → `SYNCED_KEYS` |
| `shared-catalog.json` | `Branch`, `User`, `ServiceGroup`, `ServiceCategory`, `Service`, `Product`, `RetailProduct` | `scripts/export-catalog.ts` (full-table dump) |

### 1a. `shared-config.json` — SystemConfig keys

| Key | What it controls | Lives in |
|---|---|---|
| `shop.name` | Receipt header / sidebar title | Branding settings |
| `shop.logo` | Base64 logo data URL | Branding settings |
| `shop.address` | Receipt / tax-invoice address | Branding settings |
| `shop.taxId` | 13-digit Thai tax ID | Branding settings |
| `theme.main` / `theme.secondary` / `theme.third` | Brand colors | Branding settings |
| `finance.commissionMode` | POOL / PER_HEAD / NONE | Finance settings |
| `finance.positionAllowance` | Boolean toggle | Finance settings |
| `finance.vatMode` | EXCLUSIVE / INCLUSIVE | Finance settings |
| `finance.commission.{pool,perHead}.{tech,assist}` | Commission percentages | Finance settings |
| `receipt.format.short` / `receipt.format.full` | Receipt-number prefix/format | Finance settings |
| `sidebar.config` | Module visibility / labels | Sidebar settings |
| `owner_pin` / `manager_pin` | Plaintext PINs | (no UI — set via seed/manual) |
| `line_inactive_days` | LINE notification trigger | LINE/notification config |

The whitelist lives in `scripts/export-config.ts` → `SYNCED_KEYS`. **Update it in
the same PR** whenever you add a new SystemConfig key that should be shared.

### 1b. `shared-catalog.json` — catalog rows

| Table | What it controls | Sync rule |
|---|---|---|
| `Branch` | Shop branches | Full upsert by `id` |
| `User` | Staff (incl. login emails + bcrypt password hashes) | Full upsert by `id` — passwords ride along so the other dev can log in immediately |
| `ServiceGroup` | Top-level service tabs (e.g. 💇 ผม) | Full upsert by `id` |
| `ServiceCategory` | Sub-categories under each group | Full upsert by `id` |
| `Service` | Individual menu items (name, price, duration) | Full upsert by `id` |
| `Product` | Chemical/back-bar catalog (name, cost, sellable) — **no stock** | Catalog fields upsert; stock lives in `MainStock`/`SubStock` and stays per-env |
| `RetailProduct` | Front-of-house retail SKUs | `stock` field is excluded on update — preserves per-env inventory counts; only used on create |

Tables intentionally **not** in the snapshot: `Order`, `OrderItem`, `Customer`,
`ServiceHistory`, `MainStock`, `SubStock`, `StockMovement`, `StockTransfer`,
`PayrollRun`, `PayrollItem`. These are transactional / per-environment and
would clobber each dev's working data.

`Promise.all`-batched read in `scripts/export-catalog.ts` is the source of
truth for which tables are dumped. Adding a new catalog-shaped model? Add it
there and update the table above in the same PR.

---

## 2. The workflow

```
┌─ Dev A changes setting OR catalog in UI ──┐
│                                           │
│  npm run config:export    (if Settings changed)
│  npm run catalog:export   (if Services / Users / Products changed)
│  git add prisma/shared-config.json prisma/shared-catalog.json
│  git commit               ← pre-commit hook runs BOTH checks
│  git push
│                                           │
└───────────────────────────────────────────┘
                ↓ git pull
┌─ Dev B picks up changes ──────────────────┐
│                                           │
│  npm install              ← postinstall wires up the pre-commit hook
│  npm run bootstrap        ← single command: db push + generate + both imports
│  (stop next dev, delete .next/, restart)
│                                           │
└───────────────────────────────────────────┘
```

`npm run bootstrap` is the single command Dev B should run after any pull
that touches `schema.prisma` or either snapshot. It runs (in order):

1. `prisma db push` — adds new tables/columns to `dev.db` (warn-only: if the
   DB is already in sync, the "cannot drop index" SQLite quirk is harmless).
2. `prisma generate` — refreshes the in-`node_modules` Prisma client so it
   matches the just-pushed schema.
3. `npm run config:import` — applies `shared-config.json` if present.
4. `npm run catalog:import` — applies `shared-catalog.json` if present
   (preserves `RetailProduct.stock` on update).

It is idempotent — running it on an already-synced DB is safe.

**The export step is manual on purpose.** A merge conflict in a JSON snapshot
is easy to resolve; an auto-export inside a git hook would clobber a teammate's
changes without warning. The pre-commit hook is a **safety net** (it blocks
forgetting export); it never silently runs export for you.

---

## 3. Rules

1. **Export immediately after changing settings.** If you tweak the logo, theme,
   or commission rates in the UI, run `npm run config:export` **before**
   committing other code. Otherwise teammates will see stale values when they
   import.

2. **Never hand-edit `prisma/shared-config.json` for runtime values.** Edit in
   the UI, then export. Hand-edits are fine only for resolving merge conflicts
   (and even then, prefer re-exporting after applying the fix in the UI).

3. **Don't commit per-machine state to the snapshot.** If a key is per-dev
   (e.g. a test API token, a personal feature flag), don't add it to
   `SYNCED_KEYS`. Leave it in `SystemConfig` un-synced.

4. **PINs are plaintext in this file.** This was an explicit choice — the team
   accepts that anyone with repo access sees the PINs. Don't move PINs into
   this snapshot from a system that previously didn't expose them without
   re-confirming the trade-off with the team.

5. **Restart `next dev` after `npm run config:import`.** Theme variables and
   branding are read at request time but cached in some client components;
   a full restart is the cleanest reset.

6. **Add new keys to BOTH `SYNCED_KEYS` AND the table above** in this file.
   The README is the source of truth for "what gets shared." If the code drifts
   from this list, fix the code.

---

## 3a. Diagnostic checklist (use this when triaging "settings didn't sync")

Run these in order. Stop at the first one that's `❌` — that's the fix.

1. **Are BOTH snapshots tracked in git on the pushing side?**
   ```sh
   git ls-files --error-unmatch \
     salon-pos/prisma/shared-config.json \
     salon-pos/prisma/shared-catalog.json
   ```
   Both exit 0 = tracked ✅. Exit 1 on either = untracked ❌ →
   `git add` the missing file(s) + commit + re-push.

2. **Do the snapshots reflect the pushing dev's current DB?**
   ```sh
   cd salon-pos && npm run config:check && npm run catalog:check
   ```
   Both exit 0 = in sync ✅. Any exit 1 = drift ❌ — run the matching
   `*:export` for the failing one, then stage + commit.

3. **Is the pulling dev on the same commit as the push?**
   ```sh
   git log --oneline -1 salon-pos/prisma/shared-config.json
   ```
   Both devs should report the same commit hash for that file.

4. **Did the pulling dev run BOTH imports?** Each snapshot is data, not code:
   ```sh
   npm run config:import   # branding, theme, PINs
   npm run catalog:import  # services, staff, products
   ```
   Pulling alone does nothing until import is run.

5. **Did the pulling dev restart `next dev` after import?** Branding/theme is
   cached in some client components; a restart is the cleanest reset. If still
   stale, delete `.next/` and restart.

6. **Is the missing key actually in `SYNCED_KEYS` (config) or in the catalog
   table list (catalog)?** Check `scripts/export-config.ts` for SystemConfig
   keys and `scripts/export-catalog.ts` for catalog tables — anything outside
   those lists is intentionally per-machine and will never sync.

If steps 1–6 all pass and behaviour is still wrong, the bug is in the
application code (reading the wrong key, caching too aggressively), not in
the sync pipeline.

---

## 3b. The pre-commit hook

`.githooks/pre-commit` (wired up by `npm install` → `setup-hooks.js`) runs
TWO checks before every commit. Both must pass:

- `scripts/check-config-sync.js` — opens `dev.db` read-only with
  `better-sqlite3`, reads every `SYNCED_KEYS` row from `SystemConfig`, diffs
  against `prisma/shared-config.json`.
- `scripts/check-catalog-sync.js` — opens `dev.db` read-only, dumps every
  catalog table (Branch, User, ServiceGroup, ServiceCategory, Service,
  Product, RetailProduct) and diffs against `prisma/shared-catalog.json`.
  Handles SQLite quirks: 0/1 ↔ boolean, `+00:00` ↔ `Z` dates, and the
  `unitVolumeMg` ↔ `unitVolumeG` `@map` rename. Excludes `RetailProduct.stock`
  (per-env) from the diff.

Both checks exit non-zero (blocking the commit) on drift and print the
drifted rows + the exact `*:export` command to fix. They skip themselves
silently if `dev.db` is absent (fresh clone) or the target table doesn't
exist yet (pre-seed).

**Bypass (rare):** `git commit --no-verify` — only legitimate when the commit
genuinely shouldn't touch settings (e.g. an emergency revert that excludes
`shared-config.json`).

**If the hook never fires:** the most common cause is `core.hooksPath` not
being set — re-run `cd salon-pos && npm run setup-hooks`, or set it directly
with `git config core.hooksPath .githooks` from the repo root.

---

## 4. When something goes wrong

| Symptom | Likely cause | Fix |
|---|---|---|
| Logo missing after pull | `shared-config.json` wasn't updated before push, or `npm run config:import` not run | Ask whoever pushed to re-export and push; then re-import |
| Theme colors revert to olive defaults | Same as above | Same |
| Tax ID shows `0505567002730` (the default) | `shop.taxId` not in snapshot, or import not run | Run import; if still default, check `SYNCED_KEYS` includes `shop.taxId` |
| `prisma/shared-config.json not found` | Fresh clone with no snapshot yet | Ask a teammate to `npm run config:export` + commit |
| `Unsupported snapshot version` | Snapshot was bumped in a newer commit | Pull latest, then re-import |
| Import says success but UI still shows old values | Next.js cached the old branding | Stop dev server, delete `.next/`, restart |
| Pre-commit hook says "Settings sync check failed" | `dev.db` has settings that `shared-config.json` doesn't | Run `npm run config:export`, `git add` the snapshot, re-commit |
| Pre-commit hook says "Catalog sync check failed" | `dev.db` has services/users/products that `shared-catalog.json` doesn't | Run `npm run catalog:export`, `git add` the snapshot, re-commit |
| Services missing on B / login fails on B | `shared-catalog.json` not committed or `npm run catalog:import` not run | Verify the file is committed; pulling dev runs `npm run bootstrap` (or `catalog:import` alone if schema hasn't changed) then restart `next dev` |
| `/api/services` or `/api/service-groups` returns 500 on B after pull | Schema changed but B's `dev.db` doesn't have the new columns yet → Prisma client SELECTs missing column | Run `npm run bootstrap` (does `prisma db push` + `generate` + imports), then restart `next dev` and delete `.next/` |
| `prisma db push` fails on A with "cannot drop index" | SQLite quirk when schema is already in sync — Prisma engine wants to redefine an index it can't | Harmless — bootstrap treats this as warn-only and continues. If running `prisma db push` standalone, ignore the error if the DB already matches `schema.prisma` |
| RetailProduct stock counts changed after import | Should NOT happen — stock is excluded on update | If it did, check that `import-catalog.ts` still has the `stock` destructure in the upsert |
| Hook never runs on commit | `core.hooksPath` not configured | `cd salon-pos && npm run setup-hooks` |
| `shared-config.json` or `shared-catalog.json` shows as `??` in `git status` | Snapshot exists but was never `git add`-ed | `git add` the relevant file |

---

## 5. Anti-patterns

- ❌ Committing `prisma/dev.db` to "share everything" — it bundles orders,
  customers, and other per-environment data; it would also constantly produce
  binary merge conflicts.
- ❌ Auto-running `config:import` in `postinstall` or a git hook — risks
  silently overwriting in-progress local tweaks the dev hasn't pushed yet.
- ❌ Adding new branding storage outside `SystemConfig` (e.g. writing logos to
  `public/`) — it bypasses the shared-config pipeline and won't appear in the
  snapshot. Keep branding in `SystemConfig`.
- ❌ Editing `shared-config.json` to change a setting "temporarily" — your edit
  will be overwritten the next time anyone runs `config:export`. Edit in the
  UI instead.

---

## 6. Extending: what NOT to sync

Don't add these to `SYNCED_KEYS` (kept intentionally local):

- Anything user-data-shaped (customers, orders, technicians, tickets) — these
  belong in seed scripts, not config sync.
- Per-dev experimentation flags (`debug.*`, `dev.*` keys).
- Anything containing real customer PII even if it lives in `SystemConfig`.

If a new piece of state needs to sync between devs but doesn't fit the
"settings page" model (e.g. a small lookup table), prefer extending the seed
script (`prisma/seed.ts`) rather than the shared-config snapshot.
