"use client";

import { useEffect, useState, useMemo } from "react";
import { useBranch } from "@/context/BranchContext";
import { buildReceiptHtml, type ReceiptBranding, type ReceiptData as PrintableReceipt } from "@/lib/receipt";
import { DEFAULT_RECEIPT_FORMATS, buildReceiptNumber, type ReceiptFormats, type VatMode, type FooterBlock } from "@/lib/system-config";

type Branch = { id: string; name: string };
type OrderRow = {
  id: string;
  receiptNumber?: number | null;
  receiptType?: string | null;
  taxInvoiceNumber?: string | null;
  taxInvoiceIssuedAt?: string | null;
  taxInvoiceCustomerName?: string | null;
  taxInvoiceAddress?: string | null;
  taxInvoiceTaxId?: string | null;
  customerName: string;
  customerPhone?: string;
  status: string;
  subtotal: number;
  retailSubtotal: number;
  serviceCharge: number;
  vat: number;
  roundingAdjustment: number;
  total: number;
  discountAmount: number;
  createdAt: string;
  completedAt?: string | null;
  branch?: { name: string };
  branchId: string;
  technician: { name: string };
  assistants?: { user: { id: string; name: string } }[];
  items: { id: string; price: number; service: { name: string; category?: { name: string } | null } }[];
  chemicals: { product: { name: string }; amountG: number; totalCost: number }[];
  retailItems?: { id: string; quantity: number; price: number; retailProduct: { name: string } }[];
  payments: { method: string; amount: number }[];
};

// Group categories into broad service types so the history filter pills stay simple.
// NAIL is matched first so "สปามือ / เท้า" lands under NAIL (not SPA).
type ServiceGroup = "HAIR" | "NAIL" | "SPA" | "OTHER";
function classifyCategory(name: string | undefined | null): ServiceGroup {
  if (!name) return "OTHER";
  if (/เล็บ|มือ|เท้า|ทาสี|งานต่อ|งานถอด|งานเทคนิค/.test(name)) return "NAIL";
  if (/ผม|ตัด|สระ|ยืด|ดัด|ทรีทเมนท์/.test(name)) return "HAIR";
  if (/สปา/.test(name)) return "SPA";
  return "OTHER";
}
function orderGroups(o: { items: { service: { category?: { name: string } | null } }[] }): Set<ServiceGroup> {
  return new Set(o.items.map(it => classifyCategory(it.service.category?.name)));
}

const STATUS_LABEL: Record<string, string> = { PAID: "ชำระแล้ว", CANCELLED: "ยกเลิก" };
const STATUS_BG: Record<string, string> = { PAID: "#D4EDDA", CANCELLED: "#F8D7DA" };
const STATUS_COLOR: Record<string, string> = { PAID: "#155724", CANCELLED: "#721c24" };
const METHOD_LABEL: Record<string, string> = { CASH: "เงินสด", TRANSFER: "โอน", CREDIT_CARD: "บัตร", WALLET: "Wallet" };

// Orders don't carry a `vatMode` column, so we infer the mode at reprint time by
// checking whether `total` already accounts for VAT or not. Returns null when the
// numbers are too ambiguous (e.g. vat=0) and the caller falls back to current setting.
function detectVatMode(o: { total: number; subtotal: number; retailSubtotal: number; discountAmount: number; serviceCharge: number; vat: number; roundingAdjustment: number }): VatMode | null {
  if (!o.vat) return null;
  const base = o.subtotal + o.retailSubtotal - o.discountAmount;
  const exclusiveTotal = base + o.serviceCharge + o.vat + o.roundingAdjustment;
  const inclusiveTotal = base + o.serviceCharge + o.roundingAdjustment;
  const distExcl = Math.abs(o.total - exclusiveTotal);
  const distIncl = Math.abs(o.total - inclusiveTotal);
  return distIncl < distExcl ? "INCLUSIVE" : "EXCLUSIVE";
}

function formatReceiptNo(seq: number, type: string | null | undefined, completedAt: string | Date, formats: ReceiptFormats) {
  if (!type) return null;
  const d = new Date(completedAt);
  const cfg = type === "FULL" ? formats.full : formats.short;
  return buildReceiptNumber(seq, d, cfg);
}

