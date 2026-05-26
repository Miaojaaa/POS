import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const hasMonth = searchParams.has("month");
  const month = parseInt(searchParams.get("month") || `${new Date().getMonth() + 1}`);
  const year = parseInt(searchParams.get("year") || `${new Date().getFullYear()}`);

  // ===== YEAR MODE =====
  // Triggered when caller omits ?month — used by the Compare tab to pull a full
  // year's worth of aggregates in a single request (12 monthly buckets + totals).
  // Month-mode callers (the default report view) are unchanged because they
  // always pass ?month.
  if (!hasMonth) {
    const startOfYear = new Date(year, 0, 1);
    const endOfYear = new Date(year, 11, 31, 23, 59, 59);
    const yOrders = await prisma.order.findMany({
      where: { createdAt: { gte: startOfYear, lte: endOfYear }, status: "PAID" },
      select: { createdAt: true, total: true, vat: true, chemicalCost: true },
    });
    const yExpenses = await prisma.expense.findMany({
      where: { date: { gte: `${year}-01-01`, lte: `${year}-12-31` } },
      select: { date: true, amount: true },
    });

    type MonthlyRow = { month: number; net: number; chemCost: number; expense: number; profit: number; orderCount: number };
    const monthly: MonthlyRow[] = Array.from({ length: 12 }, (_, i) => ({
      month: i + 1, net: 0, chemCost: 0, expense: 0, profit: 0, orderCount: 0,
    }));
    for (const o of yOrders) {
      const m = o.createdAt.getMonth();
      monthly[m].net += o.total - (o.vat || 0);
      monthly[m].chemCost += o.chemicalCost;
      monthly[m].orderCount += 1;
    }
    for (const e of yExpenses) {
      const m = parseInt(e.date.slice(5, 7), 10) - 1;
      if (m >= 0 && m < 12) monthly[m].expense += e.amount;
    }
    for (const row of monthly) row.profit = row.net - row.chemCost - row.expense;

    const totalNet = monthly.reduce((s, r) => s + r.net, 0);
    const totalChemCost = monthly.reduce((s, r) => s + r.chemCost, 0);
    const totalExpense = monthly.reduce((s, r) => s + r.expense, 0);
    const orderCount = monthly.reduce((s, r) => s + r.orderCount, 0);

    return NextResponse.json({
      mode: "year",
      year,
      totalNet,
      totalChemCost,
      totalExpense,
      netProfit: totalNet - totalChemCost - totalExpense,
      orderCount,
      monthly,
    });
  }
  // ===== MONTH MODE (existing) =====

  const startOfMonth = new Date(year, month - 1, 1);
  const endOfMonth = new Date(year, month, 0, 23, 59, 59);

  // Filter ONLY for PAID orders for revenue reports
  const orders = await prisma.order.findMany({
    where: { 
      createdAt: { gte: startOfMonth, lte: endOfMonth }, 
      status: "PAID" 
    },
    include: { items: { include: { service: { include: { category: true } } } }, chemicals: true },
  });

  const totalGross = orders.reduce((s, o) => s + o.total, 0);          // = total (รวม VAT)
  const totalVat = orders.reduce((s, o) => s + (o.vat || 0), 0);        // VAT 7% รวม
  const totalSC = orders.reduce((s, o) => s + (o.serviceCharge || 0), 0); // Service Charge 3% รวม
  const totalNet = totalGross - totalVat;                                // ก่อน VAT (รวม SC)
  const totalRevenue = totalGross;  // เก็บไว้เพื่อ backward-compat
  const totalChemCost = orders.reduce((s, o) => s + o.chemicalCost, 0);

  const expenses = await prisma.expense.findMany({
    where: { date: { gte: startOfMonth.toISOString().slice(0, 10), lte: endOfMonth.toISOString().slice(0, 10) } },
  });
  const totalExpense = expenses.reduce((s, e) => s + e.amount, 0);

  const serviceStats: Record<string, { name: string; count: number; revenue: number }> = {};
  for (const order of orders) {
    // Calculate total item price to distribute discount proportionally
    const itemsSubtotal = order.items.reduce((sum, item) => sum + item.price, 0);
    const grossTotal = order.subtotal + order.retailSubtotal;
    const ratio = grossTotal > 0 ? (order.total / grossTotal) : 0;
    
    for (const item of order.items) {
      const key = item.service.id;
      if (!serviceStats[key]) serviceStats[key] = { name: item.service.name, count: 0, revenue: 0 };
      serviceStats[key].count++;
      
      serviceStats[key].revenue += item.price * ratio;
    }
  }

  const techStats: Record<string, { name: string; count: number; revenue: number }> = {};
  for (const order of orders) {
    const techId = order.technicianId;
    if (!techStats[techId]) {
      const tech = await prisma.user.findUnique({ where: { id: techId }, select: { name: true } });
      techStats[techId] = { name: tech?.name || "ไม่ระบุ", count: 0, revenue: 0 };
    }
    techStats[techId].count++;
    techStats[techId].revenue += order.total;
  }

  // Daily breakdown for the Trend chart — bucket orders + expenses by day so
  // the chart can plot revenue / cost / profit per day and the raw table can
  // mirror those numbers row-by-row.
  const daysInMonth = endOfMonth.getDate();
  const dailyMap: Record<string, { day: number; net: number; chemCost: number; expense: number; orderCount: number }> = {};
  for (let d = 1; d <= daysInMonth; d++) {
    dailyMap[d] = { day: d, net: 0, chemCost: 0, expense: 0, orderCount: 0 };
  }
  for (const o of orders) {
    const d = o.createdAt.getDate();
    dailyMap[d].net += (o.total - (o.vat || 0));
    dailyMap[d].chemCost += o.chemicalCost;
    dailyMap[d].orderCount += 1;
  }
  for (const e of expenses) {
    // expense.date is "YYYY-MM-DD" — read the day directly
    const d = parseInt(e.date.slice(8, 10), 10);
    if (dailyMap[d]) dailyMap[d].expense += e.amount;
  }
  const daily = Object.values(dailyMap).map(row => ({
    ...row,
    profit: row.net - row.chemCost - row.expense,
  }));

  return NextResponse.json({
    totalRevenue,   // = totalGross (backward-compat)
    totalGross,
    totalNet,       // ก่อน VAT (รวม Service Charge แล้ว)
    totalVat,
    totalSC,
    totalChemCost,
    totalExpense,
    netProfit: totalNet - totalChemCost - totalExpense,  // ใช้ Net (VAT ไม่ใช่เงินร้าน)
    orderCount: orders.length,
    topServices: Object.values(serviceStats).sort((a, b) => b.revenue - a.revenue).slice(0, 5),
    topTechs: Object.values(techStats).sort((a, b) => b.revenue - a.revenue).slice(0, 5),
    expenses,
    allServices: Object.values(serviceStats),
    daily,
  });
}
