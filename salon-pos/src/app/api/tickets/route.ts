import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const customerId = searchParams.get("customerId");

  if (customerId) {
    const tickets = await prisma.customerTicket.findMany({
      where: { customerId },
      include: { ticketDef: { include: { service: true } } },
      orderBy: { issuedAt: "desc" },
    });
    return NextResponse.json(tickets);
  }

  const defs = await prisma.ticketDefinition.findMany({ include: { service: true } });
  return NextResponse.json(defs);
}

export async function POST(req: NextRequest) {
  const { customerId, ticketDefId, quantity = 1 } = await req.json();

  const tickets = await prisma.customerTicket.createMany({
    data: Array.from({ length: quantity }, () => ({ customerId, ticketDefId })),
  });

  await prisma.auditLog.create({
    data: { action: "ISSUE_TICKET", entity: "CustomerTicket", detail: `${quantity} tickets for customer ${customerId}` },
  });

  return NextResponse.json({ count: tickets.count });
}