export default function HistoryPage() {
  const { branches, selectedBranchId, setSelectedBranchId } = useBranch();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "PAID" | "CANCELLED">("ALL");
  const [formats, setFormats] = useState<ReceiptFormats>(DEFAULT_RECEIPT_FORMATS);
  const [vatMode, setVatMode] = useState<VatMode>("EXCLUSIVE");

  useEffect(() => {
    const refresh = () => {
      fetch("/api/system-config")
        .then(r => r.ok ? r.json() : null)
        .then((d: { receiptFormat?: ReceiptFormats; finance?: { vatMode?: VatMode } } | null) => {
          if (d?.receiptFormat) setFormats(d.receiptFormat);
          if (d?.finance?.vatMode) setVatMode(d.finance.vatMode);
        })
        .catch(() => {});
    };
    refresh();
    window.addEventListener("system-config-updated", refresh);
    return () => window.removeEventListener("system-config-updated", refresh);
  }, []);
  const [groupFilter, setGroupFilter] = useState<"ALL" | ServiceGroup>("ALL");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [selected, setSelected] = useState<OrderRow | null>(null);

  /* reprint flow: pick mode → enter manager PIN → (if FULL) enter customer info → print */
  const [reprintMode, setReprintMode] = useState<"SHORT" | "FULL" | null>(null);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [pinVerified, setPinVerified] = useState(false);
  const [fullCustomerName, setFullCustomerName] = useState("");
  const [fullCustomerAddress, setFullCustomerAddress] = useState("");
  const [fullCustomerTaxId, setFullCustomerTaxId] = useState("");
  const [reprintError, setReprintError] = useState("");

  useEffect(() => {
    setLoading(true);
    const url = selectedBranchId === "all" 
      ? "/api/orders?status=PAID,CANCELLED"
      : `/api/orders?status=PAID,CANCELLED&branchId=${selectedBranchId}`;
    fetch(url)
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setOrders(data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selectedBranchId]);

  const filtered = useMemo(() => {
    return orders.filter(o => {
      if (statusFilter !== "ALL" && o.status !== statusFilter) return false;
      if (groupFilter !== "ALL" && !orderGroups(o).has(groupFilter)) return false;
      if (search) {
        const q = search.toLowerCase();
        const hit = o.customerName.toLowerCase().includes(q)
          || (o.customerPhone ?? "").includes(search);
        if (!hit) return false;
      }
      const refDate = o.completedAt || o.createdAt;
      if (fromDate && new Date(refDate) < new Date(fromDate)) return false;
      if (toDate) {
        const end = new Date(toDate);
        end.setDate(end.getDate() + 1);
        if (new Date(refDate) >= end) return false;
      }
      return true;
    });
  }, [orders, search, statusFilter, groupFilter, fromDate, toDate]);

  const totalRevenue = filtered.filter(o => o.status === "PAID").reduce((s, o) => s + o.total, 0);

  function startReprint(mode: "SHORT" | "FULL") {
    setReprintMode(mode);
    setPin("");
    setPinError("");
    setPinVerified(false);
    setReprintError("");
    // If FULL was already issued, pre-fill from the locked snapshot — reprints must match the original
    setFullCustomerName(selected?.taxInvoiceCustomerName ?? selected?.customerName ?? "");
    setFullCustomerAddress(selected?.taxInvoiceAddress ?? "");
    setFullCustomerTaxId(selected?.taxInvoiceTaxId ?? "");
  }

  function cancelReprint() {
    setReprintMode(null);
    setPin("");
    setPinError("");
    setPinVerified(false);
    setReprintError("");
  }

  async function verifyManagerPin() {
    const res = await fetch("/api/verify-pin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "MANAGER", pin }),
    });
    const data = await res.json();
    if (data.ok) {
      setPinVerified(true);
      setPinError("");
    } else {
      setPinError("PIN ไม่ถูกต้อง (ต้องเป็น Manager หรือ Owner)");
    }
  }

  async function doReprint() {
    if (!selected || !reprintMode) return;
    // If FULL was already issued, the snapshot in DB is authoritative — reprint must match it byte-for-byte
    const lockedSnapshot = reprintMode === "FULL" && selected.taxInvoiceNumber;
    const invoiceCustomerName = lockedSnapshot
      ? (selected.taxInvoiceCustomerName ?? selected.customerName)
      : fullCustomerName.trim();
    const invoiceCustomerAddress = lockedSnapshot
      ? (selected.taxInvoiceAddress ?? "")
      : fullCustomerAddress.trim();
    const invoiceCustomerTaxId = lockedSnapshot
      ? (selected.taxInvoiceTaxId ?? "")
      : fullCustomerTaxId.trim();
    if (reprintMode === "FULL" && !lockedSnapshot) {
      if (!invoiceCustomerName) { setReprintError("กรุณากรอกชื่อผู้ซื้อ"); return; }
      if (!invoiceCustomerAddress) { setReprintError("กรุณากรอกที่อยู่ผู้ซื้อ"); return; }
      if (!invoiceCustomerTaxId) { setReprintError("กรุณากรอกเลขผู้เสียภาษี"); return; }
    }
    // Open the print window synchronously so the browser doesn't block it after the await
    const winSize = reprintMode === "FULL" ? "width=900,height=900" : "width=420,height=640";
    const win = window.open("", "_blank", winSize);
    if (!win) { setReprintError("Pop-up ถูกบล็อก — โปรดอนุญาต pop-up แล้วลองอีกครั้ง"); return; }

    // Persist first so the printed copy carries the canonical invoice/receipt number.
    // Branding + system-config (for receipt format) read in parallel — purely cosmetic,
    // so we don't fail the print if either fetch errors.
    const [res, brandingRes, sysCfgRes] = await Promise.all([
      fetch(`/api/orders/${selected.id}/mark-printed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: reprintMode,
          ...(reprintMode === "FULL" && !lockedSnapshot ? {
            customerName: invoiceCustomerName,
            customerAddress: invoiceCustomerAddress,
            customerTaxId: invoiceCustomerTaxId,
          } : {}),
        }),
      }).catch((err) => { console.error("mark-printed fetch failed", err); return null; }),
      fetch("/api/branding").catch(() => null),
      fetch("/api/system-config").catch(() => null),
    ]);
    const brandingData = brandingRes && brandingRes.ok
      ? await brandingRes.json().catch(() => null) as { shopName?: string; logoDataUrl?: string | null; address?: string; taxId?: string; footerBlocks?: FooterBlock[] } | null
      : null;
    const sysCfg = sysCfgRes && sysCfgRes.ok
      ? await sysCfgRes.json().catch(() => null) as { receiptFormat?: ReceiptFormats } | null
      : null;
    const branding: ReceiptBranding | null = brandingData || sysCfg?.receiptFormat
      ? { ...(brandingData ?? {}), receiptFormat: sysCfg?.receiptFormat }
      : null;
    if (!res || !res.ok) {
      const detail = res ? await res.text().catch(() => "(no body)") : "(no response)";
      console.error("mark-printed failed:", res?.status, detail);
      win.close();
      setReprintError(`บันทึกใบเสร็จลงฐานข้อมูลไม่สำเร็จ (${res?.status ?? "network"}) — ${detail}`);
      return;
    }
    const saved = await res.json().catch(() => null);

    const refDate = saved?.completedAt
      ? new Date(saved.completedAt)
      : selected.completedAt
        ? new Date(selected.completedAt)
        : new Date(selected.createdAt);
    const baseTotal = selected.subtotal + selected.retailSubtotal - selected.discountAmount;
    const lineItems = [
      ...selected.items.map(i => ({ name: i.service.name, qty: 1, unitPrice: i.price, total: i.price })),
      ...(selected.retailItems || []).map(ri => ({
        name: ri.retailProduct.name,
        qty: ri.quantity,
        unitPrice: ri.price,
        total: ri.price * ri.quantity,
      })),
    ];
    const totalPaid = selected.payments.reduce((s, p) => s + p.amount, 0);
    const printable: PrintableReceipt = {
      orderId: selected.id,
      customerName: selected.customerName,
      customerPhone: selected.customerPhone,
      technicianName: selected.technician.name,
      items: lineItems,
      subtotal: selected.subtotal + selected.retailSubtotal,
      discountTotal: selected.discountAmount,
      baseTotal,
      serviceCharge: selected.serviceCharge,
      vat: selected.vat,
      roundingAdjustment: selected.roundingAdjustment,
      finalTotal: selected.total,
      change: Math.max(0, totalPaid - selected.total),
      payments: selected.payments,
      paidAt: refDate,
      receiptNumber: saved?.receiptNumber ?? selected.receiptNumber ?? 0,
      taxInvoiceNumber: saved?.taxInvoiceNumber ?? selected.taxInvoiceNumber ?? null,
      // Best-effort: orders don't store the mode they were checked out under, so we
      // detect by comparing total against base+SC+VAT — close-to-base means INCLUSIVE.
      vatMode: detectVatMode(selected) ?? vatMode,
    };
    win.document.write(buildReceiptHtml(printable, reprintMode, {
      customerName: invoiceCustomerName || selected.customerName,
      customerAddress: invoiceCustomerAddress,
      customerTaxId: invoiceCustomerTaxId,
    }, branding ?? undefined));
    win.document.close();
    setTimeout(() => win.print(), 400);

    // Merge server snapshot into local state so reprints + display use the canonical record
    setOrders(prev => prev.map(o => o.id === selected.id ? { ...o, ...(saved ?? {}) } : o));
    setSelected(prev => prev && prev.id === selected.id ? { ...prev, ...(saved ?? {}) } : prev);
    cancelReprint();
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--olive)", margin: 0 }}>📜 ประวัติ Transaction</h1>
        <div style={{ fontSize: "0.875rem", color: "#666" }}>
          รายการที่แสดง: <strong>{filtered.length}</strong> · ยอดรวม PAID: <strong style={{ color: "var(--olive)" }}>฿{totalRevenue.toLocaleString()}</strong>
        </div>
      </div>

      {/* Quick category filter pills */}
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", flexWrap: "wrap" }}>
        {([
          { key: "ALL", label: "ทั้งหมด", emoji: "📋" },
          { key: "HAIR", label: "ผม", emoji: "💇" },
          { key: "NAIL", label: "เล็บ", emoji: "💅" },
          { key: "SPA", label: "สปา", emoji: "🧖" },
          { key: "OTHER", label: "อื่นๆ", emoji: "✨" },
        ] as const).map(g => {
          const active = groupFilter === g.key;
          const count = g.key === "ALL"
            ? orders.length
            : orders.filter(o => orderGroups(o).has(g.key as ServiceGroup)).length;
          return (
            <button
              key={g.key}
              onClick={() => setGroupFilter(g.key)}
              style={{
                padding: "8px 16px",
                borderRadius: 20,
                border: `2px solid ${active ? "var(--olive)" : "var(--beige-dark)"}`,
                background: active ? "var(--olive)" : "white",
                color: active ? "white" : "var(--text-dark, #333)",
                cursor: "pointer",
                fontSize: "0.875rem",
                fontWeight: active ? 700 : 500,
                transition: "all 0.15s",
              }}
            >
              {g.emoji} {g.label} <span style={{ opacity: 0.7, fontSize: "0.8rem" }}>({count})</span>
            </button>
          );
        })}
      </div>

      <div className="card" style={{ marginBottom: "1rem" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr 1fr 1fr", gap: "0.75rem" }}>
          <div>
            <label className="label">ค้นหา (ชื่อ/เบอร์)</label>
            <input className="input" placeholder="ชื่อลูกค้าหรือเบอร์โทร" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div>
            <label className="label">สาขา</label>
            <select className="input" value={selectedBranchId} onChange={e => setSelectedBranchId(e.target.value)}>
              <option value="all">ทุกสาขา</option>
              {branches.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">สถานะ</label>
            <select className="input" value={statusFilter} onChange={e => setStatusFilter(e.target.value as "ALL" | "PAID" | "CANCELLED")}>
              <option value="ALL">ทั้งหมด</option>
              <option value="PAID">ชำระแล้ว</option>
              <option value="CANCELLED">ยกเลิก</option>
            </select>
          </div>
          <div>
            <label className="label">จากวันที่</label>
            <input type="date" className="input" value={fromDate} onChange={e => setFromDate(e.target.value)} />
          </div>
          <div>
            <label className="label">ถึงวันที่</label>
            <input type="date" className="input" value={toDate} onChange={e => setToDate(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="card">
        {loading ? <p>กำลังโหลด...</p> : filtered.length === 0 ? (
          <p style={{ color: "#aaa", textAlign: "center", padding: "2rem" }}>ไม่พบรายการ</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid var(--beige-dark)", color: "#666" }}>
                <th style={{ textAlign: "left", padding: "8px 12px" }}>วันที่</th>
                <th style={{ textAlign: "left", padding: "8px 12px" }}>เลขใบเสร็จ</th>
                <th style={{ textAlign: "left", padding: "8px 12px" }}>ลูกค้า</th>
                <th style={{ textAlign: "left", padding: "8px 12px" }}>ช่าง</th>
                <th style={{ textAlign: "left", padding: "8px 12px" }}>สาขา</th>
                <th style={{ textAlign: "right", padding: "8px 12px" }}>ยอดรวม</th>
                <th style={{ textAlign: "center", padding: "8px 12px" }}>การชำระ</th>
                <th style={{ textAlign: "center", padding: "8px 12px" }}>สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(o => {
                const refDate = o.completedAt || o.createdAt;
                return (
                  <tr key={o.id} onClick={() => setSelected(o)}
                    style={{ borderBottom: "1px solid #f5f5f5", cursor: "pointer" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "var(--beige)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                    <td style={{ padding: "8px 12px" }}>
                      {new Date(refDate).toLocaleDateString("th-TH")}<br />
                      <span style={{ fontSize: "0.75rem", color: "#888" }}>{new Date(refDate).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}</span>
                    </td>
                    <td style={{ padding: "8px 12px", fontFamily: "monospace", fontSize: "0.8rem" }}>
                      {o.taxInvoiceNumber
                        ? o.taxInvoiceNumber
                        : o.receiptNumber && o.completedAt && o.receiptType
                          ? formatReceiptNo(o.receiptNumber, o.receiptType, o.completedAt, formats)
                          : <span style={{ color: "#bbb", fontStyle: "italic" }}>ยังไม่พิมพ์</span>}
                    </td>
                    <td style={{ padding: "8px 12px" }}>
                      <div style={{ fontWeight: 500 }}>{o.customerName}</div>
                      {o.customerPhone && <div style={{ fontSize: "0.75rem", color: "#888" }}>{o.customerPhone}</div>}
                    </td>
                    <td style={{ padding: "8px 12px" }}>{o.technician.name}</td>
                    <td style={{ padding: "8px 12px", color: "#666" }}>{o.branch?.name || o.branchId}</td>
                    <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 600, color: o.status === "CANCELLED" ? "#aaa" : "var(--olive)" }}>
                      {o.status === "CANCELLED" ? <s>฿{o.total.toLocaleString()}</s> : `฿${o.total.toLocaleString()}`}
                    </td>
                    <td style={{ padding: "8px 12px", textAlign: "center", fontSize: "0.8rem", color: "#666" }}>
                      {o.payments.length === 0 ? "-" : o.payments.map(p => METHOD_LABEL[p.method] ?? p.method).join(", ")}
                    </td>
                    <td style={{ padding: "8px 12px", textAlign: "center" }}>
                      <span style={{ fontSize: "0.75rem", padding: "3px 10px", borderRadius: 12, background: STATUS_BG[o.status], color: STATUS_COLOR[o.status] }}>
                        {STATUS_LABEL[o.status] ?? o.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Detail Modal */}
      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal" style={{ maxWidth: 600, width: "95vw", maxHeight: "90vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h3 style={{ margin: 0, color: "var(--olive)" }}>รายละเอียดออร์เดอร์</h3>
              <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", fontSize: "1.4rem", cursor: "pointer", color: "#aaa" }}>×</button>
            </div>

            {selected.taxInvoiceNumber ? (
              <div style={{ background: "#f5f5f5", padding: "0.5rem 0.75rem", borderRadius: 8, marginBottom: "0.75rem", fontFamily: "monospace", fontSize: "0.85rem" }}>
                <strong>เลขใบกำกับภาษีเต็ม:</strong> {selected.taxInvoiceNumber}
                {selected.taxInvoiceIssuedAt && (
                  <div style={{ fontSize: "0.75rem", color: "#888", marginTop: 2 }}>
                    ออกเมื่อ: {new Date(selected.taxInvoiceIssuedAt).toLocaleString("th-TH")}
                  </div>
                )}
              </div>
            ) : selected.receiptNumber && selected.completedAt && selected.receiptType ? (
              <div style={{ background: "#f5f5f5", padding: "0.5rem 0.75rem", borderRadius: 8, marginBottom: "0.75rem", fontFamily: "monospace", fontSize: "0.85rem" }}>
                <strong>เลขใบเสร็จย่อ:</strong>{" "}
                {formatReceiptNo(selected.receiptNumber, selected.receiptType, selected.completedAt, formats)}
              </div>
            ) : null}

            <div style={{ marginBottom: "0.75rem" }}>
              <div><strong>ลูกค้า:</strong> {selected.customerName} {selected.customerPhone && `(${selected.customerPhone})`}</div>
              <div><strong>ช่าง:</strong> {selected.technician.name}</div>
              <div><strong>สาขา:</strong> {selected.branch?.name || selected.branchId}</div>
              <div>
                <strong>ผู้ช่วยช่าง:</strong>{" "}
                {selected.assistants && selected.assistants.length > 0
                  ? selected.assistants.map(a => a.user.name).join(", ")
                  : <span style={{ color: "#aaa" }}>—</span>}
              </div>
              <div><strong>วันที่:</strong> {new Date(selected.completedAt || selected.createdAt).toLocaleString("th-TH")}</div>
              <div><strong>สถานะ:</strong> <span style={{ padding: "2px 10px", borderRadius: 12, background: STATUS_BG[selected.status], color: STATUS_COLOR[selected.status], fontSize: "0.8rem" }}>{STATUS_LABEL[selected.status]}</span></div>
            </div>

            <div className="card" style={{ background: "var(--beige)", marginBottom: "0.75rem" }}>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>💇 บริการ</div>
              {selected.items.map((it, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.875rem" }}>
                  <span>{it.service.name}</span><span>฿{it.price.toLocaleString()}</span>
                </div>
              ))}
            </div>

            {selected.retailItems && selected.retailItems.length > 0 && (
              <div className="card" style={{ background: "var(--beige)", marginBottom: "0.75rem" }}>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>🛍️ สินค้า Retail</div>
                {selected.retailItems.map((r, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.875rem" }}>
                    <span>{r.retailProduct.name} × {r.quantity}</span>
                    <span>฿{(r.price * r.quantity).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}

            {selected.chemicals.length > 0 && (
              <div className="card" style={{ background: "var(--beige)", marginBottom: "0.75rem" }}>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>🧪 เคมี</div>
                {selected.chemicals.map((c, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", color: "#555" }}>
                    <span>{c.product.name} ({c.amountG}ก.)</span>
                    <span>฿{c.totalCost.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="card" style={{ background: "var(--beige)", marginBottom: "0.75rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.875rem" }}>
                <span>Subtotal บริการ</span><span>฿{selected.subtotal.toLocaleString()}</span>
              </div>
              {selected.retailSubtotal > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.875rem" }}>
                  <span>Subtotal Retail</span><span>฿{selected.retailSubtotal.toLocaleString()}</span>
                </div>
              )}
              {selected.discountAmount > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.875rem", color: "#c00" }}>
                  <span>ส่วนลด</span><span>-฿{selected.discountAmount.toLocaleString()}</span>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, color: "var(--olive)", marginTop: 4, borderTop: "1px solid var(--beige-dark)", paddingTop: 4 }}>
                <span>ยอดรวม</span><span>฿{selected.total.toLocaleString()}</span>
              </div>
            </div>

            {selected.payments.length > 0 && (
              <div style={{ fontSize: "0.875rem", color: "#666" }}>
                <strong>การชำระ:</strong> {selected.payments.map(p => `${METHOD_LABEL[p.method] ?? p.method} ฿${p.amount.toLocaleString()}`).join(", ")}
              </div>
            )}

            {selected.status === "PAID" && (
              <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem", paddingTop: "0.75rem", borderTop: "1px solid var(--beige-dark)" }}>
                <button
                  className="btn-secondary"
                  style={{ flex: 1, fontSize: "0.875rem" }}
                  onClick={() => startReprint("SHORT")}
                  disabled={selected.receiptType === "FULL"}
                  title={selected.receiptType === "FULL" ? "ออร์เดอร์นี้ออกใบกำกับเต็มไปแล้ว — ออกใบย่อย้อนหลังไม่ได้" : ""}
                >
                  🖨 พิมพ์ใบเสร็จย่อ
                </button>
                <button
                  className="btn-primary"
                  style={{ flex: 1, fontSize: "0.875rem" }}
                  onClick={() => startReprint("FULL")}
                >
                  📋 ออกใบกำกับภาษีเต็ม
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Reprint flow modal */}
      {reprintMode && selected && (
        <div className="modal-overlay" onClick={cancelReprint}>
          <div className="modal" style={{ maxWidth: 420, width: "95vw" }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h3 style={{ margin: 0, color: "var(--olive)" }}>
                {reprintMode === "FULL" ? "📋 ออกใบกำกับภาษีเต็ม" : "🖨 พิมพ์ใบเสร็จย่อ"}
              </h3>
              <button onClick={cancelReprint} style={{ background: "none", border: "none", fontSize: "1.4rem", cursor: "pointer", color: "#aaa" }}>×</button>
            </div>

            {!pinVerified ? (
              <>
                <p style={{ fontSize: "0.875rem", color: "#666", marginBottom: "0.75rem" }}>
                  กรุณาใส่ Manager PIN เพื่อยืนยันสิทธิ์ในการพิมพ์ใบเสร็จย้อนหลัง
                </p>
                <input
                  type="password"
                  className="input"
                  placeholder="Manager PIN"
                  value={pin}
                  onChange={e => setPin(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && verifyManagerPin()}
                  autoFocus
                  style={{ marginBottom: "0.5rem" }}
                />
                {pinError && <div style={{ color: "var(--alert-red, #c0392b)", fontSize: "0.85rem", marginBottom: "0.5rem" }}>{pinError}</div>}
                <button className="btn-primary" style={{ width: "100%" }} onClick={verifyManagerPin}>ยืนยัน PIN</button>
              </>
            ) : reprintMode === "FULL" ? (
              <>
                {selected.taxInvoiceNumber ? (
                  <div style={{ background: "#fff8e6", border: "1px solid #f5c842", padding: "0.5rem 0.75rem", borderRadius: 8, marginBottom: "0.75rem", fontSize: "0.85rem", color: "#8a6d00" }}>
                    📄 ใบกำกับภาษีนี้ออกไปแล้ว (เลข: <strong>{selected.taxInvoiceNumber}</strong>) — การพิมพ์ครั้งนี้เป็น <strong>สำเนา (COPY)</strong> ข้อมูลผู้ซื้อล็อกตามใบต้นฉบับ
                  </div>
                ) : (
                  <p style={{ fontSize: "0.875rem", color: "#666", marginBottom: "0.75rem" }}>
                    กรอกข้อมูลผู้ซื้อสำหรับใบกำกับภาษีเต็มรูปแบบ
                  </p>
                )}
                <label className="label">ชื่อผู้ซื้อ</label>
                <input className="input" value={fullCustomerName} onChange={e => setFullCustomerName(e.target.value)} disabled={!!selected.taxInvoiceNumber} style={{ marginBottom: "0.5rem" }} />
                <label className="label">ที่อยู่ผู้ซื้อ</label>
                <textarea className="input" rows={3} value={fullCustomerAddress} onChange={e => setFullCustomerAddress(e.target.value)} disabled={!!selected.taxInvoiceNumber} style={{ marginBottom: "0.5rem", resize: "vertical" }} />
                <label className="label">เลขผู้เสียภาษี</label>
                <input className="input" value={fullCustomerTaxId} onChange={e => setFullCustomerTaxId(e.target.value)} disabled={!!selected.taxInvoiceNumber} style={{ marginBottom: "0.5rem" }} />
                {reprintError && <div style={{ color: "var(--alert-red, #c0392b)", fontSize: "0.85rem", marginBottom: "0.5rem" }}>{reprintError}</div>}
                <button className="btn-primary" style={{ width: "100%" }} onClick={doReprint}>
                  {selected.taxInvoiceNumber ? "🖨 พิมพ์สำเนาใบกำกับภาษี" : "🖨 พิมพ์ใบกำกับภาษีเต็ม"}
                </button>
              </>
            ) : (
              <>
                <p style={{ fontSize: "0.875rem", color: "#666", marginBottom: "0.75rem" }}>
                  ยืนยัน PIN เรียบร้อย — กด &quot;พิมพ์&quot; เพื่อออกใบเสร็จย่อย้อนหลัง
                </p>
                {reprintError && <div style={{ color: "var(--alert-red, #c0392b)", fontSize: "0.85rem", marginBottom: "0.5rem" }}>{reprintError}</div>}
                <button className="btn-primary" style={{ width: "100%" }} onClick={doReprint}>🖨 พิมพ์ใบเสร็จย่อ</button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
