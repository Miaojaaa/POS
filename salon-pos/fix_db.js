const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("Fixing old database values from Mg to G...");

  const products = await prisma.product.findMany();
  for (const p of products) {
    if (p.unitVolumeG > 5000) {
      await prisma.product.update({
        where: { id: p.id },
        data: {
          unitVolumeG: Math.floor(p.unitVolumeG / 1000),
          reorderPoint: Math.floor(p.reorderPoint / 1000),
        }
      });
      console.log(`Updated product ${p.name}`);
    }
  }

  const subStocks = await prisma.subStock.findMany();
  for (const s of subStocks) {
    if (s.currentVolumeG > 5000) {
      await prisma.subStock.update({
        where: { id: s.id },
        data: {
          currentVolumeG: Math.floor(s.currentVolumeG / 1000)
        }
      });
      console.log(`Updated subStock ${s.id}`);
    }
  }

  const orderChems = await prisma.orderChemical.findMany();
  for (const oc of orderChems) {
    if (oc.amountG > 5000) {
      await prisma.orderChemical.update({
        where: { id: oc.id },
        data: {
          amountG: Math.floor(oc.amountG / 1000)
        }
      });
      console.log(`Updated orderChemical ${oc.id}`);
    }
  }

  console.log("Done fixing DB!");
}

main().catch(console.error).finally(() => prisma.$disconnect());
