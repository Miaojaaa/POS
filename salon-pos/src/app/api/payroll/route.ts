import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generatePayrollRun } from "@/lib/payroll";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const month = parseInt(searchParams.get("month") || `${new Date().getMonth() + 1}`);
  const year = parseInt(searchParams.get("year") || `${new Date().getFullYear()}`);

  let run = await prisma.payrollRun.findFirst({
    where: { month, year },
    include: { items: { include: { user: { select: { id: true, name: true, role: true } } } } },
  });

  if (!run || run.status === "DRAFT") {
    // DRAFT (or first visit): full regen — pulls latest PAID orders + User salary/allowance
    run = await generatePayrollRun(month, year);
  } else {
    // CONFIRMED: keep order counts + commissions frozen, but live-sync baseSalary and
    // positionAllowance from the User table so changes on the staff page reflect here
    // immediately. The Expense entry in /reports/expenses stays frozen until the user
    // re-confirms.
    const userIds = run.items.map(i => i.userId);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, baseSalary: true, positionAllowance: true },
    });
    const userMap = new Map(users.map(u => [u.id, u]));
    for (const it of run.items) {
      const u = userMap.get(it.userId);
      if (!u) continue;
      const newBase = u.baseSalary ?? 0;
      const newAllow = u.positionAllowance ?? 0;
      if (it.baseSalary !== newBase || it.positionAllowance !== newAllow) {
        const newTotal = newBase + it.poolCommission + it.retailCommission;
        await prisma.payrollItem.update({
          where: { id: it.id },
          data: { baseSalary: newBase, positionAllowance: newAllow, totalAmount: newTotal },
        });
        it.baseSalary = newBase;
        it.positionAllowance = newAllow;
        it.totalAmount = newTotal;
      }
    }
  }

  return NextResponse.json(run);
}

export async function POST(req: NextRequest) {
  const { month, year } = await req.json();
  const run = await generatePayrollRun(month, year);
  return NextResponse.json(run);
}
