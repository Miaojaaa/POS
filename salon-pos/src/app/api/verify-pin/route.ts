import { NextRequest, NextResponse } from "next/server";
import { verifyPin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const { role, pin } = await req.json();
  if (!role || !pin) return NextResponse.json({ ok: false }, { status: 400 });
  const ok = await verifyPin(role as "MANAGER" | "OWNER", pin);
  if (!ok) return NextResponse.json({ ok: false, error: "PIN ไม่ถูกต้อง" }, { status: 401 });

  const user = await prisma.user.findFirst({
    where: { 
      role: { contains: role as string },
      isActive: true 
    },
    select: { id: true, name: true, role: true },
  });
  return NextResponse.json({ ok: true, userId: user?.id ?? null, userName: user?.name ?? null });
}
