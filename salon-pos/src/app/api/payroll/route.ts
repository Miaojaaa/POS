import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const month = parseInt(searchParams.get("month") || `${new Date().getMonth() + 1}`);
  const year = parseInt(searchParams.get("year") || `${new Date().getFullYear()}`);

  let run = await prisma.payrollRun.findFirst({
    where: { month, year },
    include: { items: { include: { user: { select: { id: true, name: true, role: true } } } } },
  });

  // If no run yet, OR run is still DRAFT, regenerate from current PAID transactions
  // (preserves baseSalary). Once CONFIRMED, the run is frozen.
  if (!run || run.status === "DRAFT") {
    run = await generateRun(month, year);
  }

  return NextResponse.json(run);
}

async function generateRun(month: number, year: number) {
  const startOfMonth = new Date(year, month - 1, 1);
  const endOfMonth = new Date(year, month, 0, 23, 59, 59);

  // Preserve baseSalary from any existing run before deleting
  const existing = await prisma.payrollRun.findFirst({
    where: { month, year },
    include: { items: true },
  });
  const baseSalaryByUser = new Map<string, number>();
  if (existing) {
    for (const it of existing.items) {
      if (it.baseSalary > 0) baseSalaryByUser.set(it.userId, it.baseSalary);
    }
    await prisma.payrollItem.deleteMany({ where: { payrollRunId: existing.id } });
    await prisma.payrollRun.delete({ where: { id: existing.id } });
  }

  const pools = await prisma.commissionPool.findMany({ where: { isActive: true } });
  const users = await prisma.user.findMany({ where: { isActive: true } });

  // Source-of-truth: PAID orders only (same as ประวัติ Transaction page)
  const orders = await prisma.order.findMany({
    where: { status: "PAID", completedAt: { gte: startOfMonth, lte: endOfMonth } },
    include: { items: true, chemicals: true, assistants: true },
  });

  const totalRevenue = orders.reduce((s, o) => s + o.total, 0);
  const totalChemCost = orders.reduce((s, o) => s + o.chemicalCost, 0);
  const netRevenue = totalRevenue - totalChemCost;

  const techCount = users.filter(u => u.role.split(",").includes("TECHNICIAN")).length;
  const assistCount = users.filter(u => u.role.split(",").includes("ASSISTANT")).length;

  const techPool = pools.find(p => p.role === "TECHNICIAN");
  const assistPool = pools.find(p => p.role === "ASSISTANT");

  const techPoolAmount = techPool ? (netRevenue * techPool.percentage) / 100 : 0;
  const assistPoolAmount = assistPool ? (netRevenue * assistPool.percentage) / 100 : 0;

  return prisma.payrollRun.create({
    data: {
      month,
      year,
      status: "DRAFT",
      items: {
        create: users.map(u => {
          const myOrders = orders.filter(o =>
            o.technicianId === u.id || o.assistants.some(a => a.userId === u.id)
          );
          const orderCount = myOrders.length;
          let poolCommission = 0;
          const roles = u.role.split(",");
          if (roles.includes("TECHNICIAN") && techCount > 0) poolCommission = techPoolAmount / techCount;
          else if (roles.includes("ASSISTANT") && assistCount > 0) poolCommission = assistPoolAmount / assistCount;
          const baseSalary = baseSalaryByUser.get(u.id) || 0;
          return {
            userId: u.id,
            poolCommission,
            baseSalary,
            totalAmount: poolCommission + baseSalary,
            orderCount,
          };
        }),
      },
    },
    include: { items: { include: { user: { select: { id: true, name: true, role: true } } } } },
  });
}

export async function POST(req: NextRequest) {
  const { month, year } = await req.json();
  const run = await generateRun(month, year);
  return NextResponse.json(run);
}
