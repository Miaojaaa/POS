import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const month = parseInt(searchParams.get("month") || `${new Date().getMonth() + 1}`);
  const year = parseInt(searchParams.get("year") || `${new Date().getFullYear()}`);

  const run = await prisma.payrollRun.findFirst({
    where: { month, year },
    include: { items: { include: { user: { select: { id: true, name: true, role: true } } } } },
  });

  return NextResponse.json(run);
}

export async function POST(req: NextRequest) {
  const { month, year } = await req.json();
  const startOfMonth = new Date(year, month - 1, 1);
  const endOfMonth = new Date(year, month, 0, 23, 59, 59);

  const pools = await prisma.commissionPool.findMany({ where: { isActive: true } });
  const users = await prisma.user.findMany({ where: { isActive: true } });

  const orders = await prisma.order.findMany({
    where: { status: "DONE", completedAt: { gte: startOfMonth, lte: endOfMonth } },
    include: { items: true, chemicals: true, assistants: true },
  });

  const totalRevenue = orders.reduce((s, o) => s + o.total, 0);
  const totalChemCost = orders.reduce((s, o) => s + o.chemicalCost, 0);
  const netRevenue = totalRevenue - totalChemCost;

  const techCount = users.filter(u => u.role === "TECHNICIAN").length;
  const assistCount = users.filter(u => u.role === "ASSISTANT").length;

  const techPool = pools.find(p => p.role === "TECHNICIAN");
  const assistPool = pools.find(p => p.role === "ASSISTANT");

  const techPoolAmount = techPool ? (netRevenue * techPool.percentage) / 100 : 0;
  const assistPoolAmount = assistPool ? (netRevenue * assistPool.percentage) / 100 : 0;

  const run = await prisma.payrollRun.create({
    data: {
      month,
      year,
      status: "DRAFT",
      items: {
        create: users.map(u => {
          const myOrders = orders.filter(o => o.technicianId === u.id);
          const orderCount = myOrders.length;
          let poolCommission = 0;
          if (u.role === "TECHNICIAN" && techCount > 0) poolCommission = techPoolAmount / techCount;
          else if (u.role === "ASSISTANT" && assistCount > 0) poolCommission = assistPoolAmount / assistCount;
          return { userId: u.id, poolCommission, totalAmount: poolCommission, orderCount };
        }),
      },
    },
    include: { items: { include: { user: { select: { id: true, name: true, role: true } } } } },
  });

  return NextResponse.json(run);
}
