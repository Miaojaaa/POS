<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Dev environment tips

- Source lives in `salon-pos/`. All `npm` commands below assume you are inside that directory.
- Stack: Next.js 16 (App Router) + React 19 + Prisma 7 + PostgreSQL (via the `@prisma/adapter-pg` driver adapter) + NextAuth v5 beta. **Do not** assume training-data API shapes — see the `BEGIN:nextjs-agent-rules` block above. (History: the DB was SQLite until 2026-06; any lingering `dev.db` references are historical.)
- `npm run dev` boots the dev server. The script uses Windows `set NODE_OPTIONS=…` syntax — on macOS/Linux replace with `NODE_OPTIONS=--max-old-space-size=8192 next dev`.
- `npm run seed` re-seeds the database via `prisma/seed.ts` (also runs as Prisma's seed hook). It connects through `DATABASE_URL` — make sure your PostgreSQL is running and the schema is applied (`prisma migrate dev` / `prisma db push`) first.
- Env: `DATABASE_URL` in `.env` is the only required variable — a PostgreSQL connection string (`postgresql://user:pass@host:5432/db?schema=public`). Prisma loads it via `prisma.config.ts` (`import "dotenv/config"`), not Prisma's built-in loader. The Prisma client is constructed with a `PrismaPg` adapter in `src/lib/prisma.ts`; the datasource block in `schema.prisma` has no `url` (Prisma 7 forbids it there — the URL lives in `prisma.config.ts`).
- Cross-page settings live in `SystemConfig` (key/value rows) and are exposed at `/api/system-config`. Branding is separate at `/api/branding`. When you save either, dispatch the matching window event so already-open tabs refresh without reload:
  - `system-config-updated` — finance, sidebar, receipt format
  - `branding-updated` — shop name / address / taxId / logo / theme
- Multi-dev sync uses two snapshots in `prisma/` (both committed; each dev runs their own PostgreSQL, never committed):
  - `shared-config.json` — `SystemConfig` rows (branding, finance, PINs, receipt format). Export with `npm run config:export`, import with `npm run config:import`. Whitelist in `scripts/export-config.ts` → `SYNCED_KEYS`.
  - `shared-catalog.json` — `Branch`, `User` (incl. bcrypt password hashes), `ServiceGroup`, `ServiceCategory`, `Service`, `Product`, `RetailProduct` catalog rows. Export with `npm run catalog:export`, import with `npm run catalog:import`. The catalog import excludes `RetailProduct.stock` on update to preserve per-env inventory counts. Tables dumped are defined in `scripts/export-catalog.ts`.
  - A pre-commit hook (`.githooks/pre-commit`, wired up by `npm install` → `scripts/setup-hooks.js`) runs both `check-config-sync.js` and `check-catalog-sync.js` and blocks any commit whose live PostgreSQL DB has drifted from either snapshot. These checks query the DB via `pg` using `DATABASE_URL` and **fail open** — if the DB is unreachable they let the commit through rather than blocking it.
  - After a pull that touches `schema.prisma` or either snapshot, run `npm run bootstrap` — a single command that does `prisma db push` + `prisma generate` + both imports in order, idempotently. This is the fix when an API route returns 500 with `Cannot read properties of undefined` or `no such column` after pulling.
  - See `.agent/skills/shared-config-sync/SKILL.md` for the full workflow, diagnostic checklist, and anti-patterns.
- Save-button convention: snapshot loaded values into a JSON-string state (`initial`), compute `dirty = initial !== "" && JSON.stringify(current) !== initial`, pass `disabled={!dirty}` (plus `saving`). For create-only forms, disable until required fields are filled. The grey-out look is owned by `.btn-primary:disabled` in `globals.css` — **don't** add inline `opacity` / `cursor` styles.
- Payroll: `generatePayrollRun(month, year)` in `src/lib/payroll.ts` deletes-and-recreates the run from scratch, and `GET /api/payroll` regenerates on every request while `status === "DRAFT"`. Changes to `finance.commissionMode` or the formula take effect on the next poll (every 8s on the Payroll page). `CONFIRMED` runs are frozen — only `baseSalary` / `positionAllowance` re-sync from the User table.
- Receipt numbers: always assemble via `buildReceiptNumber(seq, date, cfg)` from `src/lib/system-config.ts`. FULL tax-invoice numbers are snapshotted onto the `Order` row (`taxInvoiceNumber`, `taxInvoiceIssuedAt`, customer fields) on first issuance and must not be regenerated on reprint (Thai tax-law requirement).
- Unit-of-measure trap: chemical volumes are **grams** in code (`unitVolumeG`, `amountG`, `costPerG`) but `@map("unitVolumeMg")` in Prisma. The DB column name is historical; the field name in code is authoritative.
- Search bar convention: any "type-to-find-a-product" input must use `<SearchInput>` from `src/components/SearchInput.tsx`. The canonical look is the chemical/retail pickers in `src/app/(main)/pos/new/page.tsx` (input has `paddingLeft: 2rem` + a 🔍 prefix in the placeholder; dropdown is absolute-positioned with `border: 1px solid var(--beige-dark)`, `borderRadius: 8`, `boxShadow: 0 4px 16px rgba(0,0,0,0.12)`, `maxHeight: 220`, items at `padding: 9px 14px` with hover bg `var(--beige)`). `SearchInput` already encodes this — do not re-implement it inline in new pages, and don't introduce new `.search-*` CSS classes. The ERP stock pages (`erp/main`, `erp/sub`, `erp/retail`) and the transfer modal (`erp/transfers`) all use this component; match them when adding new product search UI.
- PIN management: PINs for OWNER/MANAGER users are **auto-generated server-side** by `src/lib/auth.ts → generateUniquePin()`. The Staff form has no PIN input — POST `/api/users` and PUT `/api/users/[id]` mint a 6-digit PIN whenever a user gains an OWNER/MANAGER role without one, and return it as `generatedPin` in the response. The frontend reveals it exactly once via `<PinRevealModal>` (`src/components/PinRevealModal.tsx`), which forces the operator to type the PIN back before closing — that keystroke is the only acknowledgement, since the PIN is never re-shown. Existing PINs are never rotated by an update; demoting then re-promoting a user reuses the dormant PIN. For one-time backfill of historical managers, run `npx tsx scripts/backfill-manager-pins.ts`.

# Testing instructions

- There is no automated test suite. Verify changes by running the affected flow locally with `npm run dev` and exercising the golden path + the obvious edge case (e.g. for payroll, switch `commissionMode` in Finance settings and confirm both Payroll and KPI columns update).
- Type-check with `npx tsc --noEmit`. The validator currently emits one known stale error referencing `src/app/(main)/reports/profit/page.js` from a deleted route — that file no longer exists; deleting `.next/types` clears it. Ignore that single error; treat any other error as a real failure.
- Lint with `npm run lint`. Fix warnings related to files you touched; don't drive-by-fix unrelated noise.
- Build smoke-test with `npm run build` before raising a PR that touches build-critical files (routes, layouts, `next.config.ts`, Prisma schema).
- For schema changes: run `npx prisma migrate dev --name <descriptive>` so a migration is committed, then re-seed if existing data is incompatible. Never edit a migration file after it has been committed and applied.
- After **any** schema change (new model, new field, renamed relation): stop `next dev`, run `npx prisma generate`, delete `.next/`, then `npm run dev` again. Turbopack caches the Prisma client in memory and does not hot-reload it — calling a newly added `prisma.<model>` from an API route in an un-restarted server returns 500 with `Cannot read properties of undefined` even though the DB and schema are both correct.

# PR instructions

- Title format: short, lowercase, imperative — match the existing log style (e.g. `update save button`, `fix commission structure`, `add aesthetic feature`). Avoid bracketed prefixes.
- Keep PRs scoped to one concern. UI tweaks, schema migrations, and seed-data changes should each be their own PR when practical.
- Before opening a PR:
  1. `npx tsc --noEmit` clean (modulo the known stale-profit error above)
  2. `npm run lint` clean for files you changed
  3. `npm run build` succeeds if you touched routes / config / schema
  4. Run the feature manually in the browser — screenshots in the PR body for any UI change
- Don't commit: `prisma/dev.db`, `.env`, anything under `.next/`, logos / customer data baked into seed files.
- When you add a new `SystemConfig` key, update the `ALL_KEYS` array in `src/app/api/system-config/route.ts` and the matching default in `src/lib/system-config.ts` in the same PR — otherwise the GET handler returns stale data.
- The default branch is `main`; there is no required base branch or CI gate today, so the author is responsible for the checks above.
