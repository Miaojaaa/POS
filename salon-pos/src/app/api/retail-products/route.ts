import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const items = await prisma.retailProduct.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    });
    return NextResponse.json(items);
  } catch (error: any) {
    console.error("Error in GET /api/retail-products:", error);
    return new NextResponse(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, barcode, price, stock, usableAsChemical, unitVolumeG, costPerG } = body;
  if (!name || price == null) return NextResponse.json({ error: "name and price required" }, { status: 400 });

  const trimmedBarcode = typeof barcode === "string" ? barcode.trim() : "";
  if (trimmedBarcode) {
    const clash = await prisma.retailProduct.findUnique({ where: { barcode: trimmedBarcode } });
    if (clash) return NextResponse.json({ error: "บาร์โค้ดนี้ถูกใช้แล้วโดย: " + clash.name }, { status: 400 });
  }

  const item = await prisma.retailProduct.create({
    data: {
      name,
      barcode: trimmedBarcode || null,
      price: Number(price),
      stock: stock != null ? Number(stock) : 0,
      usableAsChemical: Boolean(usableAsChemical),
      unitVolumeG: usableAsChemical && unitVolumeG ? Number(unitVolumeG) : null,
      costPerG: usableAsChemical && costPerG ? Number(costPerG) : null,
    },
  });

  await prisma.auditLog.create({
    data: { action: "CREATE_RETAIL_PRODUCT", entity: "RetailProduct", entityId: item.id, detail: name },
  });

  return NextResponse.json(item);
}
