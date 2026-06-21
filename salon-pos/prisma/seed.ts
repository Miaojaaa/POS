import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { faker } from "@faker-js/faker/locale/th";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not set");

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Starting mock data generation...");

  // 1. Branches
  const mainBranch = await prisma.branch.upsert({
    where: { id: "main" },
    update: {},
    create: { id: "main", name: "หนองหอย", address: "เชียงใหม่" },
  });
  const secondBranch = await prisma.branch.upsert({
    where: { id: "second" },
    update: {},
    create: { id: "second", name: "จริงใจ", address: "เชียงใหม่" },
  });
  const branches = [mainBranch, secondBranch];

  // 2. Clear existing (optional, but let's just add new ones or rely on the fact that this is a fresh run)
  
  // 3. Staff (20 users total)
  const pw = await bcrypt.hash("changeme123", 10);
  const users = [];
  const roles = [
    ...Array(10).fill("TECHNICIAN"), 
    ...Array(5).fill("ASSISTANT"), 
    ...Array(3).fill("MANAGER"), // Manager/Tech
    ...Array(2).fill("CONTENT_CREATOR")
  ];
  
  console.log("Generating Staff...");
  for (let i = 0; i < roles.length; i++) {
    const role = roles[i];
    const branch = i % 2 === 0 ? mainBranch : secondBranch;
    const user = await prisma.user.create({
      data: {
        name: faker.person.fullName(),
        email: faker.internet.email(),
        password: pw,
        role: role,
        branchId: branch.id,
        phone: faker.phone.number(),
      }
    });
    users.push(user);
  }

  // 4. Products & Retail
  console.log("Generating Products...");
  // 50 Chemicals (Product)
  for(let i = 0; i < 50; i++) {
    const p = await prisma.product.create({
      data: {
        name: `เคมี ${faker.commerce.productName()}`,
        unitVolumeG: 1000,
        costPerUnit: faker.number.int({ min: 100, max: 1000 }),
        sellable: false,
        mainStock: { create: { quantity: faker.number.int({ min: 10, max: 50 }) } },
        subStocks: {
          create: branches.map(b => ({
            branchId: b.id,
            quantity: faker.number.int({ min: 5, max: 20 }),
            currentVolumeG: 1000
          }))
        }
      }
    });
  }

  // 50 Retail (RetailProduct, usableAsChemical = false)
  for(let i = 0; i < 50; i++) {
    await prisma.retailProduct.create({
      data: {
        name: `สินค้า ${faker.commerce.productName()}`,
        price: faker.number.int({ min: 200, max: 2000 }),
        stock: faker.number.int({ min: 10, max: 100 }),
        usableAsChemical: false
      }
    });
  }

  // 50 Dual-use (RetailProduct, usableAsChemical = true)
  for(let i = 0; i < 50; i++) {
    await prisma.retailProduct.create({
      data: {
        name: `ทรีทเม้นท์ ${faker.commerce.productName()}`,
        price: faker.number.int({ min: 200, max: 2000 }),
        stock: faker.number.int({ min: 10, max: 100 }),
        usableAsChemical: true,
        unitVolumeG: 500,
        costPerG: faker.number.float({ min: 0.5, max: 2, fractionDigits: 2 })
      }
    });
  }

  // Create some services to use in orders
  const hairCat = await prisma.serviceCategory.upsert({
    where: { id: "cat-hair" },
    update: {},
    create: { id: "cat-hair", name: "บริการผม" },
  });
  const svc = await prisma.service.upsert({
    where: { id: "svc-premium" },
    update: {},
    create: { id: "svc-premium", name: "ทำสี Premium", price: 8000, categoryId: hairCat.id },
  });

  // 5. Transactions (500 over 5 months)
  console.log("Generating Transactions...");
  const techs = users.filter(u => u.role === "TECHNICIAN" || u.role === "MANAGER");
  
  const now = new Date();
  for (let monthOffset = 0; monthOffset < 5; monthOffset++) {
    console.log(`Generating month -${monthOffset}...`);
    const date = new Date(now.getFullYear(), now.getMonth() - monthOffset, 15);
    
    for (let i = 0; i < 100; i++) {
      const tech = techs[faker.number.int({ min: 0, max: techs.length - 1 })];
      const orderDate = new Date(date);
      orderDate.setDate(faker.number.int({ min: 1, max: 28 }));
      orderDate.setHours(faker.number.int({ min: 10, max: 19 }));
      
      const price = faker.number.int({ min: 5000, max: 11000 }); // Average ~8000

      const order = await prisma.order.create({
        data: {
          branchId: tech.branchId,
          customerName: faker.person.fullName(),
          technicianId: tech.id,
          status: "PAID",
          subtotal: price,
          total: price,
          createdAt: orderDate,
          completedAt: orderDate,
          payments: {
            create: { method: "TRANSFER", amount: price, createdAt: orderDate }
          },
          items: {
            create: { serviceId: svc.id, price: price }
          }
        }
      });
    }
  }

  console.log("Seed completed successfully!");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
