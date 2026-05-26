import { NextRequest, NextResponse } from "next/server";
import { verifyPinIdentified } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { role, pin } = await req.json();
  if (!role || !pin) return NextResponse.json({ ok: false }, { status: 400 });

  const result = await verifyPinIdentified(role as "MANAGER" | "OWNER", pin);
  if (!result) return NextResponse.json({ ok: false, error: "PIN ไม่ถูกต้อง" }, { status: 401 });

  return NextResponse.json({
    ok: true,
    userId: result.userId,
    userName: result.userName,
    usedRole: result.role,
  });
}
