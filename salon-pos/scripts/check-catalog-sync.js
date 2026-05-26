#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const salonPos = path.resolve(__dirname, "..");
const dbPath = path.join(salonPos, "dev.db");
const snapPath = path.join(salonPos, "prisma", "shared-catalog.json");

// boolFields and dateFields lists keep DB (0/1, "+00:00") and snapshot (true/false, "Z")
// representations comparable without going through Prisma client.
const TABLES = [
  { table: "Branch", key: "branches", boolFields: ["isActive"], dateFields: ["createdAt", "updatedAt"] },
  { table: "User", key: "users", boolFields: ["isActive"], dateFields: ["createdAt", "updatedAt"] },
  { table: "ServiceGroup", key: "serviceGroups", boolFields: [], dateFields: [] },
  { table: "ServiceCategory", key: "serviceCategories", boolFields: [], dateFields: [] },
  { table: "Service", key: "services", boolFields: ["isActive"], dateFields: [] },
  {
    table: "Product",
    key: "products",
    boolFields: ["sellable", "isActive"],
    dateFields: ["createdAt"],
    // schema.prisma: unitVolumeG @map("unitVolumeMg") — code name is canonical
    renameFields: { unitVolumeMg: "unitVolumeG" },
  },
  {
    table: "RetailProduct",
    key: "retailProducts",
    boolFields: ["usableAsChemical", "isActive"],
    dateFields: ["createdAt"],
    excludeFields: ["stock"],
  },
];

function fail(lines) {
  console.error("");
  console.error("✖  Catalog sync check failed — your push would not reach teammates.");
  for (const l of lines) console.error("   " + l);
  console.error("");
  console.error("   Fix: cd salon-pos && npm run catalog:export");
  console.error("        git add salon-pos/prisma/shared-catalog.json");
  console.error("        # then re-run your commit");
  console.error("");
  console.error("   To bypass once (NOT recommended): git commit --no-verify");
  console.error("");
  process.exit(1);
}

if (!fs.existsSync(dbPath)) process.exit(0);

if (!fs.existsSync(snapPath)) {
  fail([
    "prisma/shared-catalog.json is missing.",
    "Catalog rows (services/users/etc.) in your DB will not reach teammates.",
  ]);
}

let snap;
try {
  snap = JSON.parse(fs.readFileSync(snapPath, "utf8"));
} catch (e) {
  fail(["prisma/shared-catalog.json is not valid JSON: " + (e.message || e)]);
}

const db = new Database(dbPath, { readonly: true, fileMustExist: true });
try {
  const drifted = [];
  for (const { table, key, boolFields, dateFields, excludeFields = [], renameFields = {} } of TABLES) {
    let dbRows;
    try {
      dbRows = db.prepare(`SELECT * FROM "${table}" ORDER BY id ASC`).all();
    } catch (e) {
      if (/no such table/i.test(String(e && e.message))) continue;
      throw e;
    }

    const snapRows = Array.isArray(snap[key]) ? snap[key] : [];
    if (dbRows.length !== snapRows.length) {
      drifted.push(`${table}: db has ${dbRows.length} rows, snapshot has ${snapRows.length}`);
      continue;
    }

    const normalize = row => {
      const out = {};
      for (const rawKey of Object.keys(row).sort()) {
        if (excludeFields.includes(rawKey)) continue;
        const k = renameFields[rawKey] || rawKey;
        let v = row[rawKey];
        if (boolFields.includes(k) && (v === 0 || v === 1)) v = Boolean(v);
        if (dateFields.includes(k) && typeof v === "string" && v) v = new Date(v).toISOString();
        if (v instanceof Date) v = v.toISOString();
        out[k] = v;
      }
      // re-sort after rename so key order matches between DB and snapshot
      return Object.fromEntries(Object.keys(out).sort().map(k => [k, out[k]]));
    };

    for (let i = 0; i < dbRows.length; i++) {
      const a = JSON.stringify(normalize(dbRows[i]));
      const b = JSON.stringify(normalize(snapRows[i]));
      if (a !== b) {
        drifted.push(`${table}: row id=${dbRows[i].id} differs`);
        break;
      }
    }
  }

  if (drifted.length > 0) {
    fail([
      "These catalog tables are out of sync with prisma/shared-catalog.json:",
      ...drifted.map(d => "  - " + d),
      "Snapshot will not reflect your latest catalog changes.",
    ]);
  }
} finally {
  db.close();
}

process.exit(0);
