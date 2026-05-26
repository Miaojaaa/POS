// One-off migration: add RetailProduct.barcode + unique index.
// `prisma db push` can't do this on SQLite because of the unique-index redefine
// limitation. Run once: `node migrate_barcode.js` from the salon-pos directory.
const Database = require("better-sqlite3");
const path = require("path");

// dev.db actually lives at the project root (cwd), not under prisma/ — Prisma's
// adapter uses `path.resolve(process.cwd(), "dev.db")`. See src/lib/prisma.ts.
const dbPath = path.resolve(__dirname, "dev.db");
const db = new Database(dbPath);

try {
  db.exec("ALTER TABLE RetailProduct ADD COLUMN barcode TEXT");
  console.log("Column 'barcode' added.");
} catch (e) {
  console.log("Column already exists:", e.message);
}

try {
  db.exec("CREATE UNIQUE INDEX IF NOT EXISTS RetailProduct_barcode_key ON RetailProduct(barcode)");
  console.log("Unique index on barcode created.");
} catch (e) {
  console.log("Index error:", e.message);
}

db.close();
console.log("Done.");
