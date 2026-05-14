import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const {
    payments,
    discountAmount,
    discountPct,
    approvedById,
    serviceCharge = 0,
    vat = 0,
    roundingAdjustment = 0,
    ticketId = null,
    ticketDiscount = 0,
    retailItems = [],
  } = await req.json();

  const order = await prisma.order.findUnique({
    where: { id },
    include: { items: true, chemicals: true },
  });
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  type RetailItemInput = { retailProductId: string; quantity: number; price: number };
  const ri: RetailItemInput[] = Array.isArray(retailItems) ? retailItems : [];
  const newRetailSubtotal = ri.reduce((s, r) => s + Math.round(Number(r.price)) * Math.round(Number(r.quantity)), 0);
  const finalRetailSubtotal = (order.retailSubtotal || 0) + newRetailSubtotal;
  // Keep monetary precision at 2 decimals (สตางค์) per Thai VAT rules
  const round2 = (n: number) => Math.round(n * 100) / 100;
  const safeDiscount = round2(Number(discountAmount) || 0);
  const safeTicketDiscount = round2(Number(ticketDiscount) || 0);
  const safeSC = round2(Number(serviceCharge) || 0);
  const safeVat = round2(Number(vat) || 0);
  const safeRounding = round2(Number(roundingAdjustment) || 0);
  const total = round2(order.subtotal + finalRetailSubtotal - safeDiscount - safeTicketDiscount + safeSC + safeVat + safeRounding);

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const todayPaidCount = await prisma.order.count({
    where: { status: "PAID", completedAt: { gte: startOfDay, lt: endOfDay } },
  });
  const receiptNumber = todayPaidCount + 1;

  await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id },
      data: {
        status: "PAID",
        discountAmount: safeDiscount,
        discountPct: discountPct || 0,
        retailSubtotal: finalRetailSubtotal,
        serviceCharge: safeSC,
        vat: safeVat,
        roundingAdjustment: safeRounding,
        total,
        receiptNumber,
        completedAt: now,
      },
    });

    for (const r of ri) {
      await tx.orderRetailItem.create({
        data: { orderId: id, retailProductId: r.retailProductId, quantity: r.quantity, price: r.price },
      });
      await tx.retailProduct.update({
        where: { id: r.retailProductId },
        data: { stock: { decrement: r.quantity } },
      });
    }

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
      const approver = await tx.user.findUnique({ where: { id: approvedById }, select: { id: true } });
      if (approver) {
        await tx.discountLog.create({
          data: { orderId: id, approvedById: approver.id, amount: discountAmount, pct: discountPct || 0 },
        });
      }
    }

    if (ticketId) {
      await tx.customerTicket.update({
        where: { id: ticketId },
        data: { isUsed: true, usedOrderId: id, usedAt: new Date() },
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

  return NextResponse.json({ ok: true, receiptNumber });
}
