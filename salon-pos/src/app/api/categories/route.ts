import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const categories = await prisma.serviceCategory.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json(categories);
}

export async function POST(req: NextRequest) {
  const { name, groupId } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "กรุณาระบุชื่อหมวดหมู่" }, { status: 400 });

  const existing = await prisma.serviceCategory.findFirst({ where: { name: name.trim() } });
  if (existing) return NextResponse.json({ error: "มีหมวดหมู่นี้อยู่แล้ว" }, { status: 400 });

  const category = await prisma.serviceCategory.create({
    data: { name: name.trim(), groupId: groupId || null },
  });
  return NextResponse.json(category);
}
