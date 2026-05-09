import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();

  const current = await prisma.payrollItem.findUnique({ where: { id } });
  if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const baseSalary = body.baseSalary != null ? Number(body.baseSalary) : current.baseSalary;
  const totalAmount = baseSalary + current.poolCommission + current.retailCommission;

  const updated = await prisma.payrollItem.update({
    where: { id },
    data: { baseSalary, totalAmount },
    include: { user: { select: { id: true, name: true, role: true } } },
  });

  return NextResponse.json(updated);
}
