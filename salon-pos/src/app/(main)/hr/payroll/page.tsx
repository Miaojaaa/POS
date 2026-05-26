"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import type { CommissionMode } from "@/lib/system-config";
import { useBranch } from "@/context/BranchContext";

type PayrollItem = {
  id: string;
  userId: string;
  baseSalary: number;
  positionAllowance: number;
  poolCommission: number;
  retailCommission: number;
  totalAmount: number;
  orderCount: number;
  user: { name: string; role: string; branchId?: string };
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

export default function PayrollPage() {
  const { branches } = useBranch();
  const today = new Date();
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [year, setYear] = useState(today.getFullYear());
  const [branchFilter, setBranchFilter] = useState<string>("ALL");
  const [run, setRun] = useState<PayrollRun | null>(null);
  const [loading, setLoading] = useState(false);
  const [commissionMode, setCommissionMode] = useState<CommissionMode>("POOL");

  // confirm flow
  const [showConfirmWarning, setShowConfirmWarning] = useState(false);
  const [showKPIWarning, setShowKPIWarning] = useState(false);
  const [lowKPITechs, setLowKPITechs] = useState<PayrollItem[]>([]);
  
  const [showPinModal, setShowPinModal] = useState(false);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // recalc flow — Owner PIN-gated regen that resets CONFIRMED back to DRAFT so the
  // user can sanity-check commission-mode toggles without re-confirming.
  const [showRecalcPin, setShowRecalcPin] = useState(false);
  const [recalcPin, setRecalcPin] = useState("");
  const [recalcError, setRecalcError] = useState("");
  const [recalculating, setRecalculating] = useState(false);

  // transaction drill-down modal
  const [txUser, setTxUser] = useState<PayrollItem | null>(null);
  const [txOrders, setTxOrders] = useState<TxOrder[]>([]);
  const [txLoading, setTxLoading] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch(`/api/payroll?month=${month}&year=${year}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data && typeof data === "object" && !data.error) {
        setRun(data);
      } else {
        setRun(null);
      }
    } catch {
      // transient network error — ignore
    } finally {
      if (!silent) setLoading(false);
    }
  }, [month, year]);

  useEffect(() => {
    load();
    const onFocus = () => load(true);
    window.addEventListener("focus", onFocus);
    const interval = setInterval(() => load(true), 8000);
    return () => {
      window.removeEventListener("focus", onFocus);
      clearInterval(interval);
    };
  }, [load]);

  useEffect(() => {
    const loadCfg = () => {
      fetch("/api/system-config")
        .then(r => r.json())
        .then((d: { finance?: { commissionMode?: CommissionMode } }) => {
          if (d.finance?.commissionMode) setCommissionMode(d.finance.commissionMode);
        })
        .catch(() => { /* keep default */ });
    };
    loadCfg();
    window.addEventListener("system-config-updated", loadCfg);
    return () => window.removeEventListener("system-config-updated", loadCfg);
  }, []);

  async function openTx(item: PayrollItem) {
    setTxUser(item);
    setTxOrders([]);
    setTxLoading(true);
    const res = await fetch(`/api/payroll/transactions?userId=${item.userId}&month=${month}&year=${year}`);
    const data = await res.json();
    if (Array.isArray(data)) setTxOrders(data);
    setTxLoading(false);
  }

  async function handleRecalc() {
    setRecalculating(true);
    setRecalcError("");
    try {
      const res = await fetch("/api/payroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month, year, pin: recalcPin }),
      });
      const data = await res.json();
      if (res.ok) {
        setShowRecalcPin(false);
        setRecalcPin("");
        setToast("✅ คำนวณใหม่สำเร็จ — กลับเป็นฉบับร่างเรียบร้อย");
        load();
        setTimeout(() => setToast(null), 5000);
      } else {
        setRecalcError(data.error || "คำนวณใหม่ไม่สำเร็จ");
      }
    } catch {
      setRecalcError("การเชื่อมต่อล้มเหลว");
    } finally {
      setRecalculating(false);
    }
  }

  function handleStartConfirm() {
    if (!run) return;
    const techs = filteredItems.filter(i => i.user.role.includes("TECHNICIAN"));
    const teamAvg = techs.length > 0 ? techs.reduce((s, i) => s + i.orderCount, 0) / techs.length : 0;
    const low = techs.filter(i => i.orderCount < teamAvg * 0.5);
    
    if (low.length > 0) {
      setLowKPITechs(low);
      setShowKPIWarning(true);
    } else {
      setShowConfirmWarning(true);
    }
  }

  async function confirmPayroll() {
    if (!run) return;
    setConfirming(true);
    setPinError("");
    try {
      const res = await fetch("/api/payroll/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId: run.id, pin }),
      });
      const data = await res.json();
      if (res.ok) {
        setShowPinModal(false);
        setPin("");
        setToast("✅ ยืนยันเงินเดือนสำเร็จ (รายการถูกล็อกแล้ว)");
        load();
        setTimeout(() => setToast(null), 5000);
      } else {
        setPinError(data.error || "รหัส PIN ไม่ถูกต้อง");
      }
    } catch {
      setPinError("การเชื่อมต่อล้มเหลว");
    } finally {
      setConfirming(false);
    }
  }

  const filteredItems = run?.items
    ? branchFilter === "ALL"
      ? run.items
      : run.items.filter(i => (i.user.branchId ?? "main") === branchFilter)
    : [];
  const totalBase = filteredItems.reduce((s, i) => s + i.baseSalary, 0);
  const totalAllowances = filteredItems.reduce((s, i) => s + (i.positionAllowance || 0), 0);
  const totalPayroll = filteredItems.reduce((s, i) => s + i.totalAmount, 0) + totalAllowances;

  return (
    <div style={{ position: "relative" }}>
      {toast && (
        <div style={{ position: "fixed", top: "1rem", right: "1rem", background: "white", padding: "1rem 1.5rem", borderRadius: 12, boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)", zIndex: 2000, border: "2px solid var(--success-green)", color: "var(--success-green)", fontWeight: 700 }}>
          {toast}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--olive)", margin: 0 }}>💸 เงินเดือน &amp; ค่าคอม</h1>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          {run?.status === "CONFIRMED" && (
            <button
              className="btn-secondary"
              onClick={() => { setRecalcPin(""); setRecalcError(""); setShowRecalcPin(true); }}
              title="คำนวณค่าคอมใหม่ตามรูปแบบล่าสุดในการตั้งค่า (ต้องใช้ Owner PIN)"
            >
              🔄 คำนวณใหม่
            </button>
          )}
          <select className="input" style={{ width: 140 }} value={branchFilter} onChange={e => setBranchFilter(e.target.value)}>
            <option value="ALL">🏢 ทุกสาขา</option>
            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <select className="input" style={{ width: 120 }} value={month} onChange={e => setMonth(Number(e.target.value))}>
            {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>เดือน {i + 1}</option>)}
          </select>
          <select className="input" style={{ width: 100 }} value={year} onChange={e => setYear(Number(e.target.value))}>
            {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y + 543}</option>)}
          </select>
        </div>
      </div>

      {!run ? (
        <div className="card" style={{ textAlign: "center", padding: "4rem", color: "#aaa" }}>
          {loading ? "กำลังโหลดข้อมูล..." : "ไม่พบข้อมูลสำหรับเดือนนี้"}
        </div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem", marginBottom: "1.5rem" }}>
            <div className="card" style={{ textAlign: "center" }}>
              <div style={{ fontSize: "0.8rem", color: "#666", marginBottom: 4 }}>ยอดจ่ายเงินเดือนพื้นฐาน</div>
              <div style={{ fontSize: "1.5rem", fontWeight: 700 }}>฿{totalBase.toLocaleString()}</div>
            </div>
            <div className="card" style={{ textAlign: "center" }}>
              <div style={{ fontSize: "0.8rem", color: "#666", marginBottom: 4 }}>ยอดจ่ายค่าตำแหน่ง</div>
              <div style={{ fontSize: "1.5rem", fontWeight: 700 }}>฿{totalAllowances.toLocaleString()}</div>
            </div>
            <div className="card" style={{ textAlign: "center" }}>
              <div style={{ fontSize: "0.8rem", color: "#666", marginBottom: 4 }}>ยอดจ่ายค่าคอมมิชชั่น</div>
              <div style={{ fontSize: "1.5rem", fontWeight: 700 }}>฿{(totalPayroll - totalBase - totalAllowances).toLocaleString()}</div>
            </div>
            <div className="card" style={{ textAlign: "center", background: run.status === "CONFIRMED" ? "var(--success-green)" : "var(--olive)", color: "white" }}>
              <div style={{ fontSize: "0.8rem", opacity: 0.9, marginBottom: 4 }}>ยอดรวมจ่ายทั้งหมด ({run.status})</div>
              <div style={{ fontSize: "1.5rem", fontWeight: 800 }}>฿{totalPayroll.toLocaleString()}</div>
            </div>
          </div>

          {run.status === "DRAFT" && (
            <div className="card" style={{ background: "#fef9c3", border: "1px solid #facc15", marginBottom: "1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: "0.9rem", color: "#854d0e" }}>
                ⚠️ รายการยังเป็น <strong>ฉบับร่าง</strong> ยอดจะเปลี่ยนไปตามออร์เดอร์ใหม่ๆ ที่เข้ามา คลิก "ยืนยันยอด" เพื่อล็อกยอดเดือนนี้
              </div>
              <button className="btn-primary" onClick={handleStartConfirm}>ยืนยันยอดเดือน {month}</button>
            </div>
          )}

          <div className="card">
            {(() => {
              const showCommission = commissionMode !== "NONE";
              const poolHeader = commissionMode === "PER_HEAD" ? "ค่าคอม/หัว" : "ค่าคอม Pool";
              const colCount = showCommission ? 8 : 6;
              return (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid var(--beige-dark)", color: "#666" }}>
                      <th style={{ textAlign: "left", padding: "8px 12px" }}>พนักงาน</th>
                      <th style={{ textAlign: "center", padding: "8px 12px" }}>ตำแหน่ง</th>
                      <th style={{ textAlign: "center", padding: "8px 12px" }}>ออร์เดอร์</th>
                      <th style={{ textAlign: "right", padding: "8px 12px" }}>เงินเดือนพื้นฐาน</th>
                      <th style={{ textAlign: "right", padding: "8px 12px" }}>ค่าตำแหน่ง</th>
                      {showCommission && (
                        <>
                          <th style={{ textAlign: "right", padding: "8px 12px" }}>{poolHeader}</th>
                          <th style={{ textAlign: "right", padding: "8px 12px" }}>ค่าคอม Retail</th>
                        </>
                      )}
                      <th style={{ textAlign: "right", padding: "8px 12px" }}>รวม</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.length === 0 ? (
                      <tr><td colSpan={colCount} style={{ textAlign: "center", padding: "2rem", color: "#aaa" }}>
                        {branchFilter === "ALL" ? "ไม่มีพนักงาน — กรุณาเพิ่มพนักงานก่อน" : "ไม่มีพนักงานในสาขานี้"}
                      </td></tr>
                    ) : filteredItems.slice().sort((a, b) => b.totalAmount - a.totalAmount).map(item => {
                      const allowance = item.positionAllowance || 0;
                      const rowTotal = item.totalAmount + allowance;

                      return (
                        <tr key={item.id} style={{ borderBottom: "1px solid #f5f5f5" }}>
                          <td style={{ padding: "8px 12px", fontWeight: 500 }}>{item.user.name}</td>
                          <td style={{ padding: "8px 12px", textAlign: "center", color: "#666" }}>
                            {item.user.role.split(",").map(r => ROLES[r] || r).join(", ")}
                          </td>
                          <td style={{ padding: "8px 12px", textAlign: "center" }}>
                            {item.orderCount > 0 ? (
                              <button onClick={() => openTx(item)} style={{ background: "var(--beige)", border: "1px solid var(--beige-dark)", borderRadius: 6, padding: "2px 8px", cursor: "pointer", fontSize: "0.75rem" }}>
                                {item.orderCount} งาน
                              </button>
                            ) : "-"}
                          </td>
                          <td style={{ padding: "8px 12px", textAlign: "right" }}>฿{item.baseSalary.toLocaleString()}</td>
                          <td style={{ padding: "8px 12px", textAlign: "right", color: allowance > 0 ? "var(--olive)" : "#ccc" }}>฿{allowance.toLocaleString()}</td>
                          {showCommission && (
                            <>
                              <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 600, color: "var(--olive)" }}>฿{item.poolCommission.toLocaleString()}</td>
                              <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 600, color: "#d97706" }}>฿{item.retailCommission.toLocaleString()}</td>
                            </>
                          )}
                          <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 700, fontSize: "0.95rem" }}>฿{rowTotal.toLocaleString()}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              );
            })()}
          </div>
        </>
      )}

      {/* Drill-down Modal */}
      {txUser && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 800 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h3 style={{ margin: 0 }}>รายละเอียดงาน: {txUser.user.name} ({month}/{year + 543})</h3>
              <button onClick={() => setTxUser(null)} style={{ background: "none", border: "none", fontSize: "1.5rem", cursor: "pointer" }}>×</button>
            </div>
            
            <div style={{ maxHeight: 500, overflowY: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
                <thead>
                  <tr style={{ textAlign: "left", borderBottom: "2px solid #eee" }}>
                    <th style={{ padding: 8 }}>วันที่/เวลา</th>
                    <th style={{ padding: 8 }}>ใบเสร็จ</th>
                    <th style={{ padding: 8 }}>ลูกค้า</th>
                    <th style={{ padding: 8 }}>บริการ</th>
                    <th style={{ padding: 8, textAlign: "right" }}>ยอดรวม</th>
                  </tr>
                </thead>
                <tbody>
                  {txLoading ? (
                    <tr><td colSpan={5} style={{ textAlign: "center", padding: "2rem" }}>กำลังโหลด...</td></tr>
                  ) : txOrders.map(o => (
                    <tr key={o.id} style={{ borderBottom: "1px solid #f9f9f9" }}>
                      <td style={{ padding: 8 }}>{new Date(o.createdAt).toLocaleString("th-TH")}</td>
                      <td style={{ padding: 8 }}>{o.receiptNumber ? formatReceiptNo(o.receiptNumber, o.completedAt || o.createdAt) : "-"}</td>
                      <td style={{ padding: 8 }}>{o.customerName}</td>
                      <td style={{ padding: 8 }}>
                        {o.items.map((it, i) => <div key={i}>{it.service.name} (฿{it.price.toLocaleString()})</div>)}
                      </td>
                      <td style={{ padding: 8, textAlign: "right", fontWeight: 600 }}>฿{o.total.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!txLoading && (
                <div style={{ marginTop: "1rem", textAlign: "right", borderTop: "1px solid #eee", paddingTop: "1rem" }}>
                  <strong>{txOrders.length} รายการ · ยอดรวม ฿{txOrders.reduce((s, o) => s + o.total, 0).toLocaleString()}</strong>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* KPI Warning Flow */}
      {showKPIWarning && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 460 }}>
            <h3 style={{ margin: "0 0 1rem", color: "var(--alert-red)" }}>⚠️ พบช่างที่ KPI ต่ำกว่าเกณฑ์</h3>
            <p style={{ fontSize: "0.9rem", color: "#666", marginBottom: "1rem" }}>
              ช่างต่อไปนี้มีจำนวนออร์เดอร์ต่ำกว่า 50% ของค่าเฉลี่ยทีมในเดือนนี้:
            </p>
            <div style={{ background: "#fff5f5", padding: "1rem", borderRadius: 8, marginBottom: "1.5rem" }}>
              {lowKPITechs.map(t => (
                <div key={t.id} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.9rem", marginBottom: 4 }}>
                  <span>• {t.user.name}</span>
                  <span style={{ fontWeight: 700 }}>{t.orderCount} ออร์เดอร์</span>
                </div>
              ))}
            </div>
            <p style={{ fontSize: "0.85rem", color: "#888", marginBottom: "1.5rem" }}>
              คุณต้องการดำเนินการปิดยอดเงินเดือนต่อไปหรือไม่?
            </p>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button className="btn-primary" style={{ flex: 1 }} onClick={() => { setShowKPIWarning(false); setShowConfirmWarning(true); }}>ยอมรับและไปต่อ</button>
              <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setShowKPIWarning(false)}>กลับไปตรวจสอบ</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Flow */}
      {showConfirmWarning && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 400 }}>
            <h3 style={{ margin: "0 0 1rem", color: "#854d0e" }}>⚠️ ยืนยันการปิดยอดเงินเดือน?</h3>
            <p style={{ fontSize: "0.9rem", color: "#666", lineHeight: 1.5 }}>
              เมื่อยืนยันแล้ว รายการเงินเดือนของเดือน {month}/{year + 543} จะถูกล็อก <br/>
              หากมีการแก้ไขงานหรือลบออร์เดอร์ย้อนหลัง จะไม่ส่งผลต่อยอดในเดือนนี้อีก <br/>
              <strong>ต้องการดำเนินการต่อหรือไม่?</strong>
            </p>
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "1.5rem" }}>
              <button className="btn-primary" style={{ flex: 1 }} onClick={() => { setShowConfirmWarning(false); setShowPinModal(true); }}>ไปต่อ</button>
              <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setShowConfirmWarning(false)}>ยกเลิก</button>
            </div>
          </div>
        </div>
      )}

      {showPinModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 320 }}>
            <h3 style={{ margin: "0 0 1rem", color: "var(--olive)" }}>ป้อน Owner PIN</h3>
            <p style={{ fontSize: "0.85rem", color: "#666", marginBottom: "1rem" }}>กรุณาระบุ PIN ของเจ้าของร้านเพื่ออนุมัติการจ่ายเงินเดือน</p>
            <input
              type="password"
              className="input"
              placeholder="Owner PIN"
              value={pin}
              onChange={e => setPin(e.target.value)}
              onKeyDown={e => e.key === "Enter" && confirmPayroll()}
              autoFocus
            />
            {pinError && <div style={{ color: "var(--alert-red)", fontSize: "0.8rem", marginTop: 8 }}>{pinError}</div>}
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "1.5rem" }}>
              <button className="btn-primary" style={{ flex: 1 }} disabled={confirming} onClick={confirmPayroll}>
                {confirming ? "กำลังบันทึก..." : "ยืนยันยอด"}
              </button>
              <button className="btn-secondary" style={{ flex: 1 }} onClick={() => { setShowPinModal(false); setPin(""); setPinError(""); }}>ยกเลิก</button>
            </div>
          </div>
        </div>
      )}

      {showRecalcPin && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 360 }}>
            <h3 style={{ margin: "0 0 0.5rem", color: "var(--olive)" }}>🔄 คำนวณค่าคอมใหม่</h3>
            <p style={{ fontSize: "0.85rem", color: "#666", marginBottom: "1rem", lineHeight: 1.5 }}>
              จะ regen รอบเงินเดือนของเดือน {month}/{year + 543} ตามรูปแบบค่าคอมล่าสุดในหน้าตั้งค่า
              <strong style={{ color: "#854d0e" }}> ยอดที่ยืนยันไว้จะถูกแทนที่ และสถานะกลับเป็นฉบับร่าง</strong>
              {" "}— กดยืนยันยอดอีกครั้งเมื่อพอใจกับตัวเลขใหม่
            </p>
            <input
              type="password"
              className="input"
              placeholder="Owner PIN"
              value={recalcPin}
              onChange={e => setRecalcPin(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleRecalc()}
              autoFocus
            />
            {recalcError && <div style={{ color: "var(--alert-red)", fontSize: "0.8rem", marginTop: 8 }}>{recalcError}</div>}
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "1.5rem" }}>
              <button className="btn-primary" style={{ flex: 1 }} disabled={recalculating || !recalcPin} onClick={handleRecalc}>
                {recalculating ? "กำลังคำนวณ..." : "คำนวณใหม่"}
              </button>
              <button className="btn-secondary" style={{ flex: 1 }} onClick={() => { setShowRecalcPin(false); setRecalcPin(""); setRecalcError(""); }}>ยกเลิก</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
