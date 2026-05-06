"use client";

import { useEffect, useState } from "react";

type TechKPI = {
  id: string;
  name: string;
  role: string;
  orderCount: number;
  revenue: number;
  avgPct: number;
};

export default function KPIPage() {
  const today = new Date();
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [year, setYear] = useState(today.getFullYear());
  const [kpiData, setKpiData] = useState<TechKPI[]>([]);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    const [usersRes, ordersRes] = await Promise.all([
      fetch("/api/users"),
      fetch(`/api/orders?status=DONE`),
    ]);
    const users = await usersRes.json();
    const allOrders = await ordersRes.json();

    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0, 23, 59, 59);
    const orders = allOrders.filter((o: { completedAt: string; status: string }) => {
      if (!o.completedAt) return false;
      const d = new Date(o.completedAt);
      return d >= startOfMonth && d <= endOfMonth;
    });

    const totalOrders = orders.length;
    const kpi = users
      .filter((u: { role: string }) => ["TECHNICIAN", "ASSISTANT"].includes(u.role))
      .map((u: { id: string; name: string; role: string }) => {
        const myOrders = orders.filter((o: { technicianId: string }) => o.technicianId === u.id);
        const revenue = myOrders.reduce((s: number, o: { total: number }) => s + o.total, 0);
        const avgPct = totalOrders > 0 ? (myOrders.length / totalOrders) * 100 : 0;
        return { id: u.id, name: u.name, role: u.role, orderCount: myOrders.length, revenue, avgPct };
      });

    const teamAvg = kpi.reduce((s: number, k: TechKPI) => s + k.orderCount, 0) / (kpi.length || 1);
    setKpiData(kpi.map((k: TechKPI) => ({ ...k, isLow: k.orderCount < teamAvg * 0.5 })));
    setLoading(false);
  }

  useEffect(() => { load(); }, [month, year]);

  const teamAvg = kpiData.length > 0 ? kpiData.reduce((s, k) => s + k.orderCount, 0) / kpiData.length : 0;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--olive)", margin: 0 }}>📊 KPI ช่าง</h1>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <select className="input" style={{ width: 120 }} value={month} onChange={e => setMonth(Number(e.target.value))}>
            {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>เดือน {i + 1}</option>)}
          </select>
          <select className="input" style={{ width: 100 }} value={year} onChange={e => setYear(Number(e.target.value))}>
            {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y + 543}</option>)}
          </select>
        </div>
      </div>

      {!loading && kpiData.length > 0 && (
        <div style={{ background: "var(--beige-dark)", padding: "0.75rem 1rem", borderRadius: 8, marginBottom: "1rem", fontSize: "0.875rem" }}>
          📊 ค่าเฉลี่ยทีม: {teamAvg.toFixed(1)} ออร์เดอร์/คน
        </div>
      )}

      <div className="card">
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid var(--beige-dark)", color: "#666" }}>
              <th style={{ textAlign: "left", padding: "8px 12px" }}>ช่าง</th>
              <th style={{ textAlign: "center", padding: "8px 12px" }}>จำนวนออร์เดอร์</th>
              <th style={{ textAlign: "center", padding: "8px 12px" }}>% เทียบทีม</th>
              <th style={{ textAlign: "right", padding: "8px 12px" }}>รายได้ที่สร้าง</th>
              <th style={{ textAlign: "center", padding: "8px 12px" }}>สถานะ</th>
            </tr>
          </thead>
          <tbody>
            {kpiData.sort((a, b) => b.orderCount - a.orderCount).map(k => {
              const isLow = k.orderCount < teamAvg * 0.5;
              return (
                <tr key={k.id} style={{ borderBottom: "1px solid #f5f5f5", background: isLow ? "#fff8f8" : "white" }}>
                  <td style={{ padding: "8px 12px", fontWeight: 500 }}>{k.name}</td>
                  <td style={{ padding: "8px 12px", textAlign: "center", fontWeight: 700 }}>{k.orderCount}</td>
                  <td style={{ padding: "8px 12px", textAlign: "center" }}>
                    <span style={{ color: k.avgPct >= 20 ? "var(--success-green)" : "#888" }}>
                      {k.avgPct.toFixed(1)}%
                    </span>
                  </td>
                  <td style={{ padding: "8px 12px", textAlign: "right" }}>฿{k.revenue.toLocaleString()}</td>
                  <td style={{ padding: "8px 12px", textAlign: "center" }}>
                    {isLow ? (
                      <span style={{ color: "var(--alert-red)", fontSize: "0.8rem" }}>⚠️ ต่ำกว่าเกณฑ์</span>
                    ) : (
                      <span style={{ color: "var(--success-green)", fontSize: "0.8rem" }}>✓ ปกติ</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {kpiData.length === 0 && !loading && <p style={{ color: "#aaa", textAlign: "center", padding: "2rem" }}>ไม่มีข้อมูล</p>}
        {loading && <p style={{ color: "#aaa", textAlign: "center", padding: "2rem" }}>กำลังโหลด...</p>}
      </div>
    </div>
  );
}
