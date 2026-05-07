import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const { name, type, serviceId, discountPct, fixedValue } = await req.json();
  if (!name || !type) return NextResponse.json({ error: "name and type required" }, { status: 400 });

  const def = await prisma.ticketDefinition.create({
    data: {
      name,
      type,
      service: serviceId ? { connect: { id: serviceId } } : undefined,
      discountPct: discountPct != null ? Number(discountPct) : null,
      fixedValue: fixedValue != null ? Number(fixedValue) : null,
    },
    include: { service: true },
  });

  await prisma.auditLog.create({
    data: { action: "CREATE_TICKET_DEF", entity: "TicketDefinition", entityId: def.id, detail: name },
  });

  return NextResponse.json(def);
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const hasIssued = await prisma.customerTicket.count({ where: { ticketDefId: id } });
  if (hasIssued > 0) {
    return NextResponse.json({ error: "มีการออก ticket ไปแล้ว ไม่สามารถลบได้" }, { status: 400 });
  }

  await prisma.ticketDefinition.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
