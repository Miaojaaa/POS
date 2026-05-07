import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const products = await prisma.product.findMany({
    where: { isActive: true },
    include: { mainStock: true, subStock: true },
    orderBy: { name: "asc" },
  });

  const result = products.map(p => {
    const totalVolumeG = ((p.mainStock?.quantity ?? 0) + (p.subStock?.quantity ?? 0)) * p.unitVolumeG + (p.subStock?.currentVolumeG ?? 0);
    return {
      id: p.id,
      name: p.name,
      unitVolumeG: p.unitVolumeG,
      costPerUnit: p.costPerUnit,
      reorderPoint: p.reorderPoint,
      costPerG: p.costPerUnit / p.unitVolumeG,
      mainQty: p.mainStock?.quantity ?? 0,
      subQty: p.subStock?.quantity ?? 0,
      subVolumeG: p.subStock?.currentVolumeG ?? 0,
      totalVolumeG,
      isLow: totalVolumeG <= p.reorderPoint,
    };
  });

  return NextResponse.json(result);
}
