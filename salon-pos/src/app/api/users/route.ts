import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { roleNeedsPin, generateUniquePin } from "@/lib/auth";

export async function GET() {
  try {
    const users = await prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true, role: true, email: true, phone: true, pin: true, baseSalary: true, positionAllowance: true, isActive: true, branchId: true },
      orderBy: { name: "asc" },
    });
    return NextResponse.json(users);
  } catch (err: any) {
    console.error("GET users error:", err);
    return NextResponse.json({
      error: "Failed to fetch users",
      details: err.message,
      code: err.code
    }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const hashed = await bcrypt.hash(body.password || "changeme123", 10);

    // Auto-generate PIN for OWNER/MANAGER roles. The PIN itself is never
    // accepted from the request body — managers shouldn't be able to pick
    // their own PIN, and this guarantees uniqueness via the DB check.
    let generatedPin: string | null = null;
    if (roleNeedsPin(body.role)) {
      generatedPin = await generateUniquePin();
    }

    const user = await prisma.user.create({
      data: {
        name: body.name,
        email: body.email,
        password: hashed,
        role: body.role,
        phone: body.phone || null,
        pin: generatedPin,
        branchId: body.branchId || "main",
        baseSalary: body.baseSalary != null ? Number(body.baseSalary) : 0,
        positionAllowance: body.positionAllowance != null ? Number(body.positionAllowance) : 0,
      },
    });
    return NextResponse.json({
      id: user.id,
      name: user.name,
      role: user.role,
      branchId: user.branchId,
      generatedPin,
    });
  } catch (err: any) {
    console.error("Create user error:", err);
    if (err.code === "P2002") {
      return NextResponse.json({ error: "อีเมลหรือ PIN นี้มีผู้ใช้งานแล้ว" }, { status: 400 });
    }
    return NextResponse.json({
      error: "ไม่สามารถเพิ่มพนักงานได้",
      details: err.message,
      code: err.code
    }, { status: 500 });
  }
}
