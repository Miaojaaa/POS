import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPin, roleNeedsPin, generateUniquePin } from "@/lib/auth";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const { name, email, phone, role, baseSalary, positionAllowance } = await req.json();

    // If the new role grants OWNER/MANAGER privilege and the user has no PIN
    // yet, mint one. Existing PINs are left alone — promoting a user shouldn't
    // rotate a PIN that may already be shared verbally; demoting them also
    // leaves the PIN dormant in the DB so they can be re-promoted later.
    const existing = await prisma.user.findUnique({
      where: { id },
      select: { pin: true },
    });
    let generatedPin: string | null = null;
    if (role && roleNeedsPin(role) && !existing?.pin) {
      generatedPin = await generateUniquePin();
    }

    const user = await prisma.user.update({
      where: { id },
      data: {
        name,
        email,
        phone: phone || null,
        role,
        ...(generatedPin ? { pin: generatedPin } : {}),
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

    return NextResponse.json({ id: user.id, name: user.name, role: user.role, generatedPin });
  } catch (err: any) {
    console.error("Update user error:", err);
    if (err.code === "P2002") {
      return NextResponse.json({ error: "อีเมลนี้มีผู้ใช้งานแล้ว" }, { status: 400 });
    }
    return NextResponse.json({ error: `ไม่สามารถแก้ไขข้อมูลได้` }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {

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
