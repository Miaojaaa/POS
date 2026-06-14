// PromptPay QR payload builder (Thai EMVCo standard, Bank of Thailand spec).
//
// Produces the raw string that a banking app reads to pre-fill a PromptPay
// transfer. When an amount is supplied the QR is a one-time "dynamic" code with
// the amount embedded, so the customer only has to confirm — no manual typing.
//
// Pure + dependency-free so it can run in the browser (the customer-display page
// renders the QR client-side) as well as on the server.

export type PromptPayTargetKind = "phone" | "nationalId" | "eWallet";

// Build a single EMVCo TLV (Tag-Length-Value) field. Length is the value's
// character count, zero-padded to 2 digits.
function tlv(id: string, value: string): string {
  return `${id}${value.length.toString().padStart(2, "0")}${value}`;
}

// CRC-16/CCITT-FALSE (poly 0x1021, init 0xFFFF) over the payload up to and
// including the "6304" CRC tag. This is the checksum every PromptPay QR ends with.
function crc16(data: string): number {
  let crc = 0xffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc;
}

// Normalise a raw PromptPay id (phone / national-id / tax-id / e-wallet) into the
// proxy value + sub-tag the spec expects:
//   tag 01 = mobile  → "0066" + national number, left-padded to 13 digits
//   tag 02 = national id / tax id (13 digits)
//   tag 03 = e-wallet id (15 digits)
export function formatPromptPayTarget(raw: string): { tag: "01" | "02" | "03"; value: string; kind: PromptPayTargetKind } {
  const id = raw.replace(/\D/g, "");
  if (id.length >= 15) return { tag: "03", value: id.slice(0, 15), kind: "eWallet" };
  if (id.length >= 13) return { tag: "02", value: id.slice(0, 13), kind: "nationalId" };
  // Phone: drop the leading 0, prefix the 66 country code, left-pad to 13.
  const phone = id.replace(/^0/, "66");
  return { tag: "01", value: `0000000000000${phone}`.slice(-13), kind: "phone" };
}

// Returns true when `raw` (after stripping non-digits) is a plausible PromptPay id:
// a 10-digit phone, a 13-digit national/tax id, or a 15-digit e-wallet id.
export function isValidPromptPayId(raw: string): boolean {
  const len = raw.replace(/\D/g, "").length;
  return len === 10 || len === 13 || len === 15;
}

export function buildPromptPayPayload(rawId: string, amount?: number): string {
  const { tag, value } = formatPromptPayTarget(rawId);
  const merchantAccount = tlv("00", "A000000677010111") + tlv(tag, value);
  const hasAmount = typeof amount === "number" && Number.isFinite(amount) && amount > 0;

  // Field order mirrors the canonical Thai promptpay-qr spec (country before
  // currency before amount) so the output is byte-identical to what every bank
  // app is tested against.
  const payload =
    tlv("00", "01") +                       // Payload Format Indicator
    tlv("01", hasAmount ? "12" : "11") +     // 12 = dynamic/one-time, 11 = static
    tlv("29", merchantAccount) +             // Merchant Account Info (PromptPay)
    tlv("58", "TH") +                        // Country
    tlv("53", "764") +                       // Currency = THB
    (hasAmount ? tlv("54", amount!.toFixed(2)) : "") +
    "6304";                                  // CRC tag + length, value appended below

  const crc = crc16(payload).toString(16).toUpperCase().padStart(4, "0");
  return payload + crc;
}
