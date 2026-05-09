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

type ItemInput = { serviceId: string; price: number };
type ChemInput = { productId: string; amountG: number; costPerG: number; totalCost: number };
type RetailInput = { retailProductId: string; quantity: number; price: number };

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();

  const isFullEdit = body.items != null || body.chemicals != null || body.retailItems != null
    || body.technicianId != null || body.assistantIds != null;

  if (!isFullEdit) {
    // Simple status update (legacy path)
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

  // Full edit path
  const items: ItemInput[] = Array.isArray(body.items) ? body.items : [];
  const chemicals: ChemInput[] = Array.isArray(body.chemicals) ? body.chemicals : [];
  const retailItems: RetailInput[] = Array.isArray(body.retailItems) ? body.retailItems : [];

  const subtotal = items.reduce((s, i) => s + Number(i.price), 0);
  const chemicalCost = chemicals.reduce((s, c) => s + Number(c.totalCost), 0);
  const retailSubtotal = retailItems.reduce((s, r) => s + Number(r.price) * Number(r.quantity), 0);

  const updated = await prisma.$transaction(async (tx) => {
    const existing = await tx.order.findUnique({
      where: { id },
      include: { retailItems: true },
    });
    if (!existing) throw new Error("Order not found");

    // Restore stock from old retail items, then delete them
    for (const old of existing.retailItems) {
      await tx.retailProduct.update({
        where: { id: old.retailProductId },
        data: { stock: { increment: old.quantity } },
      });
    }
    await tx.orderRetailItem.deleteMany({ where: { orderId: id } });

    // Replace items, chemicals, assistants
    await tx.orderItem.deleteMany({ where: { orderId: id } });
    await tx.orderChemical.deleteMany({ where: { orderId: id } });
    await tx.orderAssistant.deleteMany({ where: { orderId: id } });

    // Create new sets
    if (items.length > 0) {
      await tx.orderItem.createMany({
        data: items.map(i => ({ orderId: id, serviceId: i.serviceId, price: Number(i.price) })),
      });
    }
    if (chemicals.length > 0) {
      await tx.orderChemical.createMany({
        data: chemicals.map(c => ({
          orderId: id,
          productId: c.productId,
          amountG: Number(c.amountG),
          costPerG: Number(c.costPerG),
          totalCost: Number(c.totalCost),
        })),
      });
    }
    if (Array.isArray(body.assistantIds) && body.assistantIds.length > 0) {
      await tx.orderAssistant.createMany({
        data: (body.assistantIds as string[]).map(uid => ({ orderId: id, userId: uid })),
      });
    }
    for (const r of retailItems) {
      await tx.orderRetailItem.create({
        data: { orderId: id, retailProductId: r.retailProductId, quantity: Number(r.quantity), price: Number(r.price) },
      });
      await tx.retailProduct.update({
        where: { id: r.retailProductId },
        data: { stock: { decrement: Number(r.quantity) } },
      });
    }

    // Update order itself
    const data: Record<string, unknown> = {
      subtotal,
      retailSubtotal,
      chemicalCost,
      total: subtotal + retailSubtotal,
      updatedAt: new Date(),
    };
    if (body.technicianId) data.technicianId = body.technicianId;
    if (body.notes !== undefined) data.notes = body.notes;
    if (body.customerName !== undefined) data.customerName = body.customerName;
    if (body.customerPhone !== undefined) data.customerPhone = body.customerPhone;
    if (body.customerId !== undefined) data.customerId = body.customerId || null;

    return await tx.order.update({ where: { id }, data });
  });

  await prisma.auditLog.create({
    data: { action: "UPDATE_ORDER_FULL", entity: "Order", entityId: id },
  });

  return NextResponse.json(updated);
}
