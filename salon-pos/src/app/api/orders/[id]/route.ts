import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      technician: { select: { id: true, name: true } },
      assistants: { include: { user: { select: { id: true, name: true } } } },
      items: { include: { service: { include: { category: true } } } },
      chemicals: { include: { product: true } },
      retailItems: { include: { retailProduct: true } },
      payments: true,
      customer: true,
      discountLogs: { include: { approvedBy: { select: { name: true } } } },
    },
  });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(order);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();

  const order = await prisma.order.update({
    where: { id },
    data: {
      ...body,
      completedAt: body.status === "DONE" ? new Date() : undefined,
      updatedAt: new Date(),
    },
  });

  await prisma.auditLog.create({
    data: { action: "UPDATE_ORDER", entity: "Order", entityId: id, detail: JSON.stringify(body) },
  });

  return NextResponse.json(order);
}
