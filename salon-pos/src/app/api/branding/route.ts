import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeFooterBlocks, DEFAULT_FOOTER_BLOCKS, type FooterBlock } from "@/lib/system-config";
import { isValidPromptPayId } from "@/lib/promptpay";

const SHOP_NAME_KEY = "shop.name";
const SHOP_LOGO_KEY = "shop.logo";
const SHOP_ADDRESS_KEY = "shop.address";
const SHOP_TAX_ID_KEY = "shop.taxId";
// PromptPay proxy id (phone / national id / e-wallet) used to render the dynamic
// payment QR on the customer-facing display.
const SHOP_PROMPTPAY_KEY = "shop.promptpayId";
const THEME_MAIN_KEY = "theme.main";
const THEME_SECONDARY_KEY = "theme.secondary";
const THEME_THIRD_KEY = "theme.third";
// Receipt footer: a JSON-encoded ordered list of blocks (text / image / divider).
const SHOP_FOOTER_BLOCKS_KEY = "shop.receiptFooterBlocks";
// Legacy single-image footer keys (pre-block model) — read only, for one-time
// migration into a block when no block config exists yet. Cleared on first save.
const LEGACY_FOOTER_IMG_KEY = "shop.receiptFooter";
const LEGACY_FOOTER_SHORT_KEY = "shop.receiptFooterShort";
const LEGACY_FOOTER_FULL_KEY = "shop.receiptFooterFull";

const ALL_KEYS = [SHOP_NAME_KEY, SHOP_LOGO_KEY, SHOP_ADDRESS_KEY, SHOP_TAX_ID_KEY, SHOP_PROMPTPAY_KEY, THEME_MAIN_KEY, THEME_SECONDARY_KEY, THEME_THIRD_KEY, SHOP_FOOTER_BLOCKS_KEY, LEGACY_FOOTER_IMG_KEY, LEGACY_FOOTER_SHORT_KEY, LEGACY_FOOTER_FULL_KEY];

const DEFAULT_SHOP_NAME = "บริษัท ลานนาดีเซีย กรุ๊ป จำกัด";
const DEFAULT_ADDRESS = "119/2 หมู่บ้านใจแก้เอราวัณ 23 หมู่ 3 ตำบล หนองหอย อำเภอ เมืองเชียงใหม่ จังหวัด เชียงใหม่ 50000";
const DEFAULT_TAX_ID = "0505567002730";

// Defaults mirror globals.css: --olive / --olive-light / --beige
const DEFAULT_THEME = {
  main: "#6B7C45",
  secondary: "#8FA65A",
  third: "#F5F0E8",
} as const;

// Max ~600KB raw → ~800KB base64. Keeps SQLite TEXT row size reasonable.
const MAX_LOGO_BYTES = 1_500_000;
// The whole footer (possibly several embedded images) lives in one row. Cap the
// serialized size so a runaway config can't bloat SQLite.
const MAX_FOOTER_BYTES = 4_000_000;

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

// Build the footer block list from stored config. Prefers the new JSON block key;
// when absent, migrates the legacy single-image model into blocks so a previously
// uploaded QR survives. Falls back to the default thank-you line otherwise.
function readFooterBlocks(map: Record<string, string>): FooterBlock[] {
  const raw = map[SHOP_FOOTER_BLOCKS_KEY];
  if (raw) {
    try {
      return normalizeFooterBlocks(JSON.parse(raw));
    } catch {
      return [...DEFAULT_FOOTER_BLOCKS];
    }
  }
  const blocks: FooterBlock[] = [...DEFAULT_FOOTER_BLOCKS];
  const legacyImg = map[LEGACY_FOOTER_IMG_KEY];
  if (legacyImg) {
    blocks.push({
      type: "image",
      dataUrl: legacyImg,
      align: "center",
      widthPct: 60,
      showShort: map[LEGACY_FOOTER_SHORT_KEY] !== "0",
      showFull: map[LEGACY_FOOTER_FULL_KEY] !== "0",
    });
  }
  return blocks;
}

function readBranding(map: Record<string, string>) {
  return {
    shopName: map[SHOP_NAME_KEY] ?? DEFAULT_SHOP_NAME,
    logoDataUrl: map[SHOP_LOGO_KEY] ?? null,
    address: map[SHOP_ADDRESS_KEY] ?? DEFAULT_ADDRESS,
    taxId: map[SHOP_TAX_ID_KEY] ?? DEFAULT_TAX_ID,
    promptpayId: map[SHOP_PROMPTPAY_KEY] ?? null,
    theme: {
      main: map[THEME_MAIN_KEY] ?? DEFAULT_THEME.main,
      secondary: map[THEME_SECONDARY_KEY] ?? DEFAULT_THEME.secondary,
      third: map[THEME_THIRD_KEY] ?? DEFAULT_THEME.third,
    },
    footerBlocks: readFooterBlocks(map),
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
  promptpayId?: string | null;
  theme?: { main?: string; secondary?: string; third?: string };
  footerBlocks?: unknown;
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

  if (body.promptpayId !== undefined) {
    const raw = (body.promptpayId ?? "").replace(/\D/g, "");
    if (raw === "") {
      updates.push(prisma.systemConfig.deleteMany({ where: { key: SHOP_PROMPTPAY_KEY } }));
    } else if (!isValidPromptPayId(raw)) {
      return NextResponse.json({ error: "PromptPay ID ต้องเป็นเบอร์โทร 10 หลัก, เลขบัตรประชาชน 13 หลัก หรือ e-Wallet 15 หลัก" }, { status: 400 });
    } else {
      updates.push(prisma.systemConfig.upsert({
        where: { key: SHOP_PROMPTPAY_KEY },
        update: { value: raw },
        create: { key: SHOP_PROMPTPAY_KEY, value: raw },
      }));
    }
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

  if (body.footerBlocks !== undefined) {
    const blocks = normalizeFooterBlocks(body.footerBlocks);
    const json = JSON.stringify(blocks);
    if (json.length > MAX_FOOTER_BYTES) {
      return NextResponse.json({ error: "รูปท้ายบิลใหญ่เกินไป — กรุณาลดจำนวน/ขนาดรูป" }, { status: 400 });
    }
    updates.push(prisma.systemConfig.upsert({
      where: { key: SHOP_FOOTER_BLOCKS_KEY },
      update: { value: json },
      create: { key: SHOP_FOOTER_BLOCKS_KEY, value: json },
    }));
    // Once the user saves a block config, retire the legacy single-image keys so
    // they can't shadow it or waste space on the next migration read.
    updates.push(prisma.systemConfig.deleteMany({
      where: { key: { in: [LEGACY_FOOTER_IMG_KEY, LEGACY_FOOTER_SHORT_KEY, LEGACY_FOOTER_FULL_KEY] } },
    }));
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
