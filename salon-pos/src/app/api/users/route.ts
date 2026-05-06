import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function GET() {
  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, name: true, role: true, email: true, phone: true, isActive: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(users);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const hashed = await bcrypt.hash(body.password || "changeme123", 10);
  const user = await prisma.user.create({
    data: { name: body.name, email: body.email, password: hashed, role: body.role, phone: body.phone || null },
  });
  return NextResponse.json({ id: user.id, name: user.name, role: user.role });
}
