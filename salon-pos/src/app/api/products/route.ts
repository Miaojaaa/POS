import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function GET() {
  try {
    const products = await prisma.product.findMany({
      where: { isActive: true },
      include: { mainStock: true, subStocks: true },
      orderBy: { name: "asc" },
    });
    return NextResponse.json(products);
  } catch (err: any) {
    console.error("GET products error:", err);
    return NextResponse.json({ 
      error: "Failed to fetch products",
      }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
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
        subStocks: { 
          create: { 
            branchId: body.branchId || "main",
            quantity: body.initialSub || 0, 
            currentVolumeG: body.unitVolumeG 
          } 
        },
      },
    });
    return NextResponse.json(product);
  } catch (err: any) {
    console.error("POST products error:", err);
    return NextResponse.json({ 
      error: "Failed to create product",
      }, { status: 500 });
  }
}
