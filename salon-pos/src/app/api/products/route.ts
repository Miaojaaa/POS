import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function GET() {
  const products = await prisma.product.findMany({
    where: { isActive: true },
    include: { mainStock: true, subStock: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(products);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || !session.role.split(",").some(r => ["OWNER", "MANAGER"].includes(r))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  const body = await req.json();
  const product = await prisma.product.create({
    data: {
      name: body.name,
      unitVolumeG: body.unitVolumeG,
      costPerUnit: body.costPerUnit,
      reorderPoint: body.reorderPoint || 0,
      sellable: Boolean(body.sellable),
      salePrice: body.salePrice != null && body.salePrice !== "" ? Number(body.salePrice) : null,
      mainStock: { create: { quantity: body.initialMain || 0 } },
      subStock: { create: { quantity: body.initialSub || 0, currentVolumeG: body.unitVolumeG } },
    },
  });
  return NextResponse.json(product);
}
