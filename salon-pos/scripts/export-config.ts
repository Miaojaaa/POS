import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { writeFileSync } from "fs";
import { join } from "path";

function createPrisma() {
  const dbUrl = process.env.DATABASE_URL ?? "file:./dev.db";
  const adapter = new PrismaBetterSqlite3({ url: dbUrl });
  return new PrismaClient({ adapter });
}

// Whitelist of SystemConfig keys that are shared between dev machines.
// Anything outside this list (per-device state, ephemeral cache) stays local.
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
] as const;

const OUTPUT_PATH = join(process.cwd(), "prisma", "shared-config.json");

async function main() {
  const prisma = createPrisma();
  try {
    const rows = await prisma.systemConfig.findMany({
      where: { key: { in: [...SYNCED_KEYS] } },
      orderBy: { key: "asc" },
    });

    const exported = {
      _version: 1,
      _exportedAt: new Date().toISOString(),
      _comment: "Edited by export-config.ts — do not hand-edit unless syncing manual changes",
      config: Object.fromEntries(rows.map(r => [r.key, r.value])),
    };

    writeFileSync(OUTPUT_PATH, JSON.stringify(exported, null, 2) + "\n", "utf8");
    console.log(`✅ Exported ${rows.length} keys to prisma/shared-config.json`);
    rows.forEach(r => console.log(`   • ${r.key} (${r.value.length} chars)`));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(err => { console.error(err); process.exit(1); });
