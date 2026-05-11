import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPin } from "@/lib/auth";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const { name, email, phone, role, baseSalary, positionAllowance, ownerPin } = await req.json();

    if (!ownerPin) return NextResponse.json({ error: "ต้องใช้ Owner PIN" }, { status: 400 });

    const ok = await verifyPin("OWNER", ownerPin);
    if (!ok) return NextResponse.json({ error: "Owner PIN ไม่ถูกต้อง" }, { status: 401 });

    const user = await prisma.user.update({
      where: { id },
      data: {
        name,
        email,
        phone: phone || null,
        role,
        ...(baseSalary != null ? { baseSalary: Number(baseSalary) } : {}),
        ...(positionAllowance != null ? { positionAllowance: Number(positionAllowance) } : {}),
      },
    });

    // Propagate new baseSalary / positionAllowance into any existing DRAFT
    // PayrollItems for this user. CONFIRMED runs stay frozen.
    if (baseSalary != null || positionAllowance != null) {
      const draftItems = await prisma.payrollItem.findMany({
        where: { userId: id, payrollRun: { status: "DRAFT" } },
      });
      for (const it of draftItems) {
        const newBase = baseSalary != null ? Number(baseSalary) : it.baseSalary;
        const newAllow = positionAllowance != null ? Number(positionAllowance) : it.positionAllowance;
        await prisma.payrollItem.update({
          where: { id: it.id },
          data: {
            baseSalary: newBase,
            positionAllowance: newAllow,
            totalAmount: newBase + it.poolCommission + it.retailCommission,
          },
        });
      }
    }

    return NextResponse.json({ id: user.id, name: user.name, role: user.role });
  } catch (err: any) {
    console.error("Update user error:", err);
    if (err.code === "P2002") {
      return NextResponse.json({ error: "อีเมลนี้มีผู้ใช้งานแล้ว" }, { status: 400 });
    }
    return NextResponse.json({ error: `ไม่สามารถแก้ไขข้อมูลได้: ${err.message || err}` }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const ownerPin = req.nextUrl.searchParams.get("ownerPin");
    
    if (!ownerPin) return NextResponse.json({ error: "ต้องใช้ Owner PIN" }, { status: 400 });

    const ok = await verifyPin("OWNER", ownerPin);
    if (!ok) return NextResponse.json({ error: "Owner PIN ไม่ถูกต้อง" }, { status: 401 });

    await prisma.user.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Delete user error:", err);
    return NextResponse.json({ error: "ไม่สามารถลบพนักงานได้" }, { status: 500 });
  }
}
