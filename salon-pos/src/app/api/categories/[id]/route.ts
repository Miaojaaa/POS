import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { name, groupId } = await req.json();

  const data: { name?: string; groupId?: string | null } = {};
  if (typeof name === "string" && name.trim()) data.name = name.trim();
  if (groupId !== undefined) data.groupId = groupId || null;

  const cat = await prisma.serviceCategory.update({ where: { id }, data });
  return NextResponse.json(cat);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const count = await prisma.service.count({ where: { categoryId: id, isActive: true } });
  if (count > 0) {
    return NextResponse.json(
      { error: `ไม่สามารถลบได้ — ยังมี ${count} บริการในหมวดหมู่นี้` },
      { status: 400 }
    );
  }

  await prisma.serviceCategory.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
