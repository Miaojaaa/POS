import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generatePayrollRun } from "@/lib/payroll";
import { verifyPin } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const month = parseInt(searchParams.get("month") || `${new Date().getMonth() + 1}`);
  const year = parseInt(searchParams.get("year") || `${new Date().getFullYear()}`);

  let run = await prisma.payrollRun.findFirst({
    where: { month, year },
    include: { items: { include: { user: { select: { id: true, name: true, role: true, branchId: true } } } } },
  });

  if (!run || run.status === "DRAFT") {
    // DRAFT (or first visit): full regen — pulls latest PAID orders + User salary/allowance
    run = await generatePayrollRun(month, year);
  } else {
    // CONFIRMED: commissions stay frozen for everyone already in the run, but we still
    // live-sync baseSalary / positionAllowance from the User table AND append any newly
    // hired active employees so the list matches the staff page. New hires get base salary
    // + allowance only (commission = 0) until the user re-confirms the month — which is
    // what regenerates commissions from scratch via generatePayrollRun(). The Expense entry
    // in /reports/expenses also stays frozen until re-confirm.
    const existingUserIds = run.items.map(i => i.userId);
    const existing = await prisma.user.findMany({
      where: { id: { in: existingUserIds } },
      select: { id: true, baseSalary: true, positionAllowance: true },
    });
    const existingMap = new Map(existing.map(u => [u.id, u]));
    for (const it of run.items) {
      const u = existingMap.get(it.userId);
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

    // Append currently-active employees that weren't in the original run.
    const existingSet = new Set(existingUserIds);
    const newcomers = await prisma.user.findMany({
      where: { isActive: true, id: { notIn: existingUserIds.length ? existingUserIds : ["__none__"] } },
      select: { id: true, name: true, role: true, baseSalary: true, positionAllowance: true },
    });
    const toAdd = newcomers.filter(u => !existingSet.has(u.id));
    if (toAdd.length) {
      await prisma.payrollItem.createMany({
        data: toAdd.map(u => ({
          payrollRunId: run!.id,
          userId: u.id,
          baseSalary: u.baseSalary ?? 0,
          positionAllowance: u.positionAllowance ?? 0,
          poolCommission: 0,
          retailCommission: 0,
          totalAmount: u.baseSalary ?? 0,
          orderCount: 0,
        })),
      });
      // Re-fetch so the response includes the freshly-added items with their user joins.
      run = await prisma.payrollRun.findFirst({
        where: { month, year },
        include: { items: { include: { user: { select: { id: true, name: true, role: true, branchId: true } } } } },
      });
    }
  }

  return NextResponse.json(run);
}

// Forces a fresh regen (resets the run to DRAFT). Owner PIN required because this
// blows away any frozen CONFIRMED commission amounts so the user can sanity-check
// formula/config changes (e.g. POOL ↔ PER_HEAD) without going through the full
// re-confirm flow. The Expense entry stays as-is until /confirm runs again.
export async function POST(req: NextRequest) {
  const { month, year, pin } = await req.json();
  if (!pin) return NextResponse.json({ error: "Missing PIN" }, { status: 400 });
  const ok = await verifyPin("OWNER", pin);
  if (!ok) return NextResponse.json({ error: "Owner PIN ไม่ถูกต้อง" }, { status: 401 });
  const run = await generatePayrollRun(month, year);
  return NextResponse.json(run);
}
