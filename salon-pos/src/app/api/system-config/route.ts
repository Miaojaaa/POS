import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_FINANCE,
  DEFAULT_RECEIPT_FORMATS,
  DEFAULT_SIDEBAR_CONFIG,
  mergeSidebarConfig,
  normalizePct,
  normalizeReceiptFormat,
  type CommissionMode,
  type CommissionRates,
  type ReceiptFormatConfig,
  type ReceiptFormats,
  type SidebarModuleConfig,
  type VatMode,
} from "@/lib/system-config";

const FINANCE_COMMISSION_KEY = "finance.commissionMode";
const FINANCE_POSITION_KEY = "finance.positionAllowance";
const FINANCE_VAT_KEY = "finance.vatMode";
const FINANCE_POOL_TECH_KEY = "finance.commission.pool.tech";
const FINANCE_POOL_ASSIST_KEY = "finance.commission.pool.assist";
const FINANCE_PERHEAD_TECH_KEY = "finance.commission.perHead.tech";
const FINANCE_PERHEAD_ASSIST_KEY = "finance.commission.perHead.assist";
const SIDEBAR_CONFIG_KEY = "sidebar.config";
const RECEIPT_FORMAT_SHORT_KEY = "receipt.format.short";
const RECEIPT_FORMAT_FULL_KEY = "receipt.format.full";

const ALL_KEYS = [
  FINANCE_COMMISSION_KEY, FINANCE_POSITION_KEY, FINANCE_VAT_KEY,
  FINANCE_POOL_TECH_KEY, FINANCE_POOL_ASSIST_KEY,
  FINANCE_PERHEAD_TECH_KEY, FINANCE_PERHEAD_ASSIST_KEY,
  SIDEBAR_CONFIG_KEY,
  RECEIPT_FORMAT_SHORT_KEY, RECEIPT_FORMAT_FULL_KEY,
];

const VALID_COMMISSION_MODES: CommissionMode[] = ["POOL", "PER_HEAD", "NONE"];
const VALID_VAT_MODES: VatMode[] = ["EXCLUSIVE", "INCLUSIVE"];

function parseSidebarConfig(raw: string | undefined): SidebarModuleConfig[] {
  if (!raw) return DEFAULT_SIDEBAR_CONFIG;
  try {
    const parsed = JSON.parse(raw);
    return mergeSidebarConfig(Array.isArray(parsed) ? parsed : null);
  } catch {
    return DEFAULT_SIDEBAR_CONFIG;
  }
}

function parseReceiptFormat(raw: string | undefined, fallback: ReceiptFormatConfig): ReceiptFormatConfig {
  if (!raw) return fallback;
  try {
    return normalizeReceiptFormat(JSON.parse(raw), fallback);
  } catch {
    return fallback;
  }
}

function readPct(raw: string | undefined, fallback: number): number {
  if (raw === undefined) return fallback;
  return normalizePct(raw, fallback);
}

function readConfig(map: Record<string, string>) {
  const commissionRaw = map[FINANCE_COMMISSION_KEY];
  const commissionMode: CommissionMode = VALID_COMMISSION_MODES.includes(commissionRaw as CommissionMode)
    ? (commissionRaw as CommissionMode)
    : DEFAULT_FINANCE.commissionMode;

  const vatRaw = map[FINANCE_VAT_KEY];
  const vatMode: VatMode = VALID_VAT_MODES.includes(vatRaw as VatMode)
    ? (vatRaw as VatMode)
    : DEFAULT_FINANCE.vatMode;

  return {
    finance: {
      commissionMode,
      positionAllowance: map[FINANCE_POSITION_KEY] === undefined
        ? DEFAULT_FINANCE.positionAllowance
        : map[FINANCE_POSITION_KEY] === "true",
      vatMode,
      poolRates: {
        techPct: readPct(map[FINANCE_POOL_TECH_KEY], DEFAULT_FINANCE.poolRates.techPct),
        assistPct: readPct(map[FINANCE_POOL_ASSIST_KEY], DEFAULT_FINANCE.poolRates.assistPct),
      },
      perHeadRates: {
        techPct: readPct(map[FINANCE_PERHEAD_TECH_KEY], DEFAULT_FINANCE.perHeadRates.techPct),
        assistPct: readPct(map[FINANCE_PERHEAD_ASSIST_KEY], DEFAULT_FINANCE.perHeadRates.assistPct),
      },
    },
    sidebar: parseSidebarConfig(map[SIDEBAR_CONFIG_KEY]),
    receiptFormat: {
      short: parseReceiptFormat(map[RECEIPT_FORMAT_SHORT_KEY], DEFAULT_RECEIPT_FORMATS.short),
      full: parseReceiptFormat(map[RECEIPT_FORMAT_FULL_KEY], DEFAULT_RECEIPT_FORMATS.full),
    },
  };
}

export async function GET() {
  const rows = await prisma.systemConfig.findMany({ where: { key: { in: ALL_KEYS } } });
  return NextResponse.json(readConfig(Object.fromEntries(rows.map(r => [r.key, r.value]))));
}

