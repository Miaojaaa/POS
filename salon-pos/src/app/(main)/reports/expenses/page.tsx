"use client";

import { useEffect, useState } from "react";

type Expense = { id: string; category: string; description: string; amount: number; date: string; createdBy: { name: string } };

export default function ExpensesReportPage() {
  const today = new Date();
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [year, setYear] = useState(today.getFullYear());
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/expenses?month=${month}&year=${year}`);
    setExpenses(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, [month, year]);

  const total = expenses.reduce((s, e) => s + e.amount, 0);

  const byCategory = expenses.reduce<Record<string, number>>((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + e.amount;
    return acc;
  }, {});

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--olive)", margin: 0 }}>💸 รายงานค่าใช้จ่าย</h1>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <select className="input" style={{ width: 120 }} value={month} onChange={e => setMonth(Number(e.target.value))}>
            {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>เดือน {i + 1}</option>)}
          </select>
          <select className="input" style={{ width: 100 }} value={year} onChange={e => setYear(Number(e.target.value))}>
            {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y + 543}</option>)}
          </select>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "1rem", marginBottom: "1.5rem" }}>
        <div className="card" style={{ textAlign: "center" }}>
          <div style={{ color: "#888", fontSize: "0.8rem", marginBottom: 4 }}>รวมค่าใช้จ่ายประจำเดือน</div>
          <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--alert-red)" }}>฿{total.toLocaleString()}</div>
        </div>
        <div className="card">
          <h3 style={{ margin: "0 0 1rem", fontSize: "1rem", color: "var(--olive)" }}>แยกตามหมวดหมู่ (฿)</h3>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem" }}>
            {Object.entries(byCategory).map(([cat, amt]) => (
              <div key={cat} style={{ background: "#f9f9f9", padding: "8px 16px", borderRadius: 8 }}>
                <div style={{ fontSize: "0.75rem", color: "#888" }}>{cat}</div>
                <span style={{ fontWeight: 600 }}>{amt.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid var(--beige-dark)", color: "#666" }}>
              <th style={{ textAlign: "left", padding: "8px 12px" }}>วันที่</th>
              <th style={{ textAlign: "left", padding: "8px 12px" }}>หมวดหมู่</th>
              <th style={{ textAlign: "left", padding: "8px 12px" }}>รายการ</th>
              <th style={{ textAlign: "right", padding: "8px 12px" }}>จำนวนเงิน (฿)</th>
              <th style={{ textAlign: "left", padding: "8px 12px" }}>ผู้บันทึก</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} style={{ textAlign: "center", padding: "2rem" }}>กำลังโหลด...</td></tr>
            ) : expenses.length === 0 ? (
              <tr><td colSpan={5} style={{ textAlign: "center", padding: "2rem", color: "#aaa" }}>ไม่มีข้อมูลค่าใช้จ่าย</td></tr>
            ) : (
              expenses.map(e => (
                <tr key={e.id} style={{ borderBottom: "1px solid #f5f5f5" }}>
                  <td style={{ padding: "8px 12px" }}>{e.date}</td>
                  <td style={{ padding: "8px 12px" }}>{e.category}</td>
                  <td style={{ padding: "8px 12px" }}>{e.description}</td>
                  <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 600 }}>{e.amount.toLocaleString()}</td>
                  <td style={{ padding: "8px 12px", color: "#666" }}>{e.createdBy.name}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
