import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not set");
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

function generatePin(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function uniquePin(): Promise<string> {
  for (let i = 0; i < 100; i++) {
    const pin = generatePin();
    const clash = await prisma.user.findFirst({ where: { pin }, select: { id: true } });
    if (!clash) return pin;
  }
  throw new Error("could not generate unique pin");
}

async function main() {
  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, name: true, role: true, pin: true },
    orderBy: { name: "asc" },
  });

  const rows: { name: string; role: string; pin: string; status: string }[] = [];

  for (const u of users) {
    const roles = u.role.split(",").map(r => r.trim().toUpperCase());
    const needs = roles.includes("OWNER") || roles.includes("MANAGER");
    if (!needs) continue;

    if (u.pin) {
      rows.push({ name: u.name, role: u.role, pin: u.pin, status: "existing" });
      continue;
    }

    const pin = await uniquePin();
    await prisma.user.update({ where: { id: u.id }, data: { pin } });
    rows.push({ name: u.name, role: u.role, pin, status: "generated" });
  }

  console.log("\n=== PIN รายบุคคลสำหรับ MANAGER / OWNER ===\n");
  console.log("ชื่อ".padEnd(28) + "ตำแหน่ง".padEnd(24) + "PIN".padEnd(10) + "สถานะ");
  console.log("-".repeat(72));
  for (const r of rows) {
    console.log(
      r.name.padEnd(28) +
      r.role.padEnd(24) +
      r.pin.padEnd(10) +
      (r.status === "generated" ? "ใหม่ (เพิ่งสุ่ม)" : "มีอยู่แล้ว")
    );
  }
  console.log("\nรวม " + rows.length + " คน — " + rows.filter(r => r.status === "generated").length + " คนได้รหัสใหม่\n");
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
