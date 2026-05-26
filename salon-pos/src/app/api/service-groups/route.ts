import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const groups = await prisma.serviceGroup.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      categories: {
        orderBy: { name: "asc" },
        include: { services: { where: { isActive: true }, orderBy: { name: "asc" } } },
      },
    },
  });
  return NextResponse.json(groups);
}

export async function POST(req: NextRequest) {
  const { name } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "กรุณาระบุชื่อหมวดหมู่ใหญ่" }, { status: 400 });

  const existing = await prisma.serviceGroup.findUnique({ where: { name: name.trim() } });
  if (existing) return NextResponse.json({ error: "มีหมวดหมู่ใหญ่นี้อยู่แล้ว" }, { status: 400 });

  const maxOrder = await prisma.serviceGroup.aggregate({ _max: { sortOrder: true } });
  const group = await prisma.serviceGroup.create({
    data: { name: name.trim(), sortOrder: (maxOrder._max.sortOrder ?? 0) + 1 },
  });
  return NextResponse.json(group);
}
