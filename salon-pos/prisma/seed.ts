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
  console.log("Seeding master data...");

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
  await prisma.systemConfig.upsert({
    where: { key: "line_inactive_days" },
    update: {},
    create: { key: "line_inactive_days", value: "60" },
  });

  // Users
  const ownerPw = await bcrypt.hash("owner123", 10);
  const managerPw = await bcrypt.hash("manager123", 10);
  const cashierPw = await bcrypt.hash("cashier123", 10);
  const techPw = await bcrypt.hash("tech123", 10);

  await prisma.user.upsert({
    where: { email: "owner@salon.com" },
    update: {},
    create: { name: "เจ้าของร้าน", email: "owner@salon.com", password: ownerPw, role: "OWNER", phone: "0891234567" },
  });
  await prisma.user.upsert({
    where: { email: "manager@salon.com" },
    update: {},
    create: { name: "ผู้จัดการ สมใจ", email: "manager@salon.com", password: managerPw, role: "MANAGER", phone: "0812345678" },
  });
  await prisma.user.upsert({
    where: { email: "cashier@salon.com" },
    update: {},
    create: { name: "แคชเชียร์ นงนุช", email: "cashier@salon.com", password: cashierPw, role: "CASHIER", phone: "0823456789" },
  });
  await prisma.user.upsert({
    where: { email: "tech1@salon.com" },
    update: {},
    create: { name: "ช่าง สมหญิง", email: "tech1@salon.com", password: techPw, role: "TECHNICIAN", phone: "0834567890" },
  });
  await prisma.user.upsert({
    where: { email: "tech2@salon.com" },
    update: {},
    create: { name: "ช่าง มณีรัตน์", email: "tech2@salon.com", password: techPw, role: "TECHNICIAN", phone: "0845678901" },
  });
  await prisma.user.upsert({
    where: { email: "assist1@salon.com" },
    update: {},
    create: { name: "ผู้ช่วย สุดา", email: "assist1@salon.com", password: techPw, role: "ASSISTANT", phone: "0856789012" },
  });

  // Service categories
  const hairCat = await prisma.serviceCategory.upsert({
    where: { id: "cat-hair" },
    update: {},
    create: { id: "cat-hair", name: "บริการผม", icon: "scissors" },
  });
  const nailCat = await prisma.serviceCategory.upsert({
    where: { id: "cat-nail" },
    update: {},
    create: { id: "cat-nail", name: "บริการเล็บ", icon: "nail" },
  });
  const spaCat = await prisma.serviceCategory.upsert({
    where: { id: "cat-spa" },
    update: {},
    create: { id: "cat-spa", name: "สปา", icon: "spa" },
  });

  // Services
  const services = [
    { id: "svc-cut", name: "ตัดผม", price: 250, duration: 45, categoryId: hairCat.id },
    { id: "svc-color", name: "ทำสี/ย้อมผม", price: 1200, duration: 120, categoryId: hairCat.id },
    { id: "svc-perm", name: "ดัดผม", price: 1500, duration: 150, categoryId: hairCat.id },
    { id: "svc-treat", name: "สปาผม", price: 600, duration: 60, categoryId: hairCat.id },
    { id: "svc-blowdry", name: "เป่าผม", price: 200, duration: 30, categoryId: hairCat.id },
    { id: "svc-nail-mani", name: "ทำเล็บมือ", price: 400, duration: 60, categoryId: nailCat.id },
    { id: "svc-nail-pedi", name: "ทำเล็บเท้า", price: 500, duration: 75, categoryId: nailCat.id },
    { id: "svc-gel", name: "ต่อเล็บเจล", price: 800, duration: 90, categoryId: nailCat.id },
    { id: "svc-spa-foot", name: "สปาเท้า", price: 450, duration: 60, categoryId: spaCat.id },
    { id: "svc-spa-head", name: "สปาหัว", price: 350, duration: 45, categoryId: spaCat.id },
  ];

  for (const svc of services) {
    await prisma.service.upsert({
      where: { id: svc.id },
      update: {},
      create: svc,
    });
  }

  // Products (chemicals)
  const products = [
    { id: "prod-color-a", name: "ครีมเปลี่ยนสี Brand A", unitVolumeG: 500, costPerUnit: 850, reorderPoint: 1000 },
    { id: "prod-color-b", name: "ครีมเปลี่ยนสี Brand B", unitVolumeG: 500, costPerUnit: 750, reorderPoint: 500 },
    { id: "prod-developer", name: "น้ำยาออกซิเดนท์ 6%", unitVolumeG: 1000, costPerUnit: 300, reorderPoint: 2000 },
    { id: "prod-perm-sol", name: "น้ำยาดัดผม", unitVolumeG: 400, costPerUnit: 450, reorderPoint: 400 },
    { id: "prod-treat", name: "ทรีทเมนท์บำรุงผม", unitVolumeG: 300, costPerUnit: 650, reorderPoint: 600 },
    { id: "prod-shampoo", name: "แชมพูร้านเสริมสวย", unitVolumeG: 1000, costPerUnit: 400, reorderPoint: 3000 },
  ];

  for (const prod of products) {
    const p = await prisma.product.upsert({
      where: { id: prod.id },
      update: {},
      create: prod,
    });
    await prisma.mainStock.upsert({
      where: { productId: p.id },
      update: {},
      create: { productId: p.id, quantity: 10 },
    });
    await prisma.subStock.upsert({
      where: { productId: p.id },
      update: {},
      create: { productId: p.id, quantity: 2, currentVolumeG: prod.unitVolumeG },
    });
  }

  // Commission pools
  await prisma.commissionPool.upsert({
    where: { id: "pool-tech" },
    update: {},
    create: { id: "pool-tech", name: "Pools ช่างใหญ่", role: "TECHNICIAN", percentage: 10 },
  });
  await prisma.commissionPool.upsert({
    where: { id: "pool-assist" },
    update: {},
    create: { id: "pool-assist", name: "Pools ผู้ช่วยช่าง", role: "ASSISTANT", percentage: 5 },
  });

  // Sample customers
  const customers = [
    { id: "cust-1", name: "คุณสมหญิง รักสวย", phone: "0891111111", memberLevel: "GOLD", walletBalance: 5000 },
    { id: "cust-2", name: "คุณมาลี ดอกไม้", phone: "0892222222", memberLevel: "SILVER", walletBalance: 2000, allergyHistory: "แพ้สี Ammonia สูง ห้ามใช้ Brand X" },
    { id: "cust-3", name: "คุณนิดา สวยงาม", phone: "0893333333", memberLevel: "BASIC", walletBalance: 0 },
  ];

  for (const cust of customers) {
    await prisma.customer.upsert({
      where: { id: cust.id },
      update: {},
      create: cust,
    });
  }

  // Ticket definitions
  await prisma.ticketDefinition.upsert({
    where: { id: "tdef-spa" },
    update: {},
    create: { id: "tdef-spa", name: "สปาผมฟรี 1 ครั้ง", type: "SERVICE", serviceId: "svc-treat" },
  });
  await prisma.ticketDefinition.upsert({
    where: { id: "tdef-color-disc" },
    update: {},
    create: { id: "tdef-color-disc", name: "ส่วนลด 20% ทำสี", type: "DISCOUNT", discountPct: 20 },
  });

  console.log("Seed completed successfully!");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