type PutBody = {
  finance?: {
    commissionMode?: CommissionMode;
    positionAllowance?: boolean;
    vatMode?: VatMode;
    poolRates?: Partial<CommissionRates>;
    perHeadRates?: Partial<CommissionRates>;
  };
  sidebar?: SidebarModuleConfig[];
  receiptFormat?: Partial<ReceiptFormats>;
};

function upsertPct(key: string, value: number) {
  return prisma.systemConfig.upsert({
    where: { key },
    update: { value: String(value) },
    create: { key, value: String(value) },
  });
}

export async function PUT(req: NextRequest) {
  const body = await req.json().catch(() => null) as PutBody | null;
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const updates: Array<Promise<unknown>> = [];

  if (body.finance) {
    const { commissionMode, positionAllowance, vatMode, poolRates, perHeadRates } = body.finance;
    if (commissionMode !== undefined) {
      if (!VALID_COMMISSION_MODES.includes(commissionMode)) {
        return NextResponse.json({ error: "ค่าคอมไม่ถูกต้อง" }, { status: 400 });
      }
      updates.push(prisma.systemConfig.upsert({
        where: { key: FINANCE_COMMISSION_KEY },
        update: { value: commissionMode },
        create: { key: FINANCE_COMMISSION_KEY, value: commissionMode },
      }));
    }
    if (positionAllowance !== undefined) {
      if (typeof positionAllowance !== "boolean") {
        return NextResponse.json({ error: "ค่าตำแหน่งต้องเป็น true/false" }, { status: 400 });
      }
      updates.push(prisma.systemConfig.upsert({
        where: { key: FINANCE_POSITION_KEY },
        update: { value: String(positionAllowance) },
        create: { key: FINANCE_POSITION_KEY, value: String(positionAllowance) },
      }));
    }
    if (vatMode !== undefined) {
      if (!VALID_VAT_MODES.includes(vatMode)) {
        return NextResponse.json({ error: "โหมด VAT ไม่ถูกต้อง" }, { status: 400 });
      }
      updates.push(prisma.systemConfig.upsert({
        where: { key: FINANCE_VAT_KEY },
        update: { value: vatMode },
        create: { key: FINANCE_VAT_KEY, value: vatMode },
      }));
    }
    if (poolRates?.techPct !== undefined) {
      updates.push(upsertPct(FINANCE_POOL_TECH_KEY, normalizePct(poolRates.techPct, DEFAULT_FINANCE.poolRates.techPct)));
    }
    if (poolRates?.assistPct !== undefined) {
      updates.push(upsertPct(FINANCE_POOL_ASSIST_KEY, normalizePct(poolRates.assistPct, DEFAULT_FINANCE.poolRates.assistPct)));
    }
    if (perHeadRates?.techPct !== undefined) {
      updates.push(upsertPct(FINANCE_PERHEAD_TECH_KEY, normalizePct(perHeadRates.techPct, DEFAULT_FINANCE.perHeadRates.techPct)));
    }
    if (perHeadRates?.assistPct !== undefined) {
      updates.push(upsertPct(FINANCE_PERHEAD_ASSIST_KEY, normalizePct(perHeadRates.assistPct, DEFAULT_FINANCE.perHeadRates.assistPct)));
    }
  }

  if (body.sidebar !== undefined) {
    if (!Array.isArray(body.sidebar)) {
      return NextResponse.json({ error: "Sidebar config ต้องเป็น array" }, { status: 400 });
    }
    const merged = mergeSidebarConfig(body.sidebar);
    updates.push(prisma.systemConfig.upsert({
      where: { key: SIDEBAR_CONFIG_KEY },
      update: { value: JSON.stringify(merged) },
      create: { key: SIDEBAR_CONFIG_KEY, value: JSON.stringify(merged) },
    }));
  }

  if (body.receiptFormat) {
    const pairs: Array<[string, ReceiptFormatConfig | undefined, ReceiptFormatConfig]> = [
      [RECEIPT_FORMAT_SHORT_KEY, body.receiptFormat.short, DEFAULT_RECEIPT_FORMATS.short],
      [RECEIPT_FORMAT_FULL_KEY, body.receiptFormat.full, DEFAULT_RECEIPT_FORMATS.full],
    ];
    for (const [key, raw, fallback] of pairs) {
      if (raw === undefined) continue;
      const normalized = normalizeReceiptFormat(raw, fallback);
      if (!normalized.prefix) {
        return NextResponse.json({ error: "Prefix ของเลขใบเสร็จห้ามว่าง" }, { status: 400 });
      }
      updates.push(prisma.systemConfig.upsert({
        where: { key },
        update: { value: JSON.stringify(normalized) },
        create: { key, value: JSON.stringify(normalized) },
      }));
    }
  }

  await Promise.all(updates);

  const rows = await prisma.systemConfig.findMany({ where: { key: { in: ALL_KEYS } } });
  return NextResponse.json(readConfig(Object.fromEntries(rows.map(r => [r.key, r.value]))));
}
