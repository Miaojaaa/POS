import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { writeFileSync } from "fs";
import { join } from "path";

function createPrisma() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

const OUTPUT_PATH = join(process.cwd(), "prisma", "shared-catalog.json");

async function main() {
  const prisma = createPrisma();
  try {
    const [branches, users, serviceGroups, serviceCategories, services, products, retailProducts] =
      await Promise.all([
        prisma.branch.findMany({ orderBy: { id: "asc" } }),
        prisma.user.findMany({ orderBy: { id: "asc" } }),
        prisma.serviceGroup.findMany({ orderBy: { id: "asc" } }),
        prisma.serviceCategory.findMany({ orderBy: { id: "asc" } }),
        prisma.service.findMany({ orderBy: { id: "asc" } }),
        prisma.product.findMany({ orderBy: { id: "asc" } }),
        prisma.retailProduct.findMany({ orderBy: { id: "asc" } }),
      ]);

    const exported = {
      _version: 1,
      _exportedAt: new Date().toISOString(),
      _comment: "Edited by export-catalog.ts — do not hand-edit; re-export via `npm run catalog:export`",
      branches,
      users,
      serviceGroups,
      serviceCategories,
      services,
      products,
      retailProducts,
    };

    writeFileSync(OUTPUT_PATH, JSON.stringify(exported, null, 2) + "\n", "utf8");
    console.log(`✅ Exported catalog to prisma/shared-catalog.json`);
    console.log(`   • ${branches.length} branches`);
    console.log(`   • ${users.length} users (incl. bcrypt password hashes)`);
    console.log(`   • ${serviceGroups.length} service groups`);
    console.log(`   • ${serviceCategories.length} service categories`);
    console.log(`   • ${services.length} services`);
    console.log(`   • ${products.length} products (catalog only — stock stays per-env)`);
    console.log(`   • ${retailProducts.length} retail products (stock stays per-env on update)`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(err => { console.error(err); process.exit(1); });
