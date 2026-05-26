import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (body.name != null) data.name = body.name;
  if (body.price != null) data.price = Number(body.price);
  if (body.stock != null) data.stock = Number(body.stock);
  if (body.isActive != null) data.isActive = Boolean(body.isActive);
  if (body.usableAsChemical != null) data.usableAsChemical = Boolean(body.usableAsChemical);
  if (body.unitVolumeG !== undefined) data.unitVolumeG = body.unitVolumeG === "" || body.unitVolumeG == null ? null : Number(body.unitVolumeG);
  if (body.costPerG !== undefined) data.costPerG = body.costPerG === "" || body.costPerG == null ? null : Number(body.costPerG);
  if (body.barcode !== undefined) {
    const trimmed = typeof body.barcode === "string" ? body.barcode.trim() : "";
    if (trimmed) {
      const clash = await prisma.retailProduct.findFirst({ where: { barcode: trimmed, NOT: { id } } });
      if (clash) return NextResponse.json({ error: "บาร์โค้ดนี้ถูกใช้แล้วโดย: " + clash.name }, { status: 400 });
      data.barcode = trimmed;
    } else {
      data.barcode = null;
    }
  }

  const item = await prisma.retailProduct.update({ where: { id }, data });

  if (body.adjustDelta != null) {
    const delta = Number(body.adjustDelta);
    await prisma.auditLog.create({
      data: {
        action: delta > 0 ? "RETAIL_STOCK_ADD" : "RETAIL_STOCK_REDUCE",
        entity: "RetailProduct",
        entityId: id,
        detail: `${item.name}: ${delta > 0 ? "+" : ""}${delta}${body.adjustNote ? ` (${body.adjustNote})` : ""}`,
      },
    });
  }

  return NextResponse.json(item);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.retailProduct.update({ where: { id }, data: { isActive: false } });
  return NextResponse.json({ ok: true });
}
