import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const transfers = await prisma.stockTransfer.findMany({
    include: {
      items: { include: { product: true } },
      createdBy: { select: { name: true } },
      approvedBy: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return NextResponse.json(transfers);
}

export async function POST(req: NextRequest) {
  const { items, note, createdById } = await req.json();
  const fallbackUser = await prisma.user.findFirst({ where: { role: "OWNER" } });
  const userId = createdById || fallbackUser?.id || "";

  const transfer = await prisma.stockTransfer.create({
    data: {
      createdById: userId,
      note,
      status: "PENDING",
      items: { create: items.map((i: { productId: string; quantity: number }) => ({ productId: i.productId, quantity: i.quantity })) },
    },
  });

  return NextResponse.json(transfer);
}

export async function PATCH(req: NextRequest) {
  const { id, action } = await req.json();
  const approver = await prisma.user.findFirst({ where: { role: "MANAGER" } });

  if (action === "APPROVE") {
    const transfer = await prisma.stockTransfer.findUnique({ where: { id }, include: { items: true } });
    if (!transfer) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await prisma.$transaction(async (tx) => {
      await tx.stockTransfer.update({
        where: { id },
        data: { status: "APPROVED", approvedById: approver?.id, approvedAt: new Date() },
      });
      for (const item of transfer.items) {
        await tx.mainStock.update({ where: { productId: item.productId }, data: { quantity: { decrement: item.quantity } } });
        await tx.subStock.update({ where: { productId: item.productId }, data: { quantity: { increment: item.quantity } } });
      }
      await tx.auditLog.create({ data: { action: "APPROVE_TRANSFER", entity: "StockTransfer", entityId: id } });
    });
  } else if (action === "REJECT") {
    await prisma.stockTransfer.update({ where: { id }, data: { status: "REJECTED" } });
  }

  return NextResponse.json({ ok: true });
}
