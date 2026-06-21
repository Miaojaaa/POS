#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

const salonPos = path.resolve(__dirname, "..");
require("dotenv").config({ path: path.join(salonPos, ".env") });

const SYNCED_KEYS = [
  "shop.name",
  "shop.logo",
  "shop.address",
  "shop.taxId",
  "shop.receiptFooterBlocks",
  "theme.main",
  "theme.secondary",
  "theme.third",
  "finance.commissionMode",
  "finance.positionAllowance",
  "finance.vatMode",
  "finance.commission.pool.tech",
  "finance.commission.pool.assist",
  "finance.commission.perHead.tech",
  "finance.commission.perHead.assist",
  "receipt.format.short",
  "receipt.format.full",
  "sidebar.config",
  "owner_pin",
  "manager_pin",
  "line_inactive_days",
];

const snapPath = path.join(salonPos, "prisma", "shared-config.json");

function fail(lines) {
  console.error("");
  console.error("✖  Settings sync check failed — your push would not reach teammates.");
  for (const l of lines) console.error("   " + l);
  console.error("");
  console.error("   Fix: cd salon-pos && npm run config:export");
  console.error("        git add salon-pos/prisma/shared-config.json");
  console.error("        # then re-run your commit");
  console.error("");
  console.error("   To bypass once (NOT recommended): git commit --no-verify");
  console.error("");
  process.exit(1);
}

// Fail-open: without a reachable DB there is nothing to compare, so don't block
// the commit (matches the old behaviour when prisma/dev.db was absent).
async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) process.exit(0);

  if (!fs.existsSync(snapPath)) {
    fail([
      "prisma/shared-config.json is missing.",
      "Your local DB has settings that no teammate will receive.",
    ]);
  }

  let dbRows;
  const client = new Client({ connectionString });
  try {
    await client.connect();
    const res = await client.query(
      `SELECT "key", "value" FROM "SystemConfig" WHERE "key" = ANY($1::text[])`,
      [SYNCED_KEYS]
    );
    dbRows = res.rows;
  } catch (e) {
    // 42P01 = undefined_table (schema not pushed yet); any connection problem
    // is treated as "can't check" → let the commit through.
    if (e && e.code === "42P01") process.exit(0);
    console.error("[check-config-sync] could not query DB:", (e && e.message) || e);
    process.exit(0);
  } finally {
    await client.end().catch(() => {});
  }

  let snap;
  try {
    snap = JSON.parse(fs.readFileSync(snapPath, "utf8")).config || {};
  } catch (e) {
    fail(["prisma/shared-config.json is not valid JSON: " + (e.message || e)]);
  }

  const dbMap = Object.create(null);
  for (const r of dbRows) dbMap[r.key] = r.value;

  const drifted = [];
  for (const key of SYNCED_KEYS) {
    const inDb = key in dbMap;
    const inSnap = key in snap;
    if (!inDb && !inSnap) continue;
    if (dbMap[key] !== snap[key]) drifted.push(key);
  }

  if (drifted.length > 0) {
    fail([
      "These SystemConfig keys are out of sync with prisma/shared-config.json:",
      ...drifted.map(k => "  - " + k),
      "Snapshot will not reflect your latest Settings UI changes.",
    ]);
  }

  process.exit(0);
}

main();
