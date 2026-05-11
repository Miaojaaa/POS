import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPin } from "@/lib/auth";
import { generatePayrollRun } from "@/lib/payroll";

export async function POST(req: NextRequest) {
  const { runId, pin } = await req.json();
  if (!runId || !pin) return NextResponse.json({ ok: false, error: "Missing runId/pin" }, { status: 400 });

  const ok = await verifyPin("OWNER", pin);
  if (!ok) return NextResponse.json({ ok: false, error: "PIN ไม่ถูกต้อง" }, { status: 401 });

  const existing = await prisma.payrollRun.findUnique({ where: { id: runId } });
  if (!existing) return NextResponse.json({ ok: false, error: "Run not found" }, { status: 404 });

  // Always regenerate from current User.baseSalary + PAID orders before confirming.
  // This makes "ยืนยัน / ยืนยันใหม่" pick up the latest staff page edits.
  const run = await generatePayrollRun(existing.month, existing.year);

  const totalAllowances = run.items.reduce((s, i) => s + (i.positionAllowance || 0), 0);
  const totalItems = run.items.reduce((s, i) => s + i.totalAmount, 0);
  const totalPayroll = totalItems + totalAllowances;

  const owner = await prisma.user.findFirst({ where: { role: { contains: "OWNER" }, isActive: true } });
  const expenseDate = new Date(run.year, run.month - 1, 1).toISOString().slice(0, 10);
  const expenseDescription = `เงินเดือน & ค่าคอมประจำเดือน ${run.month}/${run.year}`;

  await prisma.$transaction(async (tx) => {
    // Remove any prior payroll expense for this run (so re-confirm updates the amount)
    await tx.expense.deleteMany({
      where: { category: "เงินเดือน", description: expenseDescription },
    });

    if (totalPayroll > 0) {
      await tx.expense.create({
        data: {
          category: "เงินเดือน",
          description: expenseDescription,
          amount: totalPayroll,
          date: expenseDate,
          createdById: owner?.id || run.items[0]?.userId || "",
        },
      });
    }

    await tx.payrollRun.update({
      where: { id: run.id },
      data: { status: "CONFIRMED" },
    });
  });

  await prisma.auditLog.create({
    data: { action: "CONFIRM_PAYROLL", entity: "PayrollRun", entityId: run.id, detail: JSON.stringify({ totalPayroll }) },
  });

  const updated = await prisma.payrollRun.findUnique({
    where: { id: run.id },
    include: { items: { include: { user: { select: { id: true, name: true, role: true } } } } },
  });
  return NextResponse.json({ ok: true, run: updated, totalPayroll });
}
