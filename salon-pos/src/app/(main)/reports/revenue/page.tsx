"use client";

import { useEffect, useState } from "react";

type ReportData = {
  totalRevenue: number;
  totalChemCost: number;
  totalExpense: number;
  netProfit: number;
  orderCount: number;
  topServices: { name: string; count: number; revenue: number }[];
  topTechs: { name: string; count: number; revenue: number }[];
};

export default function RevenuePage() {
  const today = new Date();
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [year, setYear] = useState(today.getFullYear());
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/reports?month=${month}&year=${year}`);
    setData(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, [month, year]);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--olive)", margin: 0 }}>📈 รายได้ & ต้นทุน</h1>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <select className="input" style={{ width: 120 }} value={month} onChange={e => setMonth(Number(e.target.value))}>
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i + 1} value={i + 1}>เดือน {i + 1}</option>
            ))}
          </select>
          <select className="input" style={{ width: 100 }} value={year} onChange={e => setYear(Number(e.target.value))}>
            {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y + 543}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div>กำลังโหลด...</div>
      ) : data ? (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem", marginBottom: "1.5rem" }}>
            {[
              { label: "รายได้รวม", value: data.totalRevenue, color: "var(--olive)", icon: "💰" },
              { label: "ต้นทุนเคมี", value: data.totalChemCost, color: "#C4863B", icon: "🧪" },
              { label: "ค่าใช้จ่ายอื่น", value: data.totalExpense, color: "#A65A7C", icon: "💸" },
              { label: "กำไรสุทธิ", value: data.netProfit, color: data.netProfit >= 0 ? "var(--success-green)" : "var(--alert-red)", icon: "📊" },
            ].map(card => (
              <div key={card.label} className="card" style={{ textAlign: "center" }}>
                <div style={{ fontSize: 28, marginBottom: 4 }}>{card.icon}</div>
                <div style={{ fontSize: "1.3rem", fontWeight: 700, color: card.color }}>
                  ฿{card.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </div>
                <div style={{ fontSize: "0.8rem", color: "#888" }}>{card.label}</div>
              </div>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <div className="card">
              <h3 style={{ margin: "0 0 1rem", fontSize: "1rem", color: "var(--olive)" }}>🏆 Top 5 บริการยอดนิยม</h3>
              {data.topServices.map((s, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #f5f5f5", fontSize: "0.875rem" }}>
                  <span>{i + 1}. {s.name} ({s.count} ครั้ง)</span>
                  <span style={{ fontWeight: 700 }}>฿{s.revenue.toLocaleString()}</span>
                </div>
              ))}
              {data.topServices.length === 0 && <p style={{ color: "#aaa" }}>ไม่มีข้อมูล</p>}
            </div>

            <div className="card">
              <h3 style={{ margin: "0 0 1rem", fontSize: "1rem", color: "var(--olive)" }}>✂️ ช่างที่สร้างรายได้สูงสุด</h3>
              {data.topTechs.map((t, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #f5f5f5", fontSize: "0.875rem" }}>
                  <span>{i + 1}. {t.name} ({t.count} ออร์เดอร์)</span>
                  <span style={{ fontWeight: 700 }}>฿{t.revenue.toLocaleString()}</span>
                </div>
              ))}
              {data.topTechs.length === 0 && <p style={{ color: "#aaa" }}>ไม่มีข้อมูล</p>}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
