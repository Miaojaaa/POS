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

  // If no run yet, OR run is still DRAFT, regenerate from current PAID transactions
  // and User.baseSalary. Once CONFIRMED, the run is frozen.
  if (!run || run.status === "DRAFT") {
    run = await generatePayrollRun(month, year);
  }

  return NextResponse.json(run);
}

export async function POST(req: NextRequest) {
  const { month, year } = await req.json();
  const run = await generatePayrollRun(month, year);
  return NextResponse.json(run);
}
