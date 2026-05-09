import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { name, price, duration, categoryId, isActive } = await req.json();

  const service = await prisma.service.update({
    where: { id },
    data: {
      name,
      price: price !== undefined ? Number(price) : undefined,
      duration: duration !== undefined ? Number(duration) : undefined,
      categoryId,
      isActive,
    },
  });

  return NextResponse.json(service);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.service.update({
    where: { id },
    data: { isActive: false },
  });
  return NextResponse.json({ ok: true });
}
