import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const SHOP_NAME_KEY = "shop.name";
const SHOP_LOGO_KEY = "shop.logo";

const DEFAULT_SHOP_NAME = "บริษัท ลานนาดีเซีย กรุ๊ป จำกัด";

// Max ~600KB raw → ~800KB base64. Keeps SQLite TEXT row size reasonable.
const MAX_LOGO_BYTES = 800_000;

export async function GET() {
  const rows = await prisma.systemConfig.findMany({
    where: { key: { in: [SHOP_NAME_KEY, SHOP_LOGO_KEY] } },
  });
  const map = Object.fromEntries(rows.map(r => [r.key, r.value]));
  return NextResponse.json({
    shopName: map[SHOP_NAME_KEY] ?? DEFAULT_SHOP_NAME,
    logoDataUrl: map[SHOP_LOGO_KEY] ?? null,
  });
}

export async function PUT(req: NextRequest) {
  const body = await req.json().catch(() => null) as
    | { shopName?: string; logoDataUrl?: string | null }
    | null;
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const updates: Array<Promise<unknown>> = [];

  if (typeof body.shopName === "string") {
    const name = body.shopName.trim();
    if (!name) return NextResponse.json({ error: "ชื่อร้านห้ามว่าง" }, { status: 400 });
    updates.push(prisma.systemConfig.upsert({
      where: { key: SHOP_NAME_KEY },
      update: { value: name },
      create: { key: SHOP_NAME_KEY, value: name },
    }));
  }

  if (body.logoDataUrl !== undefined) {
    if (body.logoDataUrl === null || body.logoDataUrl === "") {
      updates.push(prisma.systemConfig.deleteMany({ where: { key: SHOP_LOGO_KEY } }));
    } else {
      const url = body.logoDataUrl;
      if (!url.startsWith("data:image/")) {
        return NextResponse.json({ error: "รูปต้องเป็น data URL ของรูปภาพ" }, { status: 400 });
      }
      if (url.length > MAX_LOGO_BYTES) {
        return NextResponse.json({ error: "รูปใหญ่เกินไป (จำกัด ~600KB)" }, { status: 400 });
      }
      updates.push(prisma.systemConfig.upsert({
        where: { key: SHOP_LOGO_KEY },
        update: { value: url },
        create: { key: SHOP_LOGO_KEY, value: url },
      }));
    }
  }

  await Promise.all(updates);

  const rows = await prisma.systemConfig.findMany({
    where: { key: { in: [SHOP_NAME_KEY, SHOP_LOGO_KEY] } },
  });
  const map = Object.fromEntries(rows.map(r => [r.key, r.value]));
  return NextResponse.json({
    shopName: map[SHOP_NAME_KEY] ?? DEFAULT_SHOP_NAME,
    logoDataUrl: map[SHOP_LOGO_KEY] ?? null,
  });
}
