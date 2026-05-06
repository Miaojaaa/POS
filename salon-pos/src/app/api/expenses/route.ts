import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month");
  const year = searchParams.get("year");

  const where: Record<string, unknown> = {};
  if (month && year) {
    const start = new Date(parseInt(year), parseInt(month) - 1, 1);
    const end = new Date(parseInt(year), parseInt(month), 0);
    where.date = { gte: start.toISOString().slice(0, 10), lte: end.toISOString().slice(0, 10) };
  }

  const expenses = await prisma.expense.findMany({
    where,
    include: { createdBy: { select: { name: true } } },
    orderBy: { date: "desc" },
  });
  return NextResponse.json(expenses);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const fallbackUser = await prisma.user.findFirst({ where: { role: "OWNER" } });
  const expense = await prisma.expense.create({
    data: {
      category: body.category,
      description: body.description,
      amount: body.amount,
      date: body.date,
      createdById: body.createdById || fallbackUser?.id || "",
    },
  });
  return NextResponse.json(expense);
}
