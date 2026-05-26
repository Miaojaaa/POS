#!/usr/bin/env node
// One-shot "make this machine match the snapshot" helper.
// Safe to re-run: prisma db push + generate are idempotent, and the import
// scripts upsert by id (RetailProduct.stock is preserved on update).

const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const cwd = path.resolve(__dirname, "..");

function step(name, cmd, args, { warnOnly = false } = {}) {
  console.log("\n→ " + name);
  console.log("  $ " + cmd + " " + args.join(" "));
  const r = spawnSync(cmd, args, { cwd, stdio: "inherit", shell: process.platform === "win32" });
  if (r.status !== 0) {
    if (warnOnly) {
      console.warn("\n⚠  " + name + " exited " + r.status + ". Continuing — this is usually safe if your DB is already in sync.");
      return false;
    }
    console.error("\n✖  " + name + " failed (exit " + r.status + "). Aborting bootstrap.");
    process.exit(r.status || 1);
  }
  return true;
}

console.log("Salon POS bootstrap — sync this machine's DB to the repo snapshots.");

// Prisma 7's `db push` already regenerates the client as part of the push.
// On a DB that's already in sync this can fail with SQLite "cannot drop index"
// noise — warnOnly lets the rest of bootstrap proceed since `prisma generate`
// below will still refresh the client.
step("Push schema → dev.db (creates/updates tables, no data loss; regenerates client)",
  "npx", ["prisma", "db", "push"], { warnOnly: true });

// Ensure the client matches schema.prisma even if db push above no-op'd / warned.
step("Regenerate Prisma client (in case db push warned)",
  "npx", ["prisma", "generate"]);

const configSnap = path.join(cwd, "prisma", "shared-config.json");
if (fs.existsSync(configSnap)) {
  step("Import SystemConfig snapshot (branding, theme, PINs)",
    "npm", ["run", "config:import"]);
} else {
  console.log("\n↷ prisma/shared-config.json not found — skipping config import.");
}

const catalogSnap = path.join(cwd, "prisma", "shared-catalog.json");
if (fs.existsSync(catalogSnap)) {
  step("Import catalog snapshot (services, staff, products)",
    "npm", ["run", "catalog:import"]);
} else {
  console.log("\n↷ prisma/shared-catalog.json not found — skipping catalog import.");
}

console.log("\n✅ Bootstrap complete.");
console.log("   If `next dev` is running, stop it, delete .next/, then `npm run dev`.");
console.log("   Turbopack caches the Prisma client in memory and won't pick up the new schema otherwise.");
