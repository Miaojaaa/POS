import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Barcode lookup for the scanner. Returns the RetailProduct if found (200) or
 * { found: false } with 200 if not — callers decide whether to surface the
 * "create new" flow. We deliberately don't 404 on miss because that's not an
 * error condition; it's the trigger for a different UX path.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = (searchParams.get("code") || "").trim();
  if (!code) return NextResponse.json({ error: "code required" }, { status: 400 });

  const product = await prisma.retailProduct.findUnique({ where: { barcode: code } });
  if (!product || !product.isActive) {
    return NextResponse.json({ found: false, code });
  }
  return NextResponse.json({ found: true, product });
}
