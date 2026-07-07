// Centralizes the keys used for system-wide configuration stored in `SystemConfig`,
// plus the catalogue of toggleable sidebar modules. Both the API and the
// settings UI import from here so they can't drift out of sync.

export type CommissionMode = "POOL" | "PER_HEAD" | "NONE";
export type VatMode = "EXCLUSIVE" | "INCLUSIVE";

// Per-mode commission rates. Each mode tracks its own tech / assistant percentage —
// the salon owner often wants different rates for POOL vs PER_HEAD (e.g. higher
// per-head rate to incentivise individual sales).
export type CommissionRates = {
  techPct: number;
  assistPct: number;
};

export type FinanceConfig = {
  commissionMode: CommissionMode;
  positionAllowance: boolean;
  vatMode: VatMode;
  poolRates: CommissionRates;
  perHeadRates: CommissionRates;
};

export const DEFAULT_FINANCE: FinanceConfig = {
  commissionMode: "POOL",
  positionAllowance: true,
  vatMode: "EXCLUSIVE",
  poolRates: { techPct: 10, assistPct: 5 },
  perHeadRates: { techPct: 10, assistPct: 5 },
};

// Clamp a raw user-supplied percentage to a sane range; reject NaN with a fallback.
export function normalizePct(raw: unknown, fallback: number): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(100, n));
}

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

// ───── Receipt footer builder ─────
//
// The bottom of a receipt is a user-composed, ordered list of blocks (text / image /
// divider). Each block carries its own visibility per receipt type, so e.g. a LINE-QR
// can print on the thermal slip but be omitted from the formal A4 tax invoice.

export type FooterBlockAlign = "left" | "center" | "right";
export type FooterTextSize = "sm" | "md" | "lg";

type FooterBlockBase = { showShort: boolean; showFull: boolean };
export type FooterTextBlock = FooterBlockBase & {
  type: "text";
  text: string;
  align: FooterBlockAlign;
  size: FooterTextSize;
  bold: boolean;
};
export type FooterImageBlock = FooterBlockBase & {
  type: "image";
  dataUrl: string;
  align: FooterBlockAlign;
  widthPct: number; // 10–100, percent of the receipt content width
};
export type FooterDividerBlock = FooterBlockBase & { type: "divider" };
export type FooterBlock = FooterTextBlock | FooterImageBlock | FooterDividerBlock;

// Legacy receipts hard-coded a centered "ขอบคุณที่ใช้บริการค่ะ" on the slip only;
// keep that as the default so a salon that never customizes its footer is unchanged.
export const DEFAULT_FOOTER_BLOCKS: FooterBlock[] = [
  { type: "text", text: "ขอบคุณที่ใช้บริการค่ะ 🙏", align: "center", size: "md", bold: false, showShort: true, showFull: false },
];

const FOOTER_ALIGNS: FooterBlockAlign[] = ["left", "center", "right"];
const FOOTER_SIZES: FooterTextSize[] = ["sm", "md", "lg"];
const MAX_FOOTER_BLOCKS = 20;
const MAX_FOOTER_TEXT_LEN = 500;

function pickEnum<T>(valid: readonly T[], raw: unknown, fallback: T): T {
  return valid.includes(raw as T) ? (raw as T) : fallback;
}

// Coerce arbitrary JSON (an API body or a stored config row) into a safe,
// fully-populated FooterBlock[]. Unknown/invalid blocks are dropped; image blocks
// without a real data URL are dropped. Caps count + text length to bound row size.
export function normalizeFooterBlocks(raw: unknown): FooterBlock[] {
  if (!Array.isArray(raw)) return [];
  const out: FooterBlock[] = [];
  for (const item of raw) {
    if (out.length >= MAX_FOOTER_BLOCKS) break;
    if (!item || typeof item !== "object") continue;
    const b = item as Record<string, unknown>;
    const showShort = b.showShort !== false; // default ⇒ visible
    const showFull = b.showFull !== false;
    if (b.type === "text") {
      out.push({
        type: "text",
        text: typeof b.text === "string" ? b.text.slice(0, MAX_FOOTER_TEXT_LEN) : "",
        align: pickEnum(FOOTER_ALIGNS, b.align, "center"),
        size: pickEnum(FOOTER_SIZES, b.size, "md"),
        bold: b.bold === true,
        showShort, showFull,
      });
    } else if (b.type === "image") {
      const dataUrl = typeof b.dataUrl === "string" ? b.dataUrl : "";
      if (!dataUrl.startsWith("data:image/")) continue;
      const wRaw = typeof b.widthPct === "number" ? b.widthPct : Number(b.widthPct);
      const widthPct = Number.isFinite(wRaw) ? Math.min(100, Math.max(10, Math.round(wRaw))) : 60;
      out.push({ type: "image", dataUrl, align: pickEnum(FOOTER_ALIGNS, b.align, "center"), widthPct, showShort, showFull });
    } else if (b.type === "divider") {
      out.push({ type: "divider", showShort, showFull });
    }
  }
  return out;
}

// Shared <style> body for the rendered footer — embedded by both receipt builders
// (src/lib/receipt.ts and the queue page's local copy) so the look can't drift.
export const FOOTER_BLOCKS_CSS = `
.rfooter { margin-top: 12px; }
.rf-block { margin: 6px 0; }
.rf-text { white-space: pre-wrap; word-break: break-word; line-height: 1.4; }
.rf-img img { max-width: 100%; height: auto; object-fit: contain; }
.rf-divider { border-top: 1px dashed #999; }
.rf-sm { font-size: 11px; }
.rf-md { font-size: 13px; }
.rf-lg { font-size: 16px; }
`.trim();

function escapeFooterHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Render the footer block list to an HTML string for one receipt type. Returns "" when
// nothing is visible so callers can drop the wrapper entirely. `white-space: pre-wrap`
// in FOOTER_BLOCKS_CSS preserves user line breaks, so text is only entity-escaped.
export function renderFooterBlocksHtml(blocks: FooterBlock[] | undefined, receiptType: "SHORT" | "FULL"): string {
  if (!blocks || !blocks.length) return "";
  const visible = blocks.filter(b => (receiptType === "SHORT" ? b.showShort : b.showFull));
  const inner = visible.map(b => {
    if (b.type === "text") {
      if (!b.text.trim()) return "";
      return `<div class="rf-block rf-text rf-${b.size}" style="text-align:${b.align};font-weight:${b.bold ? 700 : 400}">${escapeFooterHtml(b.text)}</div>`;
    }
    if (b.type === "image") {
      return `<div class="rf-block rf-img" style="text-align:${b.align}"><img src="${b.dataUrl}" alt="" style="width:${b.widthPct}%"/></div>`;
    }
    return `<div class="rf-block rf-divider"></div>`;
  }).join("");
  return inner.trim() ? `<div class="rfooter">${inner}</div>` : "";
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
