import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

function createPrisma() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

type Row = Record<string, any>;
type Snapshot = {
  _version: number;
  _exportedAt: string;
  branches: Row[];
  users: Row[];
  serviceGroups: Row[];
  serviceCategories: Row[];
  services: Row[];
  products: Row[];
  retailProducts: Row[];
};

const INPUT_PATH = join(process.cwd(), "prisma", "shared-catalog.json");

function reviveDates(row: Row, dateFields: string[]) {
  const out: Row = { ...row };
  for (const f of dateFields) {
    if (typeof out[f] === "string") out[f] = new Date(out[f]);
  }
  return out;
}

async function main() {
  if (!existsSync(INPUT_PATH)) {
    console.error("❌ prisma/shared-catalog.json not found — ask a teammate to run `npm run catalog:export` and commit.");
    process.exit(1);
  }

  const snap = JSON.parse(readFileSync(INPUT_PATH, "utf8")) as Snapshot;
  if (snap._version !== 1) {
    console.error(`❌ Unsupported snapshot version: ${snap._version}`);
    process.exit(1);
  }

  const prisma = createPrisma();
  const exportedAt = new Date(snap._exportedAt).toLocaleString("th-TH");
  console.log(`📥 Importing catalog snapshot from ${exportedAt}`);

  try {
    // FK order: Branch → User → ServiceGroup → ServiceCategory → Service; Product/RetailProduct are independent.

    for (const b of snap.branches) {
      const row = reviveDates(b, ["createdAt", "updatedAt"]);
      const { id, ...rest } = row;
      await prisma.branch.upsert({ where: { id }, update: rest as any, create: row as any });
    }
    console.log(`   ✓ ${snap.branches.length} branches`);

    for (const u of snap.users) {
      const row = reviveDates(u, ["createdAt", "updatedAt"]);
      const { id, ...rest } = row;
      await prisma.user.upsert({ where: { id }, update: rest as any, create: row as any });
    }
    console.log(`   ✓ ${snap.users.length} users`);

    for (const g of snap.serviceGroups) {
      const { id, ...rest } = g;
      await prisma.serviceGroup.upsert({ where: { id }, update: rest as any, create: g as any });
    }
    console.log(`   ✓ ${snap.serviceGroups.length} service groups`);

    for (const c of snap.serviceCategories) {
      const { id, ...rest } = c;
      await prisma.serviceCategory.upsert({ where: { id }, update: rest as any, create: c as any });
    }
    console.log(`   ✓ ${snap.serviceCategories.length} service categories`);

    for (const s of snap.services) {
      const { id, ...rest } = s;
      await prisma.service.upsert({ where: { id }, update: rest as any, create: s as any });
    }
    console.log(`   ✓ ${snap.services.length} services`);

    for (const p of snap.products) {
      const row = reviveDates(p, ["createdAt"]);
      const { id, ...rest } = row;
      await prisma.product.upsert({ where: { id }, update: rest as any, create: row as any });
    }
    console.log(`   ✓ ${snap.products.length} products`);

    // RetailProduct: stock is per-env — preserve it on update; seed to snapshot value on create.
    for (const r of snap.retailProducts) {
      const row = reviveDates(r, ["createdAt"]);
      const { id, stock, ...restNoStock } = row;
      await prisma.retailProduct.upsert({
        where: { id },
        update: restNoStock as any,
        create: { id, stock, ...restNoStock } as any,
      });
    }
    console.log(`   ✓ ${snap.retailProducts.length} retail products (stock preserved on update)`);

    console.log("✅ Done. Restart `next dev` so Turbopack picks up any new rows.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(err => { console.error(err); process.exit(1); });
