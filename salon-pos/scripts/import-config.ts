import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

function createPrisma() {
  const dbUrl = process.env.DATABASE_URL ?? "file:./dev.db";
  const adapter = new PrismaBetterSqlite3({ url: dbUrl });
  return new PrismaClient({ adapter });
}

type Snapshot = {
  _version: number;
  _exportedAt: string;
  config: Record<string, string>;
};

const INPUT_PATH = join(process.cwd(), "prisma", "shared-config.json");

async function main() {
  if (!existsSync(INPUT_PATH)) {
    console.error("❌ prisma/shared-config.json not found — ask a teammate to run `npm run config:export` and commit.");
    process.exit(1);
  }

  const raw = readFileSync(INPUT_PATH, "utf8");
  const snapshot = JSON.parse(raw) as Snapshot;
  if (snapshot._version !== 1) {
    console.error(`❌ Unsupported snapshot version: ${snapshot._version}`);
    process.exit(1);
  }

  const entries = Object.entries(snapshot.config);
  if (entries.length === 0) {
    console.log("⚠️  Snapshot is empty — nothing to import.");
    return;
  }

  const prisma = createPrisma();
  try {
    const exportedAt = new Date(snapshot._exportedAt).toLocaleString("th-TH");
    console.log(`📥 Importing ${entries.length} keys (snapshot: ${exportedAt})`);
    for (const [key, value] of entries) {
      await prisma.systemConfig.upsert({
        where: { key },
        update: { value },
        create: { key, value },
      });
      console.log(`   ✓ ${key}`);
    }
    console.log("✅ Done. Restart the dev server to pick up theme / branding changes.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(err => { console.error(err); process.exit(1); });
