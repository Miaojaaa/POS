import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const branchId = searchParams.get("branchId") || "main";

    const products = await prisma.product.findMany({
      where: { isActive: true },
      include: { 
        mainStock: true, 
        subStocks: {
          where: { branchId }
        }
      },
      orderBy: { name: "asc" },
    });

    const result = products.map(p => {
      const ss = p.subStocks[0] || null;
      const totalVolumeG = ((p.mainStock?.quantity ?? 0) + (ss?.quantity ?? 0)) * p.unitVolumeG + (ss?.currentVolumeG ?? 0);
      return {
        id: p.id,
        name: p.name,
        unitVolumeG: p.unitVolumeG,
        costPerUnit: p.costPerUnit,
        reorderPoint: p.reorderPoint,
        costPerG: p.costPerUnit / p.unitVolumeG,
        mainQty: p.mainStock?.quantity ?? 0,
        subQty: ss?.quantity ?? 0,
        subVolumeG: ss?.currentVolumeG ?? 0,
        totalVolumeG,
        isLow: totalVolumeG <= p.reorderPoint,
      };
    });

    return NextResponse.json(result);
  } catch (err: any) {
    console.error("GET stock error:", err);
    return NextResponse.json({ 
      error: "Failed to fetch stock",
      details: err.message,
      code: err.code
    }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { id, mainQty } = await req.json();
    
    if (!id || typeof mainQty !== 'number') {
      return NextResponse.json({ error: "Invalid data" }, { status: 400 });
    }

    await prisma.mainStock.upsert({
      where: { productId: id },
      update: { quantity: mainQty },
      create: { productId: id, quantity: mainQty },
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("PUT stock error:", err);
    return NextResponse.json({ 
      error: "Failed to update stock",
      details: err.message,
      code: err.code
    }, { status: 500 });
  }
}
