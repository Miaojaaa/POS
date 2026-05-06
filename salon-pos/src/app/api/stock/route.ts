import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const products = await prisma.product.findMany({
    where: { isActive: true },
    include: { mainStock: true, subStock: true },
    orderBy: { name: "asc" },
  });

  const result = products.map(p => ({
    id: p.id,
    name: p.name,
    unitVolumeMg: p.unitVolumeMg,
    costPerUnit: p.costPerUnit,
    reorderPoint: p.reorderPoint,
    costPerMg: p.costPerUnit / p.unitVolumeMg,
    mainQty: p.mainStock?.quantity ?? 0,
    subQty: p.subStock?.quantity ?? 0,
    subVolumeMg: p.subStock?.currentVolumeMg ?? 0,
    totalVolumeMg: ((p.mainStock?.quantity ?? 0) + (p.subStock?.quantity ?? 0)) * p.unitVolumeMg
      + (p.subStock?.currentVolumeMg ?? 0),
    isLow: ((p.subStock?.currentVolumeMg ?? 0) + ((p.subStock?.quantity ?? 0) * p.unitVolumeMg)) < p.reorderPoint,
  }));

  return NextResponse.json(result);
}
