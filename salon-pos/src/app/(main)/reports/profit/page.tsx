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
    fetch(`/api/reports?month=${month}&year=${year}`).then(r => r.json()).then(resp => {
      if (resp && typeof resp === "object" && !resp.error) {
        setData(resp);
      } else {
        setData(null);
      }
    }).catch(() => setData(null));
  }, [month, year, unlocked]);

  async function handleExport() {
    setExporting(true);
    try {
      const startOfMonth = new Date(year, month - 1, 1).toISOString();
      const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999).toISOString();
      const res = await fetch(`/api/orders?status=PAID&startDate=${startOfMonth}&endDate=${endOfMonth}`);
      const orders = await res.json();
      if (!Array.isArray(orders)) { alert("ไม่สามารถดึงข้อมูลออร์เดอร์ได้"); return; }
      exportTransactionsXlsx(orders as OrderForExport[], { month, year }, `กำไรจริง-${year}-${String(month).padStart(2, "0")}.xlsx`);
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
            style={{ padding: "0 1.5rem" }}
          >
            {exporting ? "กำลังส่งออก..." : "📤 Export Excel"}
          </button>
        </div>
      </div>

      {data ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem", marginBottom: "2rem" }}>
          <div className="card" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "0.8rem", color: "#666", marginBottom: 4 }}>Revenue (Gross)</div>
            <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--olive)" }}>฿{data.totalGross.toLocaleString()}</div>
          </div>
          <div className="card" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "0.8rem", color: "#666", marginBottom: 4 }}>ต้นทุนเคมี (Chem)</div>
            <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#d97706" }}>฿{data.totalChemCost.toLocaleString()}</div>
          </div>
          <div className="card" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "0.8rem", color: "#666", marginBottom: 4 }}>ค่าใช้จ่ายทั่วไป (Expenses)</div>
            <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#dc2626" }}>฿{data.totalExpense.toLocaleString()}</div>
          </div>
          <div className="card" style={{ textAlign: "center", background: "var(--olive)", color: "white" }}>
            <div style={{ fontSize: "0.8rem", opacity: 0.9, marginBottom: 4 }}>กำไรสุทธิ (Net Profit)</div>
            <div style={{ fontSize: "1.5rem", fontWeight: 800 }}>฿{data.netProfit.toLocaleString()}</div>
          </div>
        </div>
      ) : (
        <div className="card" style={{ textAlign: "center", padding: "4rem", color: "#aaa" }}>
          กำลังคำนวณข้อมูล...
        </div>
      )}

      {data && (
        <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: "1.5rem" }}>
          <div className="card">
            <h3 style={{ margin: "0 0 1.25rem", color: "var(--olive)" }}>รายละเอียดทางบัญชี</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.95rem" }}>
                <span>ยอดขายรวม (รวม VAT/SC)</span>
                <strong>฿{data.totalGross.toLocaleString()}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.95rem", color: "#666" }}>
                <span>ภาษีมูลค่าเพิ่ม (VAT 7%)</span>
                <span>฿{data.totalVat.toLocaleString()}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.95rem", color: "#666" }}>
                <span>ค่าบริการ (Service Charge 3%)</span>
                <span>฿{data.totalSC.toLocaleString()}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "1rem", fontWeight: 700, borderTop: "1px solid #eee", paddingTop: "0.75rem", marginTop: "0.25rem" }}>
                <span>รายได้หลังหักภาษี/ค่าบริการ (Net Revenue)</span>
                <span style={{ color: "var(--olive)" }}>฿{data.totalNet.toLocaleString()}</span>
              </div>
            </div>
          </div>

          <div className="card">
            <h3 style={{ margin: "0 0 1.25rem", color: "var(--olive)" }}>สถิติประจำเดือน</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div>
                <div style={{ fontSize: "0.8rem", color: "#666" }}>จำนวนออร์เดอร์</div>
                <div style={{ fontSize: "1.25rem", fontWeight: 700 }}>{data.orderCount} รายการ</div>
              </div>
              <div>
                <div style={{ fontSize: "0.8rem", color: "#666" }}>ค่าเฉลี่ยต่อออร์เดอร์ (Gross)</div>
                <div style={{ fontSize: "1.25rem", fontWeight: 700 }}>฿{data.orderCount > 0 ? (data.totalGross / data.orderCount).toLocaleString(undefined, { maximumFractionDigits: 0 }) : 0}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
