import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const SHOP_NAME_KEY = "shop.name";
const SHOP_LOGO_KEY = "shop.logo";
const SHOP_ADDRESS_KEY = "shop.address";
const SHOP_TAX_ID_KEY = "shop.taxId";
const THEME_MAIN_KEY = "theme.main";
const THEME_SECONDARY_KEY = "theme.secondary";
const THEME_THIRD_KEY = "theme.third";

const ALL_KEYS = [SHOP_NAME_KEY, SHOP_LOGO_KEY, SHOP_ADDRESS_KEY, SHOP_TAX_ID_KEY, THEME_MAIN_KEY, THEME_SECONDARY_KEY, THEME_THIRD_KEY];

const DEFAULT_SHOP_NAME = "บริษัท ลานนาดีเซีย กรุ๊ป จำกัด";
const DEFAULT_ADDRESS = "119/2 หมู่บ้านใจแก้เอราวัณ 23 หมู่ 3 ตำบล หนองหอย อำเภอ เมืองเชียงใหม่ จังหวัด เชียงใหม่ 50000";
const DEFAULT_TAX_ID = "0505567002730";

// Defaults mirror globals.css: --olive / --olive-light / --beige
export const DEFAULT_THEME = {
  main: "#6B7C45",
  secondary: "#8FA65A",
  third: "#F5F0E8",
} as const;

// Max ~600KB raw → ~800KB base64. Keeps SQLite TEXT row size reasonable.
const MAX_LOGO_BYTES = 1_500_000;

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

function readBranding(map: Record<string, string>) {
  return {
    shopName: map[SHOP_NAME_KEY] ?? DEFAULT_SHOP_NAME,
    logoDataUrl: map[SHOP_LOGO_KEY] ?? null,
    address: map[SHOP_ADDRESS_KEY] ?? DEFAULT_ADDRESS,
    taxId: map[SHOP_TAX_ID_KEY] ?? DEFAULT_TAX_ID,
    theme: {
      main: map[THEME_MAIN_KEY] ?? DEFAULT_THEME.main,
      secondary: map[THEME_SECONDARY_KEY] ?? DEFAULT_THEME.secondary,
      third: map[THEME_THIRD_KEY] ?? DEFAULT_THEME.third,
    },
  };
}

export async function GET() {
  const rows = await prisma.systemConfig.findMany({ where: { key: { in: ALL_KEYS } } });
  return NextResponse.json(readBranding(Object.fromEntries(rows.map(r => [r.key, r.value]))));
}

type PutBody = {
  shopName?: string;
  logoDataUrl?: string | null;
  address?: string;
  taxId?: string;
  theme?: { main?: string; secondary?: string; third?: string };
};

export async function PUT(req: NextRequest) {
  const body = await req.json().catch(() => null) as PutBody | null;
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

  if (typeof body.address === "string") {
    const addr = body.address.trim();
    if (!addr) return NextResponse.json({ error: "ที่อยู่ห้ามว่าง" }, { status: 400 });
    updates.push(prisma.systemConfig.upsert({
      where: { key: SHOP_ADDRESS_KEY },
      update: { value: addr },
      create: { key: SHOP_ADDRESS_KEY, value: addr },
    }));
  }

  if (typeof body.taxId === "string") {
    const taxId = body.taxId.trim();
    if (!taxId) return NextResponse.json({ error: "เลขผู้เสียภาษีห้ามว่าง" }, { status: 400 });
    if (!/^\d{13}$/.test(taxId)) {
      return NextResponse.json({ error: "เลขผู้เสียภาษีต้องเป็นตัวเลข 13 หลัก" }, { status: 400 });
    }
    updates.push(prisma.systemConfig.upsert({
      where: { key: SHOP_TAX_ID_KEY },
      update: { value: taxId },
      create: { key: SHOP_TAX_ID_KEY, value: taxId },
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
        return NextResponse.json({ error: "รูปใหญ่เกินไป — กรุณาเลือกไฟล์เล็กลง" }, { status: 400 });
      }
      updates.push(prisma.systemConfig.upsert({
        where: { key: SHOP_LOGO_KEY },
        update: { value: url },
        create: { key: SHOP_LOGO_KEY, value: url },
      }));
    }
  }

  if (body.theme) {
    const entries: Array<[string, string | undefined]> = [
      [THEME_MAIN_KEY, body.theme.main],
      [THEME_SECONDARY_KEY, body.theme.secondary],
      [THEME_THIRD_KEY, body.theme.third],
    ];
    for (const [key, val] of entries) {
      if (val === undefined) continue;
      if (!HEX_RE.test(val)) {
        return NextResponse.json({ error: `รูปแบบสีไม่ถูกต้อง (${val}) — ต้องเป็น #RRGGBB` }, { status: 400 });
      }
      updates.push(prisma.systemConfig.upsert({
        where: { key },
        update: { value: val },
        create: { key, value: val },
      }));
    }
  }

  await Promise.all(updates);

  const rows = await prisma.systemConfig.findMany({ where: { key: { in: ALL_KEYS } } });
  return NextResponse.json(readBranding(Object.fromEntries(rows.map(r => [r.key, r.value]))));
}
