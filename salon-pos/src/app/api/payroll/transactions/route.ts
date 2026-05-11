import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  const month = parseInt(searchParams.get("month") || `${new Date().getMonth() + 1}`);
  const year = parseInt(searchParams.get("year") || `${new Date().getFullYear()}`);
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const startOfMonth = new Date(year, month - 1, 1);
  const endOfMonth = new Date(year, month, 0, 23, 59, 59);

  // PAID orders within the month where this user contributed (as technician or assistant)
  const orders = await prisma.order.findMany({
    where: {
      status: "PAID",
      completedAt: { gte: startOfMonth, lte: endOfMonth },
      OR: [
        { technicianId: userId },
        { assistants: { some: { userId } } },
      ],
    },
    include: {
      technician: { select: { id: true, name: true } },
      assistants: { include: { user: { select: { id: true, name: true } } } },
      items: { include: { service: { select: { name: true } } } },
      payments: true,
    },
    orderBy: { completedAt: "desc" },
  });

  return NextResponse.json(orders);
}
