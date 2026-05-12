import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function GET() {
  try {
    const users = await prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true, role: true, email: true, phone: true, baseSalary: true, positionAllowance: true, isActive: true },
      orderBy: { name: "asc" },
    });
    return NextResponse.json(users);
  } catch (err) {
    console.error("GET users error:", err);
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const hashed = await bcrypt.hash(body.password || "changeme123", 10);
    const user = await prisma.user.create({
      data: {
        name: body.name,
        email: body.email,
        password: hashed,
        role: body.role,
        phone: body.phone || null,
        baseSalary: body.baseSalary != null ? Number(body.baseSalary) : 0,
        positionAllowance: body.positionAllowance != null ? Number(body.positionAllowance) : 0,
      },
    });
    return NextResponse.json({ id: user.id, name: user.name, role: user.role });
  } catch (err: any) {
    console.error("Create user error:", err);
    if (err.code === "P2002") {
      return NextResponse.json({ error: "อีเมลนี้มีผู้ใช้งานแล้ว" }, { status: 400 });
    }
    return NextResponse.json({ error: "ไม่สามารถเพิ่มพนักงานได้" }, { status: 500 });
  }
}
