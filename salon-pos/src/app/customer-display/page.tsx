"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  CUSTOMER_DISPLAY_KEY,
  readCustomerDisplay,
  type DisplayState,
} from "@/lib/customer-display";
import { buildPromptPayPayload } from "@/lib/promptpay";

/* ─────────────────────────── branding ─────────────────────────── */
type FooterImage = { type: string; dataUrl?: string };
type DisplayBranding = {
  shopName: string;
  logoDataUrl: string | null;
  promptpayId: string | null;
  promoImages: string[];
};

const fmtBaht = (n: number) =>
  n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* ─────────────────────────── main ─────────────────────────── */
export default function CustomerDisplayPage() {
  const [state, setState] = useState<DisplayState | null>(null);
  const [branding, setBranding] = useState<DisplayBranding | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());

  /* live state from the cashier window (localStorage + storage events) */
  useEffect(() => {
    setState(readCustomerDisplay());
    const onStorage = (e: StorageEvent) => {
      if (e.key === CUSTOMER_DISPLAY_KEY) setState(readCustomerDisplay());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  /* branding — fetched here so the window is self-contained; refreshes on save */
  useEffect(() => {
    const load = () => {
      fetch("/api/branding")
        .then(r => (r.ok ? r.json() : null))
        .then((b: { shopName?: string; logoDataUrl?: string | null; promptpayId?: string | null; footerBlocks?: FooterImage[] } | null) => {
          if (!b) return;
          setBranding({
            shopName: b.shopName ?? "",
            logoDataUrl: b.logoDataUrl ?? null,
            promptpayId: b.promptpayId ?? null,
            promoImages: (b.footerBlocks ?? [])
              .filter(blk => blk.type === "image" && typeof blk.dataUrl === "string")
              .map(blk => blk.dataUrl as string),
          });
        })
        .catch(() => {});
    };
    load();
    window.addEventListener("branding-updated", load);
    return () => window.removeEventListener("branding-updated", load);
  }, []);

  /* clock for the welcome screen */
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  /* generate the PromptPay QR whenever a payment with an amount is shown */
  useEffect(() => {
    if (state?.kind !== "payment" || !branding?.promptpayId || !(state.amountDue > 0)) {
      setQr(null);
      return;
    }
    let cancelled = false;
    const payload = buildPromptPayPayload(branding.promptpayId, state.amountDue);
    import("qrcode").then((QRCodeModule) => {
      if (cancelled) return;
      const QRCode = QRCodeModule.default || QRCodeModule;
      QRCode.toDataURL(payload, { errorCorrectionLevel: "M", margin: 1, width: 520 })
        .then(url => { if (!cancelled) setQr(url); })
        .catch(() => { if (!cancelled) setQr(null); });
    });
    return () => { cancelled = true; };
  }, [state, branding?.promptpayId]);

  const kind = state?.kind ?? "idle";

  return (
    <div
      style={{
        position: "fixed", inset: 0, overflow: "hidden",
        background: "var(--beige)", color: "var(--text-dark)",
        display: "flex", flexDirection: "column",
        fontFamily: '"Sarabun", sans-serif',
      }}
    >
      <FullscreenToggle />
      <BrandBar branding={branding} clock={kind === "idle"} now={now} />

      <div style={{ flex: 1, minHeight: 0, display: "flex" }}>
        {kind === "idle" && <IdleView branding={branding} />}
        {kind === "cart" && state?.kind === "cart" && <CartView state={state} />}
        {kind === "payment" && state?.kind === "payment" && (
          <PaymentView state={state} qr={qr} hasPromptPay={!!branding?.promptpayId} promoImages={branding?.promoImages ?? []} />
        )}
        {kind === "thankyou" && state?.kind === "thankyou" && <ThankYouView state={state} />}
      </div>
    </div>
  );
}

/* ─────────────────────────── brand bar ─────────────────────────── */
function BrandBar({ branding, clock, now }: { branding: DisplayBranding | null; clock: boolean; now: Date }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: "1.25rem",
      padding: "1.1rem 2rem", background: "var(--olive)", color: "white",
      boxShadow: "0 2px 12px rgba(0,0,0,0.12)",
    }}>
      {branding?.logoDataUrl && (
        <div style={{
          width: 64, height: 64, borderRadius: 14, background: "white",
          display: "flex", alignItems: "center", justifyContent: "center",
          overflow: "hidden", flexShrink: 0,
        }}>
          <img src={branding.logoDataUrl} alt="" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
        </div>
      )}
      <div style={{ fontSize: "1.9rem", fontWeight: 700, flex: 1, lineHeight: 1.1 }}>
        {branding?.shopName || "ยินดีต้อนรับ"}
      </div>
      {clock && (
        <div style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
          <div style={{ fontSize: "2rem", fontWeight: 700, lineHeight: 1 }}>
            {now.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}
          </div>
          <div style={{ fontSize: "0.95rem", opacity: 0.85 }}>
            {now.toLocaleDateString("th-TH", { weekday: "long", day: "numeric", month: "long" })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────── idle / welcome ─────────────────────────── */
function IdleView({ branding }: { branding: DisplayBranding | null }) {
  const promos = branding?.promoImages ?? [];
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (promos.length < 2) return;
    const t = setInterval(() => setIdx(i => (i + 1) % promos.length), 5000);
    return () => clearInterval(t);
  }, [promos.length]);

  return (
    <div style={{
      flex: 1, display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", gap: "2rem", padding: "2rem",
    }}>
      {branding?.logoDataUrl ? (
        <img src={branding.logoDataUrl} alt="" style={{ maxWidth: 320, maxHeight: 240, objectFit: "contain" }} />
      ) : (
        <div style={{ fontSize: "7rem" }}>✂️</div>
      )}
      <div style={{ fontSize: "3rem", fontWeight: 700, color: "var(--olive)" }}>ยินดีต้อนรับค่ะ 🙏</div>
      <div style={{ fontSize: "1.4rem", color: "#777" }}>ขอบคุณที่ใช้บริการกับเรา</div>

      {promos.length > 0 && (
        <div style={{
          marginTop: "0.5rem", width: "min(440px, 70vw)", height: 260,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "white", borderRadius: 18, padding: "1rem",
          boxShadow: "0 8px 28px rgba(0,0,0,0.10)",
        }}>
          <img src={promos[idx]} alt="" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────── cart (order being built) ─────────────────────────── */
function CartView({ state }: { state: Extract<DisplayState, { kind: "cart" }> }) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "2rem 2.5rem", minHeight: 0 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "1rem" }}>
        <div style={{ fontSize: "2rem", fontWeight: 700, color: "var(--olive)" }}>
          {state.heading || "รายการของคุณ"}
        </div>
        {state.customerName && (
          <div style={{ fontSize: "1.3rem", color: "#777" }}>คุณ {state.customerName}</div>
        )}
      </div>

      <LineList lines={state.lines} />

      <div style={{
        marginTop: "auto", display: "flex", alignItems: "center", justifyContent: "space-between",
        borderTop: "3px solid var(--olive)", paddingTop: "1.25rem",
      }}>
        <span style={{ fontSize: "2.2rem", fontWeight: 700 }}>ยอดรวม</span>
        <span style={{ fontSize: "3.4rem", fontWeight: 800, color: "var(--olive)" }}>฿{fmtBaht(state.total)}</span>
      </div>
    </div>
  );
}

/* ─────────────────────────── payment (with QR) ─────────────────────────── */
function PaymentView({ state, qr, hasPromptPay, promoImages }: {
  state: Extract<DisplayState, { kind: "payment" }>;
  qr: string | null;
  hasPromptPay: boolean;
  promoImages: string[];
}) {
  // When PromptPay isn't configured, fall back to a static uploaded QR (e.g. a LINE
  // or bank QR placed in the receipt footer) so something scannable still shows.
  const staticQr = !hasPromptPay ? promoImages[0] : undefined;

  return (
    <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", minHeight: 0 }}>
      {/* left: bill */}
      <div style={{ display: "flex", flexDirection: "column", padding: "2rem 2.5rem", minHeight: 0, borderRight: "1px solid var(--beige-dark)" }}>
        <div style={{ fontSize: "1.8rem", fontWeight: 700, color: "var(--olive)", marginBottom: "1rem" }}>
          สรุปรายการ
          {state.customerName ? <span style={{ fontSize: "1.1rem", color: "#888", fontWeight: 400 }}>  ·  คุณ {state.customerName}</span> : null}
        </div>
        <LineList lines={state.lines} compact />
        <div style={{
          marginTop: "auto", display: "flex", alignItems: "center", justifyContent: "space-between",
          borderTop: "3px solid var(--olive)", paddingTop: "1.1rem",
        }}>
          <span style={{ fontSize: "1.9rem", fontWeight: 700 }}>ยอดสุทธิ</span>
          <span style={{ fontSize: "3rem", fontWeight: 800, color: "var(--olive)" }}>฿{fmtBaht(state.total)}</span>
        </div>
      </div>

      {/* right: QR */}
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        gap: "1.25rem", padding: "2rem", background: "white",
      }}>
        {qr || staticQr ? (
          <>
            <div style={{ fontSize: "1.6rem", fontWeight: 700, color: "var(--olive)" }}>
              สแกนเพื่อชำระเงิน
            </div>
            <div style={{
              padding: "1rem", background: "white", borderRadius: 18,
              border: "1px solid var(--beige-dark)", boxShadow: "0 10px 30px rgba(0,0,0,0.10)",
            }}>
              <img src={(qr ?? staticQr)!} alt="QR ชำระเงิน" style={{ width: "min(420px, 42vw)", height: "auto", display: "block" }} />
            </div>
            {qr && (
              <div style={{
                fontSize: "1.05rem", color: "#1a4ea8", fontWeight: 700, letterSpacing: 0.5,
                display: "flex", alignItems: "center", gap: 8,
              }}>
                <span style={{ background: "#1a4ea8", color: "white", borderRadius: 6, padding: "2px 8px", fontSize: "0.85rem" }}>PromptPay</span>
                ยอด ฿{fmtBaht(state.amountDue)}
              </div>
            )}
            {state.methodLabel && (
              <div style={{ fontSize: "1rem", color: "#999" }}>ช่องทาง: {state.methodLabel}</div>
            )}
          </>
        ) : (
          <div style={{ textAlign: "center", color: "#888" }}>
            <div style={{ fontSize: "4rem", marginBottom: "1rem" }}>💳</div>
            <div style={{ fontSize: "1.6rem", fontWeight: 700, color: "var(--olive)", marginBottom: 6 }}>กรุณาชำระเงินที่เคาน์เตอร์</div>
            <div style={{ fontSize: "2.4rem", fontWeight: 800, color: "var(--text-dark)" }}>฿{fmtBaht(state.amountDue)}</div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────── thank you ─────────────────────────── */
function ThankYouView({ state }: { state: Extract<DisplayState, { kind: "thankyou" }> }) {
  return (
    <div style={{
      flex: 1, display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", gap: "1.5rem", padding: "2rem",
    }}>
      <div style={{ fontSize: "6rem" }}>✅</div>
      <div style={{ fontSize: "3.4rem", fontWeight: 800, color: "var(--olive)" }}>ขอบคุณค่ะ 🙏</div>
      <div style={{ fontSize: "1.5rem", color: "#777" }}>ชำระเงินเรียบร้อยแล้ว แล้วพบกันใหม่นะคะ</div>
      {typeof state.total === "number" && (
        <div style={{ fontSize: "1.4rem", color: "#555", marginTop: "0.5rem" }}>
          ยอดชำระ <strong style={{ color: "var(--olive)" }}>฿{fmtBaht(state.total)}</strong>
        </div>
      )}
      {typeof state.change === "number" && state.change > 0 && (
        <div style={{ fontSize: "1.6rem", fontWeight: 700 }}>
          เงินทอน <span style={{ color: "var(--success-green)" }}>฿{fmtBaht(state.change)}</span>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────── shared: line item list ─────────────────────────── */
function LineList({ lines, compact }: { lines: { name: string; qty: number; lineTotal: number }[]; compact?: boolean }) {
  if (lines.length === 0) {
    return <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#bbb", fontSize: "1.4rem" }}>—</div>;
  }
  const fontSize = compact ? "1.25rem" : "1.55rem";
  return (
    <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: compact ? "0.4rem" : "0.65rem" }}>
      {lines.map((l, i) => (
        <div key={i} style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          gap: "1rem", padding: compact ? "0.4rem 0" : "0.55rem 0",
          borderBottom: "1px dashed var(--beige-dark)", fontSize,
        }}>
          <span style={{ flex: 1, minWidth: 0 }}>
            {l.name}
            {l.qty > 1 && <span style={{ color: "#999" }}> × {l.qty}</span>}
          </span>
          <span style={{ fontWeight: 700, whiteSpace: "nowrap" }}>฿{fmtBaht(l.lineTotal)}</span>
        </div>
      ))}
    </div>
  );
}

/* ─────────────────────────── fullscreen toggle ─────────────────────────── */
// Small, auto-fading control so staff can drop the browser chrome on the 2nd screen.
function FullscreenToggle() {
  const [fs, setFs] = useState(false);
  const [visible, setVisible] = useState(true);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const onChange = () => setFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  useEffect(() => {
    const wake = () => {
      setVisible(true);
      if (hideTimer.current) clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(() => setVisible(false), 3000);
    };
    wake();
    window.addEventListener("mousemove", wake);
    return () => {
      window.removeEventListener("mousemove", wake);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, []);

  async function toggle() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      // user gesture / permission issues — ignore
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      title={fs ? "ออกจากเต็มจอ" : "แสดงเต็มจอ"}
      style={{
        position: "fixed", top: 12, right: 12, zIndex: 100,
        width: 40, height: 40, borderRadius: 10, cursor: "pointer",
        border: "none", background: "rgba(0,0,0,0.35)", color: "white", fontSize: "1.1rem",
        opacity: visible ? 1 : 0, transition: "opacity 0.4s ease",
      }}
    >
      {fs ? "🗗" : "⛶"}
    </button>
  );
}
