import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const month = parseInt(searchParams.get("month") || `${new Date().getMonth() + 1}`);
  const year = parseInt(searchParams.get("year") || `${new Date().getFullYear()}`);

  const startOfMonth = new Date(year, month - 1, 1);
  const endOfMonth = new Date(year, month, 0, 23, 59, 59);

  const orders = await prisma.order.findMany({
    where: { createdAt: { gte: startOfMonth, lte: endOfMonth }, status: { not: "CANCELLED" } },
    include: { items: { include: { service: { include: { category: true } } } }, chemicals: true },
  });

  const doneOrders = orders.filter(o => o.status === "DONE");
  const totalRevenue = doneOrders.reduce((s, o) => s + o.total, 0);
  const totalChemCost = doneOrders.reduce((s, o) => s + o.chemicalCost, 0);

  const expenses = await prisma.expense.findMany({
    where: { date: { gte: startOfMonth.toISOString().slice(0, 10), lte: endOfMonth.toISOString().slice(0, 10) } },
  });
  const totalExpense = expenses.reduce((s, e) => s + e.amount, 0);

  const serviceStats: Record<string, { name: string; count: number; revenue: number }> = {};
  for (const order of doneOrders) {
    for (const item of order.items) {
      const key = item.service.id;
      if (!serviceStats[key]) serviceStats[key] = { name: item.service.name, count: 0, revenue: 0 };
      serviceStats[key].count++;
      serviceStats[key].revenue += item.price;
    }
  }

  const techStats: Record<string, { name: string; count: number; revenue: number }> = {};
  for (const order of doneOrders) {
    const techId = order.technicianId;
    if (!techStats[techId]) {
      const tech = await prisma.user.findUnique({ where: { id: techId }, select: { name: true } });
      techStats[techId] = { name: tech?.name || "ไม่ระบุ", count: 0, revenue: 0 };
    }
    techStats[techId].count++;
    techStats[techId].revenue += order.total;
  }

  return NextResponse.json({
    totalRevenue,
    totalChemCost,
    totalExpense,
    netProfit: totalRevenue - totalChemCost - totalExpense,
    orderCount: doneOrders.length,
    topServices: Object.values(serviceStats).sort((a, b) => b.revenue - a.revenue).slice(0, 5),
    topTechs: Object.values(techStats).sort((a, b) => b.revenue - a.revenue).slice(0, 5),
    expenses,
  });
}
