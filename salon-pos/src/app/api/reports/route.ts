import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const month = parseInt(searchParams.get("month") || `${new Date().getMonth() + 1}`);
  const year = parseInt(searchParams.get("year") || `${new Date().getFullYear()}`);

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
  });
}
