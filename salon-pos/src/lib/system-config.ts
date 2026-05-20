// Centralizes the keys used for system-wide configuration stored in `SystemConfig`,
// plus the catalogue of toggleable sidebar modules. Both the API and the
// settings UI import from here so they can't drift out of sync.

export type CommissionMode = "POOL" | "PER_HEAD" | "NONE";
export type VatMode = "EXCLUSIVE" | "INCLUSIVE";

export type FinanceConfig = {
  commissionMode: CommissionMode;
  positionAllowance: boolean;
  vatMode: VatMode;
};

export const DEFAULT_FINANCE: FinanceConfig = {
  commissionMode: "POOL",
  positionAllowance: true,
  vatMode: "EXCLUSIVE",
};

// Top-level sidebar modules the user can toggle / reorder. Sub-pages stay grouped under their module
// and are not individually controllable from settings (to keep the UX simple).
export type SidebarModuleKey = "POS" | "DASHBOARD" | "CRM" | "ERP" | "REPORTS" | "HR" | "SETTINGS";

export type SidebarModuleConfig = { key: SidebarModuleKey; enabled: boolean };

// Default order matches the existing layout. New modules added later default to enabled at the end.
export const DEFAULT_SIDEBAR_ORDER: SidebarModuleKey[] = [
  "POS",
  "DASHBOARD",
  "CRM",
  "ERP",
  "REPORTS",
  "HR",
  "SETTINGS",
];

export const DEFAULT_SIDEBAR_CONFIG: SidebarModuleConfig[] =
  DEFAULT_SIDEBAR_ORDER.map(key => ({ key, enabled: true }));

// Settings cannot be disabled — otherwise the user can't recover access to this page.
export const NON_HIDEABLE_MODULES = new Set<SidebarModuleKey>(["SETTINGS"]);

export const MODULE_LABELS: Record<SidebarModuleKey, string> = {
  POS: "POS",
  DASHBOARD: "ภาพรวมรายวัน",
  CRM: "CRM",
  ERP: "สต็อก (ERP)",
  REPORTS: "รายงาน",
  HR: "HR & Payroll",
  SETTINGS: "ตั้งค่า",
};

export const MODULE_ICONS: Record<SidebarModuleKey, string> = {
  POS: "📋",
  DASHBOARD: "🏠",
  CRM: "👥",
  ERP: "📦",
  REPORTS: "📊",
  HR: "👤",
  SETTINGS: "⚙️",
};

// ───── Receipt / tax-invoice number format ─────
//
// The user can customize the receipt number layout per receipt type (SHORT vs FULL).
// Letters can sit at the front or the back; the date segment can be ordered Y/M/D, Y/D/M,
// M/D/Y, or D/M/Y; year can be CE/BE and 4 or 2 digits; sequence is zero-padded.
//
// Build order:
//   FRONT → `{prefix}{date}{seq}`   e.g. AA-2026-20-05-0001 = AA202620050001
//   BACK  → `{date}{seq}{prefix}`   e.g. 05-20-2569-0001-PPSA = 0520256900001PPSA

export type LetterPosition = "FRONT" | "BACK";
export type DateOrder = "YMD" | "YDM" | "MDY" | "DMY";
export type YearFormat = "CE_4" | "BE_4" | "CE_2" | "BE_2";

export type ReceiptFormatConfig = {
  prefix: string;
  letterPosition: LetterPosition;
  dateOrder: DateOrder;
  yearFormat: YearFormat;
  seqDigits: number;
};

export type ReceiptFormats = {
  short: ReceiptFormatConfig;
  full: ReceiptFormatConfig;
};

