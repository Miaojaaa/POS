---
name: shared-config-sync
description: >
  Workflow and rules for keeping settings-page data (logo, theme colors, tax ID,
  shop address, receipt format, commission config, PINs) in sync between multiple
  developers' local SQLite databases. Use this skill whenever: (a) a dev reports
  that branding/theme/tax-ID/PIN looks wrong after a git pull, (b) a dev adds a
  new SystemConfig key, (c) anyone asks how to share settings between machines,
  (d) writing or modifying scripts/export-config.ts, scripts/import-config.ts, or
  scripts/check-config-sync.js, (e) the pre-commit hook reports "Settings sync
  check failed", or (f) one dev sees defaults (e.g. shop.name "Salon", theme
  olive, tax ID 0505567002730) while another sees customised values after a pull.
  Trigger even if the user says "settings reset after pull", "logo disappeared",
  "theme color wrong", "tax ID is default again", "config not synced", "อีกฝั่ง
  ไม่เห็น settings", "logo หาย", "ธีมเพี้ยน", "หลังจาก pull แล้วการตั้งค่าหาย".
  Also trigger when triaging an untracked prisma/shared-config.json in git status.
---

# Shared Config Sync — Salon POS

The salon-pos project uses a **local SQLite DB** (`prisma/dev.db` — git-ignored)
to store everything from staff records to branding. Most data is per-environment
(orders, customers, transfers) and **should not** sync. But a small subset — the
stuff you configure once in Settings — must look the same on every dev's machine.

This skill governs that subset.

---

## 1. What's in scope

These rows in the `SystemConfig` table are committed via `prisma/shared-config.json`:

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

---

## 2. The workflow

```
┌─ Dev A changes setting in UI ──┐
│                                │
│  npm run config:export         │  ← snapshots DB → prisma/shared-config.json
│  git add prisma/shared-config.json
│  git commit                    │  ← pre-commit hook re-runs the check
│  git push
│                                │
└────────────────────────────────┘
                ↓ git pull
┌─ Dev B picks up changes ───────┐
│                                │
│  npm install                   │  ← postinstall wires up the pre-commit hook
│  npm run config:import         │  ← applies snapshot → DB (upsert)
│  (restart dev server)          │
│                                │
└────────────────────────────────┘
```

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

1. **Is `prisma/shared-config.json` tracked in git on the pushing side?**
   ```sh
   git ls-files --error-unmatch salon-pos/prisma/shared-config.json
   ```
   Exit 0 = tracked ✅. Exit 1 = untracked ❌ → `git add` + commit + re-push.

2. **Does the snapshot reflect the pushing dev's current DB?**
   ```sh
   cd salon-pos && npm run config:check
   ```
   Exit 0 = in sync ✅. Exit 1 = DB has drifted from snapshot ❌ →
   `npm run config:export`, then stage and commit.

3. **Is the pulling dev on the same commit as the push?**
   ```sh
   git log --oneline -1 salon-pos/prisma/shared-config.json
   ```
   Both devs should report the same commit hash for that file.

4. **Did the pulling dev run `npm run config:import`?** The snapshot is data,
   not code — pulling alone does nothing until import is run.

5. **Did the pulling dev restart `next dev` after import?** Branding/theme is
   cached in some client components; a restart is the cleanest reset. If still
   stale, delete `.next/` and restart.

6. **Is the missing key actually in `SYNCED_KEYS`?** Check
   `scripts/export-config.ts` — anything not in that list is intentionally
   per-machine and will never sync.

If steps 1–6 all pass and behaviour is still wrong, the bug is in the
application code (reading the wrong key, caching too aggressively), not in
the sync pipeline.

---

## 3b. The pre-commit hook

`.githooks/pre-commit` (wired up by `npm install` → `setup-hooks.js`) runs
`scripts/check-config-sync.js` before every commit. The check:

- Opens `prisma/dev.db` read-only with `better-sqlite3`
- Reads every `SYNCED_KEYS` row from the `SystemConfig` table
- Diffs against `prisma/shared-config.json`
- Exits non-zero (blocking the commit) if any key has drifted

The hook is silent when everything matches, prints a "drifted keys" list and
the exact fix command when it doesn't, and skips itself if `dev.db` is absent
(fresh clone) or the `SystemConfig` table doesn't exist yet (pre-seed).

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
| Hook never runs on commit | `core.hooksPath` not configured | `cd salon-pos && npm run setup-hooks` |
| `shared-config.json` shows as `??` in `git status` | Snapshot exists but was never `git add`-ed | `git add salon-pos/prisma/shared-config.json` |

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
