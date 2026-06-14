// Shared protocol for the dual-screen customer display.
//
// The cashier-facing POS pages (`/pos/new`, `/pos/queue`) write the current cart /
// payment state into localStorage; the customer-facing window (`/customer-display`,
// opened on the second monitor) reads it and re-renders. localStorage is used
// instead of BroadcastChannel because it persists — a window opened *after* an
// order is already on screen still picks up the current state on mount, and every
// write fires a cross-window `storage` event for live updates.
//
// Client-only module: every function guards `typeof window` so it is safe to import
// from a "use client" component without breaking SSR. Do not import server code here.

export const CUSTOMER_DISPLAY_PATH = "/customer-display";
export const CUSTOMER_DISPLAY_KEY = "salon-customer-display";
const CUSTOMER_DISPLAY_WINDOW = "salonCustomerDisplay";

export type DisplayLine = { name: string; qty: number; lineTotal: number };

export type DisplayState =
  | { kind: "idle"; ts: number }
  | { kind: "cart"; ts: number; heading?: string; customerName?: string; lines: DisplayLine[]; total: number }
  | { kind: "payment"; ts: number; customerName?: string; lines: DisplayLine[]; total: number; amountDue: number; methodLabel?: string }
  | { kind: "thankyou"; ts: number; total?: number; change?: number };

// Everything except the auto-stamped `ts`. Callers describe *what* to show; the
// timestamp guarantees each write differs so the `storage` event always fires.
export type DisplayInput =
  | { kind: "idle" }
  | { kind: "cart"; heading?: string; customerName?: string; lines: DisplayLine[]; total: number }
  | { kind: "payment"; customerName?: string; lines: DisplayLine[]; total: number; amountDue: number; methodLabel?: string }
  | { kind: "thankyou"; total?: number; change?: number };

export function pushCustomerDisplay(state: DisplayInput): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CUSTOMER_DISPLAY_KEY, JSON.stringify({ ...state, ts: Date.now() }));
  } catch {
    // private-mode / quota errors — the display just keeps its last state
  }
}

export function clearCustomerDisplay(): void {
  pushCustomerDisplay({ kind: "idle" });
}

export function readCustomerDisplay(): DisplayState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CUSTOMER_DISPLAY_KEY);
    return raw ? (JSON.parse(raw) as DisplayState) : null;
  } catch {
    return null;
  }
}

// Open (or focus) the customer window. When the browser supports the Multi-Screen
// Window Placement API and a second monitor is present, the window is opened
// directly on that monitor filling its work area — no manual dragging. Falls back
// to a normal popup when the API is unavailable, permission is denied, or there is
// only one screen. Must be called from a user gesture (e.g. a button click) so the
// permission prompt and popup are allowed.
export async function openCustomerDisplay(): Promise<{ placed: boolean }> {
  if (typeof window === "undefined") return { placed: false };
  const url = CUSTOMER_DISPLAY_PATH;

  type ScreenInfo = { isPrimary: boolean; availLeft: number; availTop: number; availWidth: number; availHeight: number };
  const w = window as unknown as { getScreenDetails?: () => Promise<{ screens: ScreenInfo[]; currentScreen: ScreenInfo }> };

  try {
    if (typeof w.getScreenDetails === "function") {
      const details = await w.getScreenDetails();
      const screens = details.screens ?? [];
      const target = screens.find(s => !s.isPrimary);
      if (target && screens.length > 1) {
        const features = `left=${target.availLeft},top=${target.availTop},width=${target.availWidth},height=${target.availHeight},menubar=no,toolbar=no,location=no,status=no`;
        const win = window.open(url, CUSTOMER_DISPLAY_WINDOW, features);
        if (win) {
          try {
            win.moveTo(target.availLeft, target.availTop);
            win.resizeTo(target.availWidth, target.availHeight);
          } catch {
            // some browsers block move/resize on cross-screen windows — position
            // from the open() features already did the bulk of the work
          }
          return { placed: true };
        }
      }
    }
  } catch {
    // unsupported or permission denied — fall through to a plain popup
  }

  window.open(url, CUSTOMER_DISPLAY_WINDOW, "width=1280,height=800");
  return { placed: false };
}
