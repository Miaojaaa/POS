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
    vatMode = "EXCLUSIVE",
    ticketId = null,
    ticketDiscount = 0,
    retailItems = [],
  } = await req.json();

  const order = await prisma.order.findUnique({
    where: { id },
    include: { items: true, chemicals: true },
  });
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  if (order.status === "PAID") return NextResponse.json({ error: "Order already paid" }, { status: 400 });

  // FIX #3: Reject discount if no manager approval was provided
  if (Number(discountAmount) > 0 && !approvedById) {
    return NextResponse.json({ error: "Discount requires manager approval" }, { status: 403 });
  }

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
  // INCLUSIVE prices already contain the VAT, so total = base + SC + rounding (no
  // VAT added on top). safeVat is still persisted for tax reporting — it represents
  // the embedded VAT portion of the total. EXCLUSIVE adds safeVat on top of base+SC.
  const baseAfterDiscount = order.subtotal + finalRetailSubtotal - safeDiscount - safeTicketDiscount;
  const total = vatMode === "INCLUSIVE"
    ? round2(baseAfterDiscount + safeSC + safeRounding)
    : round2(baseAfterDiscount + safeSC + safeVat + safeRounding);

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
        // FIX #1: Validate wallet balance before deduction to prevent negative balance
        const customer = await tx.customer.findUnique({ where: { id: order.customerId }, select: { walletBalance: true } });
        if (!customer || customer.walletBalance < pay.amount) {
          throw new Error(`Insufficient wallet balance: available ${customer?.walletBalance ?? 0}, required ${pay.amount}`);
        }
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
      // FIX #4: Atomic update with ownership + unused verification to prevent double-spending
      const updatedTicket = await tx.customerTicket.updateMany({
        where: { id: ticketId, isUsed: false, ...(order.customerId ? { customerId: order.customerId } : {}) },
        data: { isUsed: true, usedOrderId: id, usedAt: new Date() },
      });
      if (updatedTicket.count === 0) {
        throw new Error("Invalid, already used, or mismatched ticket");
      }
    }

    for (const chem of order.chemicals as { productId: string; amountG: number }[]) {
      const sub = await tx.subStock.findUnique({ 
        where: { 
          productId_branchId: {
            productId: chem.productId,
            branchId: order.branchId
          }
        } 
      });
      if (!sub) continue;
      let remainG = sub.currentVolumeG - chem.amountG;
      let bottles = sub.quantity;
      // FIX #2: Use while-loop to correctly handle multi-bottle deduction
      if (remainG < 0) {
        const prod = await tx.product.findUnique({ where: { id: chem.productId } });
        if (prod && prod.unitVolumeG > 0) {
          while (remainG < 0 && bottles > 0) {
            bottles -= 1;
            remainG += prod.unitVolumeG;
          }
        }
      }
      await tx.subStock.update({
        where: { 
          productId_branchId: {
            productId: chem.productId,
            branchId: order.branchId
          }
        },
        data: { quantity: Math.max(0, bottles), currentVolumeG: Math.max(0, remainG) },
      });
    }

    await tx.auditLog.create({
      data: { action: "CHECKOUT_ORDER", entity: "Order", entityId: id },
    });
  });

  return NextResponse.json({ ok: true, receiptNumber });
}
