// Barcode validation + normalization for retail scanning.
//
// What "valid" means here: all-digit string, length in {8, 12, 13, 14}, and
// the Mod-10 check digit verifies. Any other input is silently ignored — that
// covers human typing being misread as a scan, partial reads (which a working
// HID scanner should never emit, but cheap ones can), and warehouse Code 128 /
// Code 39 codes (which we don't support in retail right now).
//
// Formats accepted:
//   • EAN-13 (13 digits) — most common, e.g. standard shampoo bottles
//   • UPC-A  (12 digits) — North American imports
//   • EAN-8  (8 digits)  — small items where 13 digits won't fit
//   • ITF-14 (14 digits) — carton/case codes; rare in salon retail but harmless
//
// Storage form: we keep whatever the scanner emits (no auto-padding) so the
// admin form's "what I typed = what I see" mental model stays intact. If you
// scan a UPC-A 12-digit and an EAN-13 with a leading 0 differs by one digit,
// they're treated as distinct codes. That's a tradeoff — we get simplicity in
// exchange for letting the human handle the rare collision.

const VALID_LENGTHS = new Set([8, 12, 13, 14]);

export type BarcodeFormat = "EAN-8" | "UPC-A" | "EAN-13" | "ITF-14";

export function detectFormat(code: string): BarcodeFormat | null {
  if (!/^\d+$/.test(code)) return null;
  switch (code.length) {
    case 8:  return "EAN-8";
    case 12: return "UPC-A";
    case 13: return "EAN-13";
    case 14: return "ITF-14";
    default: return null;
  }
}

/**
 * Mod-10 checksum used by EAN/UPC/ITF. Same algorithm for all lengths:
 * starting from the digit immediately left of the check digit, weights
 * alternate 3, 1, 3, 1, ... toward the leftmost digit. Sum, mod 10, then
 * 10 minus that mod 10 must equal the trailing check digit.
 */
export function verifyChecksum(code: string): boolean {
  if (!/^\d+$/.test(code)) return false;
  const len = code.length;
  if (!VALID_LENGTHS.has(len)) return false;

  const digits = code.split("").map(Number);
  const check = digits[len - 1];
  let sum = 0;
  for (let i = 0; i < len - 1; i++) {
    // Position from right of the LAST data digit (1-indexed):
    //   i = 0 (leftmost data digit) → position = len - 1
    //   i = len - 2 (just before check) → position = 1
    const positionFromRight = len - 1 - i;
    const weight = positionFromRight % 2 === 1 ? 3 : 1;
    sum += digits[i] * weight;
  }
  const expected = (10 - (sum % 10)) % 10;
  return expected === check;
}

/** Single gate the scanner hook uses to decide whether to dispatch a code. */
export function isValidBarcode(code: string): boolean {
  return detectFormat(code) !== null && verifyChecksum(code);
}
