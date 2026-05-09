import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const items = await prisma.retailProduct.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(items);
}

export async function POST(req: NextRequest) {
  const { name, price, stock } = await req.json();
  if (!name || price == null) return NextResponse.json({ error: "name and price required" }, { status: 400 });

  const item = await prisma.retailProduct.create({
    data: {
      name,
      price: Number(price),
      stock: stock != null ? Number(stock) : 0,
    },
  });

  await prisma.auditLog.create({
    data: { action: "CREATE_RETAIL_PRODUCT", entity: "RetailProduct", entityId: item.id, detail: name },
  });

  return NextResponse.json(item);
}
