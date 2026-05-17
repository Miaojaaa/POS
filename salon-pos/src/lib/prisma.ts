import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import path from "path";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrisma() {
  // Use absolute path to ensure consistency across different execution environments
  const dbPath = path.resolve(process.cwd(), "dev.db");
  const dbUrl = process.env.DATABASE_URL ?? `file:${dbPath}`;
  
  console.log(`[Prisma] Initializing with DB at: ${dbUrl}`);
  
  const adapter = new PrismaBetterSqlite3({ url: dbUrl });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrisma();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
