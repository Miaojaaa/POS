import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import bcrypt from "bcryptjs";
import { fileURLToPath } from "url";
import path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const adapter = new PrismaBetterSqlite3({ url: `file:${path.join(__dirname, "..", "dev.db")}` });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding multi-branch data...");

  // Branches
  const mainBranch = await prisma.branch.upsert({
    where: { id: "main" },
    update: {},
    create: { id: "main", name: "สาขาที่ 1 (Main)", address: "กรุงเทพฯ" },
  });
  const secondBranch = await prisma.branch.upsert({
    where: { id: "second" },
    update: {},
    create: { id: "second", name: "สาขาที่ 2 (Second)", address: "เชียงใหม่" },
  });

  // System config (PINs)
  await prisma.systemConfig.upsert({
    where: { key: "manager_pin" },
    update: { value: "1234" },
    create: { key: "manager_pin", value: "1234" },
  });
  await prisma.systemConfig.upsert({
    where: { key: "owner_pin" },
    update: { value: "9999" },
    create: { key: "owner_pin", value: "9999" },
  });

  // Users
  const pw = await bcrypt.hash("changeme123", 10);

  // Main Branch Staff
  await prisma.user.upsert({
    where: { email: "owner@salon.com" },
    update: { branchId: mainBranch.id },
    create: { name: "เจ้าของร้าน", email: "owner@salon.com", password: pw, role: "OWNER", branchId: mainBranch.id },
  });
  await prisma.user.upsert({
    where: { email: "manager1@salon.com" },
    update: { branchId: mainBranch.id },
    create: { name: "ผู้จัดการ สมใจ (M)", email: "manager1@salon.com", password: pw, role: "MANAGER", branchId: mainBranch.id },
  });
  await prisma.user.upsert({
    where: { email: "tech1@salon.com" },
    update: { branchId: mainBranch.id },
    create: { name: "ช่าง สมหญิง (M)", email: "tech1@salon.com", password: pw, role: "TECHNICIAN", branchId: mainBranch.id },
  });

  // Second Branch Staff
  await prisma.user.upsert({
    where: { email: "manager2@salon.com" },
    update: { branchId: secondBranch.id },
    create: { name: "ผู้จัดการ สมศักดิ์ (S)", email: "manager2@salon.com", password: pw, role: "MANAGER", branchId: secondBranch.id },
  });
  await prisma.user.upsert({
    where: { email: "tech2@salon.com" },
    update: { branchId: secondBranch.id },
    create: { name: "ช่าง มณีรัตน์ (S)", email: "tech2@salon.com", password: pw, role: "TECHNICIAN", branchId: secondBranch.id },
  });

  // Service categories
  const hairCat = await prisma.serviceCategory.upsert({
    where: { id: "cat-hair" },
    update: {},
    create: { id: "cat-hair", name: "บริการผม" },
  });

  // Services
  await prisma.service.upsert({
    where: { id: "svc-cut" },
    update: {},
    create: { id: "svc-cut", name: "ตัดผม", price: 250, categoryId: hairCat.id },
  });

  // Products & Stocks
  const prod = await prisma.product.upsert({
    where: { id: "prod-shampoo" },
    update: {},
    create: { id: "prod-shampoo", name: "แชมพูร้านเสริมสวย", unitVolumeG: 1000, costPerUnit: 400 },
  });

  await prisma.mainStock.upsert({
    where: { productId: prod.id },
    update: {},
    create: { productId: prod.id, quantity: 50 },
  });

  // SubStock for each branch
  await prisma.subStock.upsert({
    where: { productId_branchId: { productId: prod.id, branchId: mainBranch.id } },
    update: {},
    create: { productId: prod.id, branchId: mainBranch.id, quantity: 5, currentVolumeG: 1000 },
  });
  await prisma.subStock.upsert({
    where: { productId_branchId: { productId: prod.id, branchId: secondBranch.id } },
    update: {},
    create: { productId: prod.id, branchId: secondBranch.id, quantity: 3, currentVolumeG: 1000 },
  });

  console.log("Seed completed successfully!");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
