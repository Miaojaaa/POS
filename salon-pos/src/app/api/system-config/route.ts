import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_FINANCE,
  DEFAULT_SIDEBAR_CONFIG,
  mergeSidebarConfig,
  type CommissionMode,
  type SidebarModuleConfig,
  type VatMode,
} from "@/lib/system-config";

const FINANCE_COMMISSION_KEY = "finance.commissionMode";
const FINANCE_POSITION_KEY = "finance.positionAllowance";
const FINANCE_VAT_KEY = "finance.vatMode";
const SIDEBAR_CONFIG_KEY = "sidebar.config";

const ALL_KEYS = [FINANCE_COMMISSION_KEY, FINANCE_POSITION_KEY, FINANCE_VAT_KEY, SIDEBAR_CONFIG_KEY];

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
    },
    sidebar: parseSidebarConfig(map[SIDEBAR_CONFIG_KEY]),
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
  };
  sidebar?: SidebarModuleConfig[];
};

export async function PUT(req: NextRequest) {
  const body = await req.json().catch(() => null) as PutBody | null;
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const updates: Array<Promise<unknown>> = [];

  if (body.finance) {
    const { commissionMode, positionAllowance, vatMode } = body.finance;
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

  await Promise.all(updates);

  const rows = await prisma.systemConfig.findMany({ where: { key: { in: ALL_KEYS } } });
  return NextResponse.json(readConfig(Object.fromEntries(rows.map(r => [r.key, r.value]))));
}
