import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { type } = await req.json();
  if (type !== "SHORT" && type !== "FULL") {
    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  }
  // FULL is the legally-binding tax invoice — never downgrade to SHORT once a FULL has been issued.
  const existing = await prisma.order.findUnique({ where: { id }, select: { receiptType: true } });
  if (existing?.receiptType === "FULL" && type === "SHORT") {
    return NextResponse.json({ ok: true, receiptType: "FULL" });
  }
  const updated = await prisma.order.update({
    where: { id },
    data: { receiptType: type },
    select: { receiptType: true },
  });
  return NextResponse.json({ ok: true, receiptType: updated.receiptType });
}
