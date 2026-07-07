import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const { customerId, amount, type, note } = await req.json();
  if (amount <= 0) return NextResponse.json({ error: "จำนวนเงินต้องมากกว่า 0" }, { status: 400 });

  await prisma.$transaction(async (tx) => {
    const customer = await tx.customer.findUnique({ where: { id: customerId } });
    if (!customer) throw new Error("ไม่พบลูกค้า");
    
    if (type === "DEDUCT" && customer.walletBalance < amount) {
      throw new Error("ยอดเงินในกระเป๋าไม่เพียงพอ");
    }
    
    const delta = type === "ADD" ? amount : -amount;
    await tx.customer.update({
      where: { id: customerId },
      data: { walletBalance: { increment: delta } },
    });
    
    await tx.walletTransaction.create({
      data: { customerId, amount: delta, type, note: note || "" },
    });
  });

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
