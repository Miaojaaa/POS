import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    const where: any = {};
    if (status) {
      where.status = { in: status.split(",") };
    }
    if (startDate || endDate) {
      where.completedAt = {};
      if (startDate) where.completedAt.gte = new Date(startDate);
      if (endDate) where.completedAt.lte = new Date(endDate);
    }

    const orders = await prisma.order.findMany({
      where,
      include: {
        technician: { select: { id: true, name: true } },
        assistants: { include: { user: { select: { id: true, name: true } } } },
        items: { include: { service: { include: { category: true } } } },
        retailItems: { include: { retailProduct: true } },
        chemicals: { include: { product: true } },
        payments: true,
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(orders);
  } catch (err) {
    console.error("GET orders error:", err);
    return NextResponse.json({ error: "Failed to fetch orders" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {

  const body = await req.json();
  const {
    customerName, customerPhone, customerId,
    technicianId, assistantIds = [],
    items = [], chemicals = [], retailItems = [],
    notes,
  } = body;

  type RetailItemInput = { retailProductId: string; quantity: number; price: number };
  const ri: RetailItemInput[] = Array.isArray(retailItems) ? retailItems : [];

  let subtotal = 0;
  let chemicalCost = 0;
  let retailSubtotal = 0;

  for (const item of items) {
    subtotal += Math.round(Number(item.price));
  }
  for (const chem of chemicals) {
    chemicalCost += Math.round(Number(chem.totalCost));
  }
  for (const r of ri) {
    retailSubtotal += Math.round(Number(r.price)) * Math.round(Number(r.quantity));
  }

  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        customerName,
        customerPhone,
        customerId: customerId || null,
        technicianId,
        notes,
        subtotal,
        retailSubtotal,
        total: subtotal + retailSubtotal,
        chemicalCost,
        status: "IN_PROGRESS",
        assistants: {
          create: assistantIds.map((uid: string) => ({ userId: uid })),
        },
        items: {
          create: items.map((i: { serviceId: string; price: number }) => ({
            serviceId: i.serviceId,
            price: i.price,
          })),
        },
        chemicals: {
          create: chemicals.map((c: { productId: string; amountG: number; costPerG: number; totalCost: number }) => ({
            productId: c.productId,
            amountG: c.amountG,
            costPerG: c.costPerG,
            totalCost: c.totalCost,
          })),
        },
        retailItems: {
          create: ri.map(r => ({
            retailProductId: r.retailProductId,
            quantity: Number(r.quantity),
            price: Number(r.price),
          })),
        },
      },
      include: {
        technician: { select: { id: true, name: true } },
        items: { include: { service: true } },
      },
    });

    for (const r of ri) {
      await tx.retailProduct.update({
        where: { id: r.retailProductId },
        data: { stock: { decrement: Number(r.quantity) } },
      });
    }

    return created;
  });

  if (customerId) {
    await prisma.serviceHistory.create({
      data: { customerId, orderId: order.id },
    });
  }

  await prisma.auditLog.create({
    data: { action: "CREATE_ORDER", entity: "Order", entityId: order.id },
  });

  return NextResponse.json(order);
}
