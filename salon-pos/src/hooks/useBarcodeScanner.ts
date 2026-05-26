"use client";

import { useEffect } from "react";
import { isValidBarcode } from "@/lib/barcode";

// ───────────────────────────────────────────────────────────────────────
// Global barcode scanner hook.
//
// HID barcode scanners act like keyboards — they "type" the barcode digits
// then hit Enter. To tell scanner input apart from a human typing into a
// search box, we keep a small buffer of recent digit keypresses and check
// the timing: a scanner emits chars within ~10-30ms of each other, humans
// type at >80ms. When Enter arrives, we hand the buffer to whichever page
// most recently registered a handler — IF the buffer parses as a valid
// EAN/UPC code (length 8/12/13/14 + checksum). Otherwise we silently drop
// it. No toast, no banner — the cost of a false positive (annoying the
// human) is higher than a missed scan (they'll just scan again).
// ───────────────────────────────────────────────────────────────────────

type ScanCallback = (code: string) => void;

// Stack of registered handlers; the most recently mounted one wins. We use
// module-level state so the single document listener can dispatch without
// each page having to wire its own.
const handlers: ScanCallback[] = [];

let listenerInstalled = false;
let buffer = "";
let lastKeyTime = 0;

// If the gap between two characters exceeds this, the buffer is presumed to
// be human typing and is reset before the new char is appended. 200ms is
// well above any HID scanner's inter-character delay (most are 5-30ms) and
// well below comfortable human typing speed (>100ms/char for digits).
const SCAN_RESET_MS = 200;

function installListener() {
  if (listenerInstalled || typeof window === "undefined") return;
  listenerInstalled = true;

  window.addEventListener("keydown", (e) => {
    const now = Date.now();
    const dt = now - lastKeyTime;
    lastKeyTime = now;

    if (e.key === "Enter") {
      const code = buffer;
      buffer = "";
      if (!code) return;
      if (!isValidBarcode(code)) return; // silently drop — see top comment

      const top = handlers[handlers.length - 1];
      if (top) {
        // Stop Enter from also submitting whatever form might be focused —
        // the scanner is the source of truth for this keystroke.
        e.preventDefault();
        top(code);
      }
      return;
    }

    // Reset buffer if the gap looks like human typing
    if (dt > SCAN_RESET_MS) buffer = "";

    // Only accumulate digit chars — barcodes are numeric. Letters / symbols
    // mean a human is typing, so we wipe the buffer to avoid mixing them.
    if (e.key.length === 1) {
      if (/\d/.test(e.key)) {
        buffer += e.key;
        // Cap buffer growth — anything past 14 digits isn't a supported format
        if (buffer.length > 16) buffer = buffer.slice(-16);
      } else {
        buffer = "";
      }
    }
  }, true); // capture phase — fires before the focused element sees the key
}

/**
 * Register a barcode-scan handler for as long as the component is mounted.
 * Pass `null` to disable on this page. If multiple components register,
 * the most recently mounted wins (last-in, first-served).
 */
export function useBarcodeScanner(handler: ScanCallback | null) {
  useEffect(() => {
    if (!handler) return;
    installListener();
    handlers.push(handler);
    return () => {
      const idx = handlers.lastIndexOf(handler);
      if (idx >= 0) handlers.splice(idx, 1);
    };
  }, [handler]);
}
