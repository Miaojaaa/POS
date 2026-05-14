"use client";

import { useEffect, useState, useMemo } from "react";

type OrderRow = {
  id: string;
  receiptNumber?: number | null;
  customerName: string;
  customerPhone?: string;
  status: string;
  subtotal: number;
  retailSubtotal: number;
  total: number;
  discountAmount: number;
  createdAt: string;
  completedAt?: string | null;
  technician: { name: string };
  assistants?: { user: { id: string; name: string } }[];
  items: { id: string; price: number; service: { name: string } }[];
  chemicals: { product: { name: string }; amountG: number; totalCost: number }[];
  retailItems?: { id: string; quantity: number; price: number; retailProduct: { name: string } }[];
  payments: { method: string; amount: number }[];
};

const STATUS_LABEL: Record<string, string> = { PAID: "ชำระแล้ว", CANCELLED: "ยกเลิก" };
const STATUS_BG: Record<string, string> = { PAID: "#D4EDDA", CANCELLED: "#F8D7DA" };
const STATUS_COLOR: Record<string, string> = { PAID: "#155724", CANCELLED: "#721c24" };
const METHOD_LABEL: Record<string, string> = { CASH: "เงินสด", TRANSFER: "โอน", CREDIT_CARD: "บัตร", WALLET: "Wallet" };

function pad4(n: number) { return String(n).padStart(4, "0"); }
function formatReceiptNo(seq: number, completedAt: string | Date) {
  const d = new Date(completedAt);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = String(d.getFullYear());
  return `LNDS${pad4(seq)}${dd}${mm}${yyyy}`;
}

export default function HistoryPage() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "PAID" | "CANCELLED">("ALL");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [selected, setSelected] = useState<OrderRow | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch("/api/orders?status=PAID,CANCELLED")
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setOrders(data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    return orders.filter(o => {
      if (statusFilter !== "ALL" && o.status !== statusFilter) return false;
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
  }, [orders, search, statusFilter, fromDate, toDate]);

  const totalRevenue = filtered.filter(o => o.status === "PAID").reduce((s, o) => s + o.total, 0);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--olive)", margin: 0 }}>📜 ประวัติ Transaction</h1>
        <div style={{ fontSize: "0.875rem", color: "#666" }}>
          รายการที่แสดง: <strong>{filtered.length}</strong> · ยอดรวม PAID: <strong style={{ color: "var(--olive)" }}>฿{totalRevenue.toLocaleString()}</strong>
        </div>
      </div>

      <div className="card" style={{ marginBottom: "1rem" }}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: "0.75rem" }}>
          <div>
            <label className="label">ค้นหา (ชื่อ/เบอร์)</label>
            <input className="input" placeholder="ชื่อลูกค้าหรือเบอร์โทร" value={search} onChange={e => setSearch(e.target.value)} />
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
                <th style={{ textAlign: "left", padding: "8px 12px" }}>ผู้ช่วยช่าง</th>
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
                      {o.receiptNumber && o.completedAt ? formatReceiptNo(o.receiptNumber, o.completedAt) : "-"}
                    </td>
                    <td style={{ padding: "8px 12px" }}>
                      <div style={{ fontWeight: 500 }}>{o.customerName}</div>
                      {o.customerPhone && <div style={{ fontSize: "0.75rem", color: "#888" }}>{o.customerPhone}</div>}
                    </td>
                    <td style={{ padding: "8px 12px" }}>{o.technician.name}</td>
                    <td style={{ padding: "8px 12px", color: o.assistants && o.assistants.length > 0 ? "#444" : "#bbb", fontSize: "0.85rem" }}>
                      {o.assistants && o.assistants.length > 0 ? o.assistants.map(a => a.user.name).join(", ") : "-"}
                    </td>
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

            {selected.receiptNumber && selected.completedAt && (
              <div style={{ background: "#f5f5f5", padding: "0.5rem 0.75rem", borderRadius: 8, marginBottom: "0.75rem", fontFamily: "monospace", fontSize: "0.85rem" }}>
                <strong>เลขใบเสร็จ:</strong> {formatReceiptNo(selected.receiptNumber, selected.completedAt)}
              </div>
            )}

            <div style={{ marginBottom: "0.75rem" }}>
              <div><strong>ลูกค้า:</strong> {selected.customerName} {selected.customerPhone && `(${selected.customerPhone})`}</div>
              <div><strong>ช่าง:</strong> {selected.technician.name}</div>
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
          </div>
        </div>
      )}
    </div>
  );
}
