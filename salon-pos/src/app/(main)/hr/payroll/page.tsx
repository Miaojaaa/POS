"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type PayrollItem = {
  id: string;
  userId: string;
  baseSalary: number;
  poolCommission: number;
  retailCommission: number;
  totalAmount: number;
  orderCount: number;
  user: { name: string; role: string };
};
type PayrollRun = { id: string; month: number; year: number; status: string; items: PayrollItem[] };

type TxOrder = {
  id: string;
  receiptNumber?: number | null;
  customerName: string;
  total: number;
  completedAt?: string | null;
  createdAt: string;
  technician: { id: string; name: string };
  assistants: { user: { id: string; name: string } }[];
  items: { service: { name: string }; price: number }[];
  payments: { method: string; amount: number }[];
};

function pad4(n: number) { return String(n).padStart(4, "0"); }
function formatReceiptNo(seq: number, completedAt: string | Date) {
  const d = new Date(completedAt);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = String(d.getFullYear());
  return `LNDS${pad4(seq)}${dd}${mm}${yyyy}`;
}

const ROLES: Record<string, string> = { OWNER: "เจ้าของ", MANAGER: "ผู้จัดการ", CASHIER: "แคชเชียร์", TECHNICIAN: "ช่าง", ASSISTANT: "ผู้ช่วย" };
const POSITION_ALLOWANCES: Record<string, number> = {
  OWNER: 15000,
  MANAGER: 8000,
  CASHIER: 2000,
  TECHNICIAN: 3000,
  ASSISTANT: 1500,
};

