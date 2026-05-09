import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const orders = await prisma.order.findMany({
    where: status ? { status: { in: status.split(",") } } : {},
    include: {
      technician: { select: { id: true, name: true } },
      assistants: { include: { user: { select: { id: true, name: true } } } },
      items: { include: { service: true } },
      chemicals: { include: { product: true } },
      payments: true,
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(orders);
}

export async function POST(req: NextRequest) {

  const body = await req.json();
  const {
    customerName, customerPhone, customerId,
    technicianId, assistantIds = [],
    items = [], chemicals = [],
    notes,
  } = body;

  let subtotal = 0;
  let chemicalCost = 0;

  for (const item of items) {
    subtotal += item.price;
  }
  for (const chem of chemicals) {
    chemicalCost += chem.totalCost;
  }

  const order = await prisma.order.create({
    data: {
      customerName,
      customerPhone,
      customerId: customerId || null,
      technicianId,
      notes,
      subtotal,
      total: subtotal,
      chemicalCost,
      status: "WAITING",
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
    },
    include: {
      technician: { select: { id: true, name: true } },
      items: { include: { service: true } },
    },
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
