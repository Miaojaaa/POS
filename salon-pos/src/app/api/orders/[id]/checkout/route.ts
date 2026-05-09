import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { payments, discountAmount, discountPct, approvedById, serviceCharge = 0, vat = 0 } = await req.json();

  const order = await prisma.order.findUnique({
    where: { id },
    include: { items: true, chemicals: true },
  });
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  const total = order.subtotal - (discountAmount || 0) + serviceCharge + vat;

  await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id },
      data: {
        status: "PAID",
        discountAmount: discountAmount || 0,
        discountPct: discountPct || 0,
        total,
        completedAt: new Date(),
      },
    });

    for (const pay of payments) {
      await tx.payment.create({
        data: { orderId: id, method: pay.method, amount: pay.amount },
      });

      if (pay.method === "WALLET" && order.customerId) {
        await tx.customer.update({
          where: { id: order.customerId },
          data: { walletBalance: { decrement: pay.amount } },
        });
        await tx.walletTransaction.create({
          data: {
            customerId: order.customerId,
            amount: -pay.amount,
            type: "USE",
            note: `ชำระออร์เดอร์ #${id.slice(-6)}`,
            operatorId: null,
          },
        });
      }
    }

    if (discountAmount && discountAmount > 0 && approvedById) {
      await tx.discountLog.create({
        data: { orderId: id, approvedById, amount: discountAmount, pct: discountPct || 0 },
      });
    }

    for (const chem of order.chemicals as { productId: string; amountG: number }[]) {
      const sub = await tx.subStock.findUnique({ where: { productId: chem.productId } });
      if (!sub) continue;
      let remainG = sub.currentVolumeG - chem.amountG;
      let bottles = sub.quantity;
      if (remainG < 0) {
        bottles -= 1;
        const prod = await tx.product.findUnique({ where: { id: chem.productId } });
        remainG = prod ? prod.unitVolumeG + remainG : 0;
      }
      await tx.subStock.update({
        where: { productId: chem.productId },
        data: { quantity: Math.max(0, bottles), currentVolumeG: Math.max(0, remainG) },
      });
    }

    await tx.auditLog.create({
      data: { action: "CHECKOUT_ORDER", entity: "Order", entityId: id },
    });
  });

  return NextResponse.json({ ok: true });
}
