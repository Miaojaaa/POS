// Amount-based payment-QR routing (backend logic only — no UI yet).
//
// A salon may want different receiving accounts depending on the bill size, e.g.
//   • ยอด < 5,000  → PromptPay/QR ของบัญชี A
//   • ยอด ≥ 5,000  → PromptPay/QR ของบัญชี B
// This module models that as an ordered list of threshold rules plus a fallback,
// and resolves the right QR for a given amount. Each rule's QR can be either a
// PromptPay id (a *dynamic* QR with the amount embedded is generated on the fly)
// or a pre-uploaded *static* QR image — both are supported so the eventual settings
// UI can offer whichever the shop prefers.
//
// Pure + dependency-free (only imports the PromptPay payload builder) so it runs in
// the browser (customer-display renders the QR client-side) and on the server.
// The settings UI / API wiring is intentionally NOT done here — that comes later.

import { buildPromptPayPayload, isValidPromptPayId } from "./promptpay";

// Where a QR comes from. `promptpay` → generate a dynamic EMVCo payload carrying the
// amount; `image` → show a fixed QR the shop uploaded (amount typed by the customer).
export type QrSource =
  | { type: "promptpay"; promptpayId: string }
  | { type: "image"; dataUrl: string };

// One threshold bucket. Match is inclusive-lower / exclusive-upper so a bill that
// lands exactly on a boundary falls into the *higher* bucket — i.e. 5000 with a
// 5000-split goes to the "≥ 5000" rule, matching how people describe the split.
// `maxAmount: null` means "no upper bound" (the open-ended top bucket).
export type AmountQrRule = {
  minAmount: number;
  maxAmount: number | null;
  source: QrSource;
  label?: string; // optional human tag, e.g. "บัญชีหลัก" — purely cosmetic
};

// The full config the shop saves. Rules are evaluated in ascending `minAmount`
// order (the normalizer sorts them); the first match wins. `fallback` covers any
// amount no rule claims (and the common single-account case where `rules` is empty).
export type QrRoutingConfig = {
  rules: AmountQrRule[];
  fallback: QrSource | null;
};

// What a caller renders for a concrete amount. `payload` is fed to a QR renderer
// (e.g. the `qrcode` lib); `image` is shown directly. Discriminated so the UI can
// branch without re-deriving the source type.
export type ResolvedQr =
  | { kind: "payload"; payload: string; promptpayId: string; amount: number; label?: string }
  | { kind: "image"; dataUrl: string; label?: string };

export const EMPTY_QR_ROUTING: QrRoutingConfig = { rules: [], fallback: null };

// Bound the rule list so a runaway config can't bloat storage / the UI.
const MAX_QR_RULES = 12;

// ───── validation / normalization (mirrors the defensive style of
// normalizeFooterBlocks / normalizeReceiptFormat in system-config.ts) ─────

function toFiniteNumber(raw: unknown): number | null {
  const n = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(n) ? n : null;
}

// Coerce arbitrary JSON into a valid QrSource, or null if it can't be salvaged.
// A promptpay source needs a syntactically valid id; an image source needs a real
// image data URL. Anything else is dropped by the caller.
export function normalizeQrSource(raw: unknown): QrSource | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as Record<string, unknown>;
  if (s.type === "promptpay") {
    const id = typeof s.promptpayId === "string" ? s.promptpayId.trim() : "";
    if (!isValidPromptPayId(id)) return null;
    return { type: "promptpay", promptpayId: id };
  }
  if (s.type === "image") {
    const dataUrl = typeof s.dataUrl === "string" ? s.dataUrl : "";
    if (!dataUrl.startsWith("data:image/")) return null;
    return { type: "image", dataUrl };
  }
  return null;
}

// Coerce one rule. Drops the rule (returns null) when the amount range is unusable
// or the QR source is invalid. `minAmount` is clamped to ≥ 0; an inverted or
// empty range (max ≤ min) is rejected so it can never silently swallow no amounts.
function normalizeQrRule(raw: unknown): AmountQrRule | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const source = normalizeQrSource(r.source);
  if (!source) return null;

  const min = toFiniteNumber(r.minAmount);
  const minAmount = min !== null ? Math.max(0, min) : 0;

  // maxAmount may legitimately be null/absent (open-ended top bucket).
  let maxAmount: number | null = null;
  if (r.maxAmount !== null && r.maxAmount !== undefined && r.maxAmount !== "") {
    const max = toFiniteNumber(r.maxAmount);
    if (max === null) return null;
    if (max <= minAmount) return null; // inverted / empty range
    maxAmount = max;
  }

  const label = typeof r.label === "string" && r.label.trim() ? r.label.trim().slice(0, 60) : undefined;
  return { minAmount, maxAmount, source, ...(label ? { label } : {}) };
}

// Build a safe, sorted QrRoutingConfig from any stored/posted JSON. Invalid rules
// are dropped, valid ones are sorted ascending by `minAmount`, and the list is
// capped. `fallback` is normalized independently (null when absent/invalid).
export function normalizeQrRouting(raw: unknown): QrRoutingConfig {
  if (!raw || typeof raw !== "object") return { ...EMPTY_QR_ROUTING };
  const obj = raw as Record<string, unknown>;

  const rulesRaw = Array.isArray(obj.rules) ? obj.rules : [];
  const rules: AmountQrRule[] = [];
  for (const item of rulesRaw) {
    if (rules.length >= MAX_QR_RULES) break;
    const rule = normalizeQrRule(item);
    if (rule) rules.push(rule);
  }
  rules.sort((a, b) => a.minAmount - b.minAmount);

  const fallback = normalizeQrSource(obj.fallback);
  return { rules, fallback: fallback ?? null };
}

// ───── resolution ─────

// Pick the QR source that applies to `amount`: the first rule whose range contains
// it, else the fallback. Returns null when nothing applies (no rule matched and no
// fallback configured) so the caller can show a "no QR configured" state.
export function selectQrSource(config: QrRoutingConfig, amount: number): { source: QrSource; rule: AmountQrRule | null } | null {
  const amt = toFiniteNumber(amount) ?? 0;
  for (const rule of config.rules) {
    const aboveMin = amt >= rule.minAmount;
    const belowMax = rule.maxAmount === null || amt < rule.maxAmount;
    if (aboveMin && belowMax) return { source: rule.source, rule };
  }
  if (config.fallback) return { source: config.fallback, rule: null };
  return null;
}

// One-stop resolver the customer-display will call: picks the source for `amount`
// and turns it into something renderable. For a PromptPay source it builds the
// dynamic payload (amount embedded); for an image source it passes the data URL
// through. Returns null when no QR is configured for this amount.
export function resolveQrForAmount(config: QrRoutingConfig, amount: number): ResolvedQr | null {
  const picked = selectQrSource(config, amount);
  if (!picked) return null;
  const { source, rule } = picked;
  const label = rule?.label;
  if (source.type === "promptpay") {
    const amt = toFiniteNumber(amount) ?? 0;
    const payload = buildPromptPayPayload(source.promptpayId, amt > 0 ? amt : undefined);
    return { kind: "payload", payload, promptpayId: source.promptpayId, amount: amt, ...(label ? { label } : {}) };
  }
  return { kind: "image", dataUrl: source.dataUrl, ...(label ? { label } : {}) };
}
