import { NextRequest, NextResponse } from "next/server";
import { verifyPinHierarchical } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const { role, pin } = await req.json();
  if (!role || !pin) return NextResponse.json({ ok: false }, { status: 400 });

  const usedRole = await verifyPinHierarchical(role as "MANAGER" | "OWNER", pin);
  if (!usedRole) return NextResponse.json({ ok: false, error: "PIN ไม่ถูกต้อง" }, { status: 401 });

  // Look up a user with the role of the PIN that was actually entered
  // (so Owner PIN authorizing a Manager action records the Owner as approver)
  const user = await prisma.user.findFirst({
    where: {
      role: { contains: usedRole },
      isActive: true,
    },
    select: { id: true, name: true, role: true },
  });
  return NextResponse.json({
    ok: true,
    userId: user?.id ?? null,
    userName: user?.name ?? null,
    usedRole,
  });
}