// Defaults preserve the legacy formats so existing receipts keep their look:
//   SHORT = LNDS{seq:0001}{dd}{mm}{yyyy}   → FRONT + DMY + CE_4 + 4-digit
//   FULL  = LNDSFULL{yyyy}{mm}{dd}{seq:0001} → FRONT + YMD + CE_4 + 4-digit
export const DEFAULT_RECEIPT_FORMATS: ReceiptFormats = {
  short: { prefix: "LNDS", letterPosition: "FRONT", dateOrder: "DMY", yearFormat: "CE_4", seqDigits: 4 },
  full:  { prefix: "LNDSFULL", letterPosition: "FRONT", dateOrder: "YMD", yearFormat: "CE_4", seqDigits: 4 },
};

const VALID_LETTER_POS: LetterPosition[] = ["FRONT", "BACK"];
const VALID_DATE_ORDER: DateOrder[] = ["YMD", "YDM", "MDY", "DMY"];
const VALID_YEAR_FMT: YearFormat[] = ["CE_4", "BE_4", "CE_2", "BE_2"];

export function normalizeReceiptFormat(raw: Partial<ReceiptFormatConfig> | null | undefined, fallback: ReceiptFormatConfig): ReceiptFormatConfig {
  if (!raw || typeof raw !== "object") return fallback;
  const prefix = typeof raw.prefix === "string" ? raw.prefix.trim().slice(0, 16) : fallback.prefix;
  const letterPosition = VALID_LETTER_POS.includes(raw.letterPosition as LetterPosition) ? raw.letterPosition as LetterPosition : fallback.letterPosition;
  const dateOrder = VALID_DATE_ORDER.includes(raw.dateOrder as DateOrder) ? raw.dateOrder as DateOrder : fallback.dateOrder;
  const yearFormat = VALID_YEAR_FMT.includes(raw.yearFormat as YearFormat) ? raw.yearFormat as YearFormat : fallback.yearFormat;
  const seqDigitsRaw = typeof raw.seqDigits === "number" ? raw.seqDigits : Number(raw.seqDigits);
  const seqDigits = Number.isFinite(seqDigitsRaw) ? Math.min(8, Math.max(2, Math.round(seqDigitsRaw))) : fallback.seqDigits;
  return { prefix, letterPosition, dateOrder, yearFormat, seqDigits };
}

// Single source of truth for assembling the final receipt-number string. Used both
// server-side (mark-printed) and client-side (queue/history print + display).
export function buildReceiptNumber(seq: number, date: Date, cfg: ReceiptFormatConfig): string {
  const yearCE = date.getFullYear();
  const year = cfg.yearFormat.startsWith("BE") ? yearCE + 543 : yearCE;
  const yearStr = cfg.yearFormat.endsWith("4") ? String(year) : String(year).slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");

  let datePart: string;
  switch (cfg.dateOrder) {
    case "YMD": datePart = yearStr + mm + dd; break;
    case "YDM": datePart = yearStr + dd + mm; break;
    case "MDY": datePart = mm + dd + yearStr; break;
    case "DMY": datePart = dd + mm + yearStr; break;
  }

  const seqStr = String(seq).padStart(cfg.seqDigits, "0");
  return cfg.letterPosition === "FRONT"
    ? `${cfg.prefix}${datePart}${seqStr}`
    : `${datePart}${seqStr}${cfg.prefix}`;
}

// Merges saved sidebar config with the canonical module list. Missing modules
// (added in a later release) get appended enabled-by-default; SETTINGS is forced enabled.
export function mergeSidebarConfig(saved: SidebarModuleConfig[] | null | undefined): SidebarModuleConfig[] {
  const result: SidebarModuleConfig[] = [];
  const seen = new Set<SidebarModuleKey>();
  if (Array.isArray(saved)) {
    for (const s of saved) {
      if (!(s.key in MODULE_LABELS)) continue;
      if (seen.has(s.key)) continue;
      const enabled = NON_HIDEABLE_MODULES.has(s.key) ? true : Boolean(s.enabled);
      result.push({ key: s.key, enabled });
      seen.add(s.key);
    }
  }
  for (const key of DEFAULT_SIDEBAR_ORDER) {
    if (!seen.has(key)) result.push({ key, enabled: true });
  }
  return result;
}
