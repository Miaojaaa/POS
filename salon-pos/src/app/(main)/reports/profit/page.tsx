"use client";

import { useEffect, useState } from "react";

type ReportData = { totalRevenue: number; totalChemCost: number; totalExpense: number; netProfit: number; orderCount: number };

export default function ProfitPage() {
  const today = new Date();
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [year, setYear] = useState(today.getFullYear());
  const [data, setData] = useState<ReportData | null>(null);
  const [showPinModal, setShowPinModal] = useState(true);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [unlocked, setUnlocked] = useState(false);

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
        </div>
      </div>

      {data && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem", marginBottom: "1.5rem" }}>
            <div className="card" style={{ textAlign: "center" }}>
              <div style={{ fontSize: "0.8rem", color: "#888", marginBottom: 4 }}>รายได้รวม</div>
              <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--olive)" }}>฿{data.totalRevenue.toLocaleString()}</div>
            </div>
            <div className="card" style={{ textAlign: "center" }}>
              <div style={{ fontSize: "0.8rem", color: "#888", marginBottom: 4 }}>ต้นทุนรวม (เคมี + ค่าใช้จ่าย)</div>
              <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--alert-red)" }}>
                ฿{(data.totalChemCost + data.totalExpense).toLocaleString()}
              </div>
            </div>
            <div className="card" style={{ textAlign: "center", border: `2px solid ${data.netProfit >= 0 ? "var(--success-green)" : "var(--alert-red)"}` }}>
              <div style={{ fontSize: "0.8rem", color: "#888", marginBottom: 4 }}>กำไรสุทธิ</div>
              <div style={{ fontSize: "2rem", fontWeight: 700, color: data.netProfit >= 0 ? "var(--success-green)" : "var(--alert-red)" }}>
                ฿{data.netProfit.toLocaleString()}
              </div>
            </div>
          </div>

          <div className="card">
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
              <tbody>
                <tr style={{ borderBottom: "1px solid #f5f5f5" }}>
                  <td style={{ padding: "10px 12px" }}>จำนวนออร์เดอร์</td>
                  <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 600 }}>{data.orderCount} ออร์เดอร์</td>
                </tr>
                <tr style={{ borderBottom: "1px solid #f5f5f5" }}>
                  <td style={{ padding: "10px 12px" }}>รายได้รวม</td>
                  <td style={{ padding: "10px 12px", textAlign: "right", color: "var(--olive)", fontWeight: 600 }}>+ ฿{data.totalRevenue.toLocaleString()}</td>
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
          </div>
        </>
      )}
    </div>
  );
}
