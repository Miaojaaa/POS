import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { name, sortOrder } = await req.json();

  const data: { name?: string; sortOrder?: number } = {};
  if (typeof name === "string" && name.trim()) {
    const dup = await prisma.serviceGroup.findFirst({ where: { name: name.trim(), NOT: { id } } });
    if (dup) return NextResponse.json({ error: "ชื่อหมวดหมู่ใหญ่ซ้ำ" }, { status: 400 });
    data.name = name.trim();
  }
  if (typeof sortOrder === "number") data.sortOrder = sortOrder;

  const group = await prisma.serviceGroup.update({ where: { id }, data });
  return NextResponse.json(group);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const count = await prisma.serviceCategory.count({ where: { groupId: id } });
  if (count > 0) {
    return NextResponse.json(
      { error: `ไม่สามารถลบได้ — ยังมี ${count} หมวดหมู่ย่อยในกลุ่มนี้` },
      { status: 400 }
    );
  }
  await prisma.serviceGroup.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