export default function PayrollPage() {
  const today = new Date();
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [year, setYear] = useState(today.getFullYear());
  const [run, setRun] = useState<PayrollRun | null>(null);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  // confirm flow
  const [showPinModal, setShowPinModal] = useState(false);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // transaction drill-down modal
  const [txUser, setTxUser] = useState<PayrollItem | null>(null);
  const [txOrders, setTxOrders] = useState<TxOrder[]>([]);
  const [txLoading, setTxLoading] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/payroll?month=${month}&year=${year}`);
    const data = await res.json();
    setRun(data);
    setEditing({});
    setLoading(false);
  }

  useEffect(() => { load(); }, [month, year]);

  async function openTx(item: PayrollItem) {
    setTxUser(item);
    setTxOrders([]);
    setTxLoading(true);
    const res = await fetch(`/api/payroll/transactions?userId=${item.userId}&month=${month}&year=${year}`);
    const data = await res.json();
    if (Array.isArray(data)) setTxOrders(data);
    setTxLoading(false);
  }

  async function saveBaseSalary(itemId: string) {
    const val = editing[itemId];
    if (val == null) return;
    const num = Number(val);
    if (isNaN(num) || num < 0) return;
    setSavingId(itemId);
    const res = await fetch(`/api/payroll/items/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ baseSalary: num }),
    });
    if (res.ok) {
      const updated: PayrollItem = await res.json();
      setRun(prev => prev ? {
        ...prev,
        items: prev.items.map(i => i.id === itemId ? updated : i),
      } : prev);
      setEditing(prev => {
        const next = { ...prev };
        delete next[itemId];
        return next;
      });
    }
    setSavingId(null);
  }

  async function confirmPayroll() {
    if (!run) return;
    setPinError("");
    setConfirming(true);
    const res = await fetch("/api/payroll/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ runId: run.id, pin }),
    });
    const data = await res.json();
    if (data.ok) {
      setRun(data.run);
      setShowPinModal(false);
      setPin("");
      setToast(`✓ ยืนยันเงินเดือนแล้ว — บันทึก ฿${data.totalPayroll.toLocaleString()} ในรายจ่ายเรียบร้อย`);
      setTimeout(() => setToast(null), 4000);
    } else {
      setPinError(data.error || "ยืนยันไม่สำเร็จ");
    }
    setConfirming(false);
  }

  const getAllowance = (roleStr: string) => {
    const roles = roleStr.split(",");
    return Math.max(0, ...roles.map(r => POSITION_ALLOWANCES[r] || 0));
  };

  const totalBase = run?.items.reduce((s, i) => s + i.baseSalary, 0) ?? 0;
  const totalAllowances = run?.items.reduce((s, i) => s + getAllowance(i.user.role), 0) ?? 0;
  const totalPayroll = (run?.items.reduce((s, i) => s + i.totalAmount, 0) ?? 0) + totalAllowances;
  const isConfirmed = run?.status === "CONFIRMED";

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", flexWrap: "wrap", gap: "0.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <h1 style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--olive)", margin: 0 }}>💼 เงินเดือน & ค่าคอม</h1>
          {run && (
            <span className="badge" style={{
              background: isConfirmed ? "#D4EDDA" : "#FFF3CD",
              color: isConfirmed ? "#155724" : "#856404",
              fontSize: "0.75rem",
            }}>
              {isConfirmed ? "✓ ยืนยันแล้ว" : "ฉบับร่าง"}
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <select className="input" style={{ width: 120 }} value={month} onChange={e => setMonth(Number(e.target.value))}>
            {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>เดือน {i + 1}</option>)}
          </select>
          <select className="input" style={{ width: 100 }} value={year} onChange={e => setYear(Number(e.target.value))}>
            {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y + 543}</option>)}
          </select>
          <button
            className="btn-primary"
            style={{ background: isConfirmed ? "#6c757d" : undefined }}
            onClick={() => { setPin(""); setPinError(""); setShowPinModal(true); }}
            disabled={!run || (run.items?.length ?? 0) === 0}
          >
            {isConfirmed ? "🔁 ยืนยันใหม่" : "✓ ยืนยันเงินเดือน"}
          </button>
        </div>
      </div>

      {loading ? (
        <div>กำลังโหลด...</div>
      ) : run ? (
        <>
          <div style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem" }}>
            <div className="card" style={{ textAlign: "center", flex: 1 }}>
              <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--olive)" }}>฿{totalPayroll.toLocaleString()}</div>
              <div style={{ color: "#888", fontSize: "0.875rem" }}>ยอดจ่ายรวมทั้งหมด</div>
            </div>
            <div className="card" style={{ textAlign: "center", flex: 1 }}>
              <div style={{ fontSize: "1.5rem", fontWeight: 700 }}>฿{totalBase.toLocaleString()}</div>
              <div style={{ color: "#888", fontSize: "0.875rem" }}>เงินเดือนพื้นฐานรวม</div>
            </div>
            <div className="card" style={{ textAlign: "center", flex: 1 }}>
              <div style={{ fontSize: "1.5rem", fontWeight: 700 }}>฿{totalAllowances.toLocaleString()}</div>
              <div style={{ color: "#888", fontSize: "0.875rem" }}>ค่าตำแหน่งรวม</div>
            </div>
          </div>

          <div style={{ fontSize: "0.8rem", color: "#666", marginBottom: "0.5rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            🔗 ข้อมูลค่าคอม Pool และจำนวนออร์เดอร์ดึงจากออร์เดอร์สถานะ <strong>ชำระแล้ว (PAID)</strong> ในเดือนที่เลือก —
            <Link href="/pos/history" style={{ color: "var(--olive)", textDecoration: "underline" }}>ดูประวัติ Transaction</Link>
            {!isConfirmed && <span style={{ marginLeft: "auto", color: "#888" }}>ตัวเลขอัปเดตอัตโนมัติทุกครั้งที่เปิดหน้านี้</span>}
          </div>

          <div className="card">
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid var(--beige-dark)", color: "#666" }}>
                  <th style={{ textAlign: "left", padding: "8px 12px" }}>พนักงาน</th>
                  <th style={{ textAlign: "center", padding: "8px 12px" }}>ตำแหน่ง</th>
                  <th style={{ textAlign: "center", padding: "8px 12px" }}>ออร์เดอร์</th>
                  <th style={{ textAlign: "right", padding: "8px 12px" }}>เงินเดือนพื้นฐาน</th>
                  <th style={{ textAlign: "right", padding: "8px 12px" }}>ค่าตำแหน่ง</th>
                  <th style={{ textAlign: "right", padding: "8px 12px" }}>ค่าคอม Pool</th>
                  <th style={{ textAlign: "right", padding: "8px 12px" }}>ค่าคอม Retail</th>
                  <th style={{ textAlign: "right", padding: "8px 12px" }}>รวม</th>
                </tr>
              </thead>
              <tbody>
                {run.items.length === 0 ? (
                  <tr><td colSpan={8} style={{ textAlign: "center", padding: "2rem", color: "#aaa" }}>ไม่มีพนักงาน — กรุณาเพิ่มพนักงานก่อน</td></tr>
                ) : run.items.slice().sort((a, b) => b.totalAmount - a.totalAmount).map(item => {
                  const isEditing = editing[item.id] !== undefined;
                  const editVal = editing[item.id];
                  const allowance = getAllowance(item.user.role);
                  const rowTotal = item.totalAmount + allowance;

                  return (
                    <tr key={item.id} style={{ borderBottom: "1px solid #f5f5f5" }}>
                      <td style={{ padding: "8px 12px", fontWeight: 500 }}>{item.user.name}</td>
                      <td style={{ padding: "8px 12px", textAlign: "center", color: "#666" }}>
                        {item.user.role.split(",").map(r => ROLES[r] || r).join(", ")}
                      </td>
                      <td style={{ padding: "8px 12px", textAlign: "center" }}>
                        {item.orderCount > 0 ? (
                          <button
                            onClick={() => openTx(item)}
                            style={{
                              background: "transparent", border: "none", padding: 0,
                              color: "var(--olive)", textDecoration: "underline",
                              cursor: "pointer", fontSize: "0.875rem", fontWeight: 600,
                            }}
                            title="ดูรายการ Transaction"
                          >
                            {item.orderCount}
                          </button>
                        ) : (
                          <span style={{ color: "#aaa" }}>0</span>
                        )}
                      </td>
                      <td style={{ padding: "8px 12px", textAlign: "right" }}>
                        <div style={{ display: "flex", gap: "0.25rem", justifyContent: "flex-end", alignItems: "center" }}>
                          <input
                            type="number"
                            min={0}
                            value={isEditing ? editVal : item.baseSalary || ""}
                            placeholder="0"
                            onChange={e => setEditing(prev => ({ ...prev, [item.id]: e.target.value }))}
                            onKeyDown={e => { if (e.key === "Enter") saveBaseSalary(item.id); }}
                            style={{
                              width: 110,
                              padding: "4px 8px",
                              border: "1px solid var(--beige-dark)",
                              borderRadius: 6,
                              textAlign: "right",
                              background: isEditing ? "#fff8e1" : "white",
                            }}
                          />
                          {isEditing && (
                            <button
                              onClick={() => saveBaseSalary(item.id)}
                              disabled={savingId === item.id}
                              style={{
                                background: "var(--olive)",
                                color: "white",
                                border: "none",
                                borderRadius: 6,
                                padding: "4px 8px",
                                cursor: "pointer",
                                fontSize: "0.75rem",
                              }}
                            >
                              {savingId === item.id ? "..." : "✓"}
                            </button>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: "8px 12px", textAlign: "right", color: "#666" }}>
                        ฿{allowance.toLocaleString()}
                      </td>
                      <td style={{ padding: "8px 12px", textAlign: "right" }}>฿{item.poolCommission.toLocaleString()}</td>
                      <td style={{ padding: "8px 12px", textAlign: "right" }}>฿{item.retailCommission.toLocaleString()}</td>
                      <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 700, color: "var(--olive)" }}>
                        ฿{rowTotal.toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {isConfirmed && (
            <div style={{ marginTop: "1rem", padding: "0.75rem 1rem", background: "#D4EDDA", color: "#155724", borderRadius: 8, fontSize: "0.875rem" }}>
              ✓ ยืนยันเงินเดือนเดือน {run.month}/{run.year} แล้ว — บันทึกในรายจ่ายเรียบร้อย
            </div>
          )}
        </>
      ) : (
        <div className="card" style={{ textAlign: "center", padding: "3rem" }}>
          <p style={{ color: "#aaa" }}>ไม่สามารถสร้างข้อมูลเงินเดือนได้</p>
        </div>
      )}

      {/* Owner PIN modal */}
      {showPinModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 360 }}>
            <h3 style={{ margin: "0 0 0.5rem", color: "var(--olive)" }}>🔐 Owner PIN</h3>
            <p style={{ fontSize: "0.875rem", color: "#666", marginBottom: "0.75rem" }}>
              ยืนยันเงินเดือนเดือน {run?.month}/{run?.year} จำนวน <strong>฿{totalPayroll.toLocaleString()}</strong>
            </p>
            <p style={{ fontSize: "0.8rem", color: "#888", marginBottom: "1rem" }}>
              หลังจากยืนยัน ยอดนี้จะถูกบันทึกในหน้ารายจ่ายอัตโนมัติ
            </p>
            <input type="password" className="input" placeholder="Owner PIN" value={pin}
              onChange={e => setPin(e.target.value)}
              onKeyDown={e => e.key === "Enter" && confirmPayroll()}
              style={{ marginBottom: "0.5rem" }} autoFocus />
            {pinError && <div style={{ color: "var(--alert-red)", fontSize: "0.875rem", marginBottom: "0.75rem" }}>{pinError}</div>}
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button className="btn-primary" style={{ flex: 1 }} onClick={confirmPayroll} disabled={confirming || !pin}>
                {confirming ? "กำลังยืนยัน..." : "ยืนยัน"}
              </button>
              <button className="btn-secondary" style={{ flex: 1 }}
                onClick={() => { setShowPinModal(false); setPin(""); setPinError(""); }} disabled={confirming}>
                ยกเลิก
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div style={{
          position: "fixed", bottom: 24, right: 24, zIndex: 50,
          background: "#155724", color: "white", padding: "0.75rem 1rem", borderRadius: 8,
          fontSize: "0.875rem", boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
        }}>
          {toast}
        </div>
      )}

      {/* Transaction drill-down modal */}
      {txUser && (
        <div className="modal-overlay" onClick={() => setTxUser(null)}>
          <div className="modal" style={{ maxWidth: 720, width: "95vw", maxHeight: "90vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h3 style={{ margin: 0, color: "var(--olive)" }}>
                📜 รายการ Transaction — {txUser.user.name}
                <span style={{ fontSize: "0.8rem", color: "#888", marginLeft: 8 }}>เดือน {month}/{year}</span>
              </h3>
              <button onClick={() => setTxUser(null)} style={{ background: "none", border: "none", fontSize: "1.4rem", cursor: "pointer", color: "#aaa" }}>×</button>
            </div>

            {txLoading ? (
              <p style={{ textAlign: "center", padding: "2rem", color: "#888" }}>กำลังโหลด...</p>
            ) : txOrders.length === 0 ? (
              <p style={{ textAlign: "center", padding: "2rem", color: "#aaa" }}>ไม่มี Transaction ในเดือนนี้</p>
            ) : (
              <>
                <div style={{ background: "var(--beige)", padding: "0.75rem", borderRadius: 8, marginBottom: "0.75rem", display: "flex", justifyContent: "space-between", fontSize: "0.875rem" }}>
                  <span>จำนวน Transaction</span>
                  <strong>{txOrders.length} รายการ · ยอดรวม ฿{txOrders.reduce((s, o) => s + o.total, 0).toLocaleString()}</strong>
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.825rem" }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid var(--beige-dark)", color: "#666" }}>
                      <th style={{ textAlign: "left", padding: "6px 8px" }}>วันที่</th>
                      <th style={{ textAlign: "left", padding: "6px 8px" }}>ใบเสร็จ</th>
                      <th style={{ textAlign: "left", padding: "6px 8px" }}>ลูกค้า</th>
                      <th style={{ textAlign: "left", padding: "6px 8px" }}>บริการ</th>
                      <th style={{ textAlign: "center", padding: "6px 8px" }}>บทบาท</th>
                      <th style={{ textAlign: "right", padding: "6px 8px" }}>ยอด</th>
                    </tr>
                  </thead>
                  <tbody>
                    {txOrders.map(o => {
                      const isTech = o.technician.id === txUser.userId;
                      const refDate = o.completedAt || o.createdAt;
                      return (
                        <tr key={o.id} style={{ borderBottom: "1px solid #f5f5f5" }}>
                          <td style={{ padding: "6px 8px" }}>
                            {new Date(refDate).toLocaleDateString("th-TH")}
                          </td>
                          <td style={{ padding: "6px 8px", fontFamily: "monospace", fontSize: "0.75rem" }}>
                            {o.receiptNumber && o.completedAt ? formatReceiptNo(o.receiptNumber, o.completedAt) : "-"}
                          </td>
                          <td style={{ padding: "6px 8px" }}>{o.customerName}</td>
                          <td style={{ padding: "6px 8px", color: "#666" }}>
                            {o.items.map(i => i.service.name).join(", ")}
                          </td>
                          <td style={{ padding: "6px 8px", textAlign: "center" }}>
                            <span style={{
                              fontSize: "0.7rem", padding: "2px 8px", borderRadius: 10,
                              background: isTech ? "#CCE5FF" : "#FFF3CD",
                              color: isTech ? "#004085" : "#856404",
                            }}>
                              {isTech ? "ช่างหลัก" : "ผู้ช่วย"}
                            </span>
                          </td>
                          <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: 600, color: "var(--olive)" }}>
                            ฿{o.total.toLocaleString()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div style={{ marginTop: "0.75rem", textAlign: "right" }}>
                  <Link href="/pos/history" style={{ fontSize: "0.8rem", color: "var(--olive)", textDecoration: "underline" }}>
                    เปิดหน้าประวัติ Transaction ทั้งหมด →
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
