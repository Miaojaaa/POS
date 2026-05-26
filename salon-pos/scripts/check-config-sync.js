#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const SYNCED_KEYS = [
  "shop.name",
  "shop.logo",
  "shop.address",
  "shop.taxId",
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

const salonPos = path.resolve(__dirname, "..");
const dbPath = path.join(salonPos, "prisma", "dev.db");
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

if (!fs.existsSync(dbPath)) process.exit(0);

if (!fs.existsSync(snapPath)) {
  fail([
    "prisma/shared-config.json is missing.",
    "Your local DB has settings that no teammate will receive.",
  ]);
}

let dbRows;
try {
  const db = new Database(dbPath, { readonly: true, fileMustExist: true });
  try {
    const placeholders = SYNCED_KEYS.map(() => "?").join(",");
    dbRows = db
      .prepare(`SELECT "key", "value" FROM "SystemConfig" WHERE "key" IN (${placeholders})`)
      .all(...SYNCED_KEYS);
  } finally {
    db.close();
  }
} catch (e) {
  if (/no such table/i.test(String(e && e.message))) process.exit(0);
  console.error("[check-config-sync] could not open DB:", e.message || e);
  process.exit(0);
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
