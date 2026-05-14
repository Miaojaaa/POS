"use client";

import { useEffect, useState } from "react";
import { exportTransactionsXlsx, type OrderForExport } from "@/lib/excel";

type ReportData = {
  totalRevenue: number;
  totalGross: number;
  totalNet: number;
  totalVat: number;
  totalSC: number;
  totalChemCost: number;
  totalExpense: number;
  netProfit: number;
  orderCount: number;
};

export default function ProfitPage() {
  const today = new Date();
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [year, setYear] = useState(today.getFullYear());
  const [data, setData] = useState<ReportData | null>(null);
  const [showPinModal, setShowPinModal] = useState(true);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [exporting, setExporting] = useState(false);

  async function verifyOwnerPin() {
    const res = await fetch("/api/verify-pin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "OWNER", pin }),
    });
    const d = await res.json();
    if (d.ok) { setUnlocked(true); setShowPinModal(false); }
    else setPinError("Owner PIN ไม่ถูกต้อง");
  }

  useEffect(() => {
    if (!unlocked) return;
    fetch(`/api/reports?month=${month}&year=${year}`).then(r => r.json()).then(setData);
  }, [month, year, unlocked]);

  async function handleExport() {
    setExporting(true);
    try {
      const startOfMonth = new Date(year, month - 1, 1).toISOString();
      const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999).toISOString();
      const res = await fetch(`/api/orders?status=PAID&startDate=${startOfMonth}&endDate=${endOfMonth}`);
      const orders: OrderForExport[] = await res.json();
      if (!Array.isArray(orders)) { alert("ไม่สามารถดึงข้อมูลออร์เดอร์ได้"); return; }
      exportTransactionsXlsx(orders, { month, year }, `กำไรจริง-${year}-${String(month).padStart(2, "0")}.xlsx`);
    } catch (err) {
      console.error("Export error:", err);
      alert(`ส่งออกไม่สำเร็จ — ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setExporting(false);
    }
  }

  if (showPinModal) {
    return (
      <div style={{ maxWidth: 400, margin: "4rem auto" }}>
        <div className="card">
          <h2 style={{ color: "var(--olive)", textAlign: "center", marginBottom: "1rem" }}>🔐 กำไรจริง</h2>
          <p style={{ color: "#666", textAlign: "center", fontSize: "0.875rem", marginBottom: "1.5rem" }}>
            หน้านี้ต้องใช้ Owner PIN เท่านั้น
          </p>
          <input
            type="password"
            className="input"
            placeholder="Owner PIN"
            value={pin}
            onChange={e => setPin(e.target.value)}
            onKeyDown={e => e.key === "Enter" && verifyOwnerPin()}
            style={{ marginBottom: "0.75rem" }}
          />
          {pinError && <div style={{ color: "var(--alert-red)", fontSize: "0.875rem", marginBottom: "0.5rem" }}>{pinError}</div>}
          <button className="btn-primary" style={{ width: "100%" }} onClick={verifyOwnerPin}>ยืนยัน</button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--olive)", margin: 0 }}>📊 กำไรจริง (Owner only)</h1>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <select className="input" style={{ width: 120 }} value={month} onChange={e => setMonth(Number(e.target.value))}>
            {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>เดือน {i + 1}</option>)}
          </select>
          <select className="input" style={{ width: 100 }} value={year} onChange={e => setYear(Number(e.target.value))}>
            {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y + 543}</option>)}
          </select>
          <button
            className="btn-primary"
            onClick={handleExport}
            disabled={exporting || !data || data.orderCount === 0}
            style={{ background: "#16a34a" }}
          >
            {exporting ? "กำลังส่งออก..." : "📥 Export Excel"}
          </button>
        </div>
      </div>

      {data && (
        <>
          {/* Revenue breakdown: 3 columns */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem", marginBottom: "1rem" }}>
            <div className="card" style={{ textAlign: "center", borderLeft: "4px solid var(--olive)" }}>
              <div style={{ fontSize: "0.8rem", color: "#888", marginBottom: 4 }}>Net Total (รวม SC, ก่อน VAT)</div>
              <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--olive)" }}>
                ฿{data.totalNet.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </div>
              {data.totalSC > 0 && (
                <div style={{ fontSize: "0.7rem", color: "#aaa", marginTop: 2 }}>รวม SC 3% ฿{data.totalSC.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
              )}
            </div>
            <div className="card" style={{ textAlign: "center", borderLeft: "4px solid #d97706" }}>
              <div style={{ fontSize: "0.8rem", color: "#888", marginBottom: 4 }}>VAT 7% (ส่งสรรพากร)</div>
              <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#d97706" }}>
                ฿{data.totalVat.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </div>
            </div>
            <div className="card" style={{ textAlign: "center", borderLeft: "4px solid #1d4ed8" }}>
              <div style={{ fontSize: "0.8rem", color: "#888", marginBottom: 4 }}>รวมรับ (Gross)</div>
              <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#1d4ed8" }}>
                ฿{data.totalGross.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          {/* Costs + profit */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.5rem" }}>
            <div className="card" style={{ textAlign: "center" }}>
              <div style={{ fontSize: "0.8rem", color: "#888", marginBottom: 4 }}>ต้นทุนรวม (เคมี + ค่าใช้จ่าย)</div>
              <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--alert-red)" }}>
                ฿{(data.totalChemCost + data.totalExpense).toLocaleString()}
              </div>
            </div>
            <div className="card" style={{ textAlign: "center", border: `2px solid ${data.netProfit >= 0 ? "var(--success-green)" : "var(--alert-red)"}` }}>
              <div style={{ fontSize: "0.8rem", color: "#888", marginBottom: 4 }}>กำไรสุทธิ (Net − ต้นทุน − ค่าใช้จ่าย)</div>
              <div style={{ fontSize: "2rem", fontWeight: 700, color: data.netProfit >= 0 ? "var(--success-green)" : "var(--alert-red)" }}>
                ฿{data.netProfit.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
            </div>
          </div>

          <div className="card">
            <h3 style={{ margin: "0 0 0.75rem", color: "var(--olive)", fontSize: "1rem" }}>📊 P&amp;L</h3>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
              <tbody>
                <tr style={{ borderBottom: "1px solid #f5f5f5" }}>
                  <td style={{ padding: "10px 12px" }}>จำนวนออร์เดอร์</td>
                  <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 600 }}>{data.orderCount} ออร์เดอร์</td>
                </tr>
                <tr style={{ borderBottom: "1px solid #f5f5f5" }}>
                  <td style={{ padding: "10px 12px" }}>Net Total (รวม Service Charge 3%)</td>
                  <td style={{ padding: "10px 12px", textAlign: "right", color: "var(--olive)", fontWeight: 600 }}>
                    + ฿{data.totalNet.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </td>
                </tr>
                <tr style={{ borderBottom: "1px solid #f5f5f5", color: "#888" }}>
                  <td style={{ padding: "10px 12px", fontSize: "0.85rem" }}>
                    <span style={{ marginLeft: "1rem" }}>↳ VAT 7% (info)</span>
                  </td>
                  <td style={{ padding: "10px 12px", textAlign: "right", fontSize: "0.85rem" }}>
                    ฿{data.totalVat.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </td>
                </tr>
                <tr style={{ borderBottom: "1px solid #f5f5f5", color: "#888" }}>
                  <td style={{ padding: "10px 12px", fontSize: "0.85rem" }}>
                    <span style={{ marginLeft: "1rem" }}>↳ รวมรับจริง (info)</span>
                  </td>
                  <td style={{ padding: "10px 12px", textAlign: "right", fontSize: "0.85rem" }}>
                    ฿{data.totalGross.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </td>
                </tr>
                <tr style={{ borderBottom: "1px solid #f5f5f5" }}>
                  <td style={{ padding: "10px 12px" }}>หัก: ต้นทุนเคมี</td>
                  <td style={{ padding: "10px 12px", textAlign: "right", color: "var(--alert-red)" }}>- ฿{data.totalChemCost.toLocaleString()}</td>
                </tr>
                <tr style={{ borderBottom: "1px solid #f5f5f5" }}>
                  <td style={{ padding: "10px 12px" }}>หัก: ค่าใช้จ่ายอื่น</td>
                  <td style={{ padding: "10px 12px", textAlign: "right", color: "var(--alert-red)" }}>- ฿{data.totalExpense.toLocaleString()}</td>
                </tr>
                <tr style={{ background: data.netProfit >= 0 ? "#f0fff4" : "#fff0f0" }}>
                  <td style={{ padding: "12px 12px", fontWeight: 700, fontSize: "1.1rem" }}>กำไรสุทธิ</td>
                  <td style={{ padding: "12px 12px", textAlign: "right", fontWeight: 700, fontSize: "1.2rem", color: data.netProfit >= 0 ? "var(--success-green)" : "var(--alert-red)" }}>
                    ฿{data.netProfit.toLocaleString()}
                  </td>
                </tr>
              </tbody>
            </table>
            <p style={{ marginTop: "0.75rem", fontSize: "0.75rem", color: "#888" }}>
              * VAT 7% และ Service Charge เป็นเงินที่ต้องส่งสรรพากร/บัตรเครดิต — ไม่ใช่กำไรของร้าน จึงไม่นำมาคำนวณกำไรสุทธิ
            </p>
          </div>
        </>
      )}
    </div>
  );
}
