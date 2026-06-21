// One-shot data migration: copy every row from the legacy SQLite dev.db into
// the new PostgreSQL database (schema must already be applied via
// `prisma migrate deploy` / `prisma db push`).
//
//   Dry run (reads SQLite only, no Postgres needed — prints row counts):
//     node --experimental-sqlite scripts/migrate-sqlite-to-postgres.mjs --dry-run
//
//   Real run (writes to the DB in DATABASE_URL):
//     node --experimental-sqlite scripts/migrate-sqlite-to-postgres.mjs
//
//   Options:
//     --db=<path>   path to the SQLite file (default: ./dev.db)
//
// Idempotent: uses createMany({ skipDuplicates: true }) so re-running won't
// duplicate rows. Field types (Boolean 0/1, DateTime strings, @map columns)
// are derived from Prisma's DMMF, so this stays correct if the schema changes.
import "dotenv/config";
import { DatabaseSync } from "node:sqlite";
import { PrismaClient, Prisma } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const DRY_RUN = process.argv.includes("--dry-run");
const dbArg = process.argv.find((a) => a.startsWith("--db="));
const SQLITE_PATH = dbArg ? dbArg.slice(5) : "./dev.db";

// FK-safe insertion order: parents before children.
const ORDER = [
  "Branch",
  "ServiceGroup",
  "ServiceCategory",
  "Service",
  "Product",
  "RetailProduct",
  "User",
  "Customer",
  "MainStock",
  "SubStock",
  "TicketDefinition",
  "Order",
  "OrderItem",
  "OrderRetailItem",
  "OrderAssistant",
  "OrderChemical",
  "Payment",
  "WalletTransaction",
  "CustomerTicket",
  "ServiceHistory",
  "StockTransfer",
  "StockTransferItem",
  "Expense",
  "PayrollRun",
  "PayrollItem",
  "DiscountLog",
  "AuditLog",
  "SystemConfig",
];

// Build per-model column metadata from Prisma's DMMF.
const metaByModel = {};
for (const m of Prisma.dmmf.datamodel.models) {
  const scalars = m.fields.filter((f) => f.kind === "scalar");
  metaByModel[m.name] = {
    table: m.dbName || m.name, // SQLite table name (no @@map in this schema)
    delegate: m.name[0].toLowerCase() + m.name.slice(1),
    fields: scalars.map((f) => ({ col: f.dbName || f.name, name: f.name, type: f.type })),
  };
}

function coerce(type, v) {
  if (v === null || v === undefined) return null;
  if (typeof v === "bigint") v = Number(v);
  if (type === "Boolean") return Boolean(v);
  if (type === "DateTime") return v instanceof Date ? v : new Date(v);
  return v;
}

const db = new DatabaseSync(SQLITE_PATH, { readOnly: true });

function readTable(meta) {
  let rows;
  try {
    rows = db.prepare(`SELECT * FROM "${meta.table}" ORDER BY rowid ASC`).all();
  } catch (e) {
    if (/no such table/i.test(String(e && e.message))) return [];
    throw e;
  }
  return rows.map((r) => {
    const out = {};
    for (const f of meta.fields) {
      if (!(f.col in r)) continue; // legacy DB may lack a newer column
      out[f.name] = coerce(f.type, r[f.col]);
    }
    return out;
  });
}

async function main() {
  // Safety: make sure no model is silently skipped.
  const allModels = Prisma.dmmf.datamodel.models.map((m) => m.name);
  const missing = allModels.filter((n) => !ORDER.includes(n));
  if (missing.length) {
    console.error("✖ These models are not listed in ORDER — aborting:", missing.join(", "));
    process.exit(1);
  }

  if (DRY_RUN) {
    let total = 0;
    for (const name of ORDER) {
      const data = readTable(metaByModel[name]);
      total += data.length;
      console.log(String(data.length).padStart(6), name);
    }
    console.log("------");
    console.log(String(total).padStart(6), "TOTAL rows (read + transformed OK)");
    db.close();
    return;
  }

  if (!process.env.DATABASE_URL) {
    console.error("✖ DATABASE_URL is not set");
    process.exit(1);
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  try {
    for (const name of ORDER) {
      const meta = metaByModel[name];
      const data = readTable(meta);
      if (!data.length) {
        console.log(`·  ${name}: nothing to copy`);
        continue;
      }
      const res = await prisma[meta.delegate].createMany({ data, skipDuplicates: true });
      const skipped = data.length - res.count;
      console.log(`✓  ${name}: inserted ${res.count}${skipped ? ` (skipped ${skipped} existing)` : ""}`);
    }
    console.log("\n✅ Data migration complete.");
  } finally {
    await prisma.$disconnect();
    db.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
