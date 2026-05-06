import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_: NextRequest, { params }: { params: Promise<{ phone: string }> }) {
  const { phone } = await params;
  const customer = await prisma.customer.findUnique({
    where: { phone },
    include: {
      tickets: {
        where: { isUsed: false },
        include: { ticketDef: { include: { service: true } } },
      },
      serviceHistory: {
        take: 5,
        orderBy: { createdAt: "desc" },
        include: {
          order: {
            include: {
              items: { include: { service: true } },
              technician: { select: { name: true } },
              chemicals: { include: { product: true } },
            },
          },
        },
      },
    },
  });
  if (!customer) return NextResponse.json(null);
  return NextResponse.json(customer);
}
