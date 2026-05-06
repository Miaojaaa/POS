import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const { customerId, amount, type, note } = await req.json();
  const delta = type === "ADD" ? amount : -amount;

  await prisma.$transaction([
    prisma.customer.update({
      where: { id: customerId },
      data: { walletBalance: { increment: delta } },
    }),
    prisma.walletTransaction.create({
      data: { customerId, amount: delta, type, note },
    }),
  ]);

  const customer = await prisma.customer.findUnique({ where: { id: customerId }, select: { walletBalance: true } });
  return NextResponse.json({ walletBalance: customer?.walletBalance });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const customerId = searchParams.get("customerId");
  if (!customerId) return NextResponse.json([]);
  const txns = await prisma.walletTransaction.findMany({
    where: { customerId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return NextResponse.json(txns);
}
