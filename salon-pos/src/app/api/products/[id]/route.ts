import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (body.name != null) data.name = body.name;
  if (body.unitVolumeG != null) data.unitVolumeG = Number(body.unitVolumeG);
  if (body.costPerUnit != null) data.costPerUnit = Number(body.costPerUnit);
  if (body.reorderPoint != null) data.reorderPoint = Number(body.reorderPoint);
  if (body.sellable != null) data.sellable = Boolean(body.sellable);
  if (body.salePrice !== undefined) {
    data.salePrice = body.salePrice === "" || body.salePrice == null ? null : Number(body.salePrice);
  }
  if (body.isActive != null) data.isActive = Boolean(body.isActive);

  const item = await prisma.product.update({ where: { id }, data });
  return NextResponse.json(item);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.product.update({ where: { id }, data: { isActive: false } });
  return NextResponse.json({ ok: true });
}
