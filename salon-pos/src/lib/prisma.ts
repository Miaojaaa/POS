import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrisma() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set — point it at your PostgreSQL instance");
  }

  console.log(`[Prisma] Initializing PostgreSQL adapter`);

  // Note: PrismaPg adapter handles connections via connectionString directly.
  // Optional: For advanced connection pooling with PrismaPg, configure pool options in connection string or adapter config.
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

// Cleanup on exit
process.on('beforeExit', () => {
  if (globalForPrisma.prisma) {
    globalForPrisma.prisma.$disconnect();
  }
});

export const prisma = globalForPrisma.prisma ?? createPrisma();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
