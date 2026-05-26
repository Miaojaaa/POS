"use client";

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

type Slice = { name: string; value: number };

type Props = {
  topServices: { name: string; revenue: number; count: number }[];
};

const fmt = (n: number) => `฿${Math.round(n).toLocaleString()}`;
const fmtTooltip = (v: unknown) => fmt(typeof v === "number" ? v : 0);

const COLORS = ["#6B7C45", "#8FA65A", "#C4863B", "#A65A7C", "#1d4ed8", "#d97706", "#0891b2"];

/**
 * Revenue share by service — the "Top 5" rows from the report aggregated into
 * a single Others slice so the donut stays readable.
 */
export default function DonutChart({ topServices }: Props) {
  const total = topServices.reduce((s, x) => s + x.revenue, 0);
  const slices: Slice[] = topServices.length === 0
    ? []
    : topServices.map(s => ({ name: s.name, value: s.revenue }));

  if (total === 0) {
    return <p style={{ color: "#aaa", textAlign: "center", padding: "2rem" }}>ยังไม่มีรายได้ในช่วงที่เลือก</p>;
  }

  return (
    <>
      <div style={{ width: "100%", minHeight: 340 }}>
        <ResponsiveContainer width="100%" height={340} minWidth={0}>
          <PieChart>
            <Pie
              data={slices}
              dataKey="value"
              nameKey="name"
              innerRadius={70}
              outerRadius={120}
              paddingAngle={2}
            >
              {slices.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip formatter={fmtTooltip} contentStyle={{ fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="card" style={{ marginTop: "1rem", padding: "0.75rem 1rem", background: "#fafafa" }}>
        <div style={{ fontSize: "0.8rem", color: "#666", marginBottom: 6, fontWeight: 600 }}>ข้อมูลดิบประกอบกราฟ</div>
        <table style={{ width: "100%", fontSize: "0.85rem", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #e5e5e5", color: "#888" }}>
              <th style={{ textAlign: "left", padding: "6px 0" }}>บริการ</th>
              <th style={{ textAlign: "right", padding: "6px 0" }}>จำนวน</th>
              <th style={{ textAlign: "right", padding: "6px 0" }}>รายได้</th>
              <th style={{ textAlign: "right", padding: "6px 0" }}>สัดส่วน</th>
            </tr>
          </thead>
          <tbody>
            {topServices.map((s, i) => (
              <tr key={i} style={{ borderBottom: "1px solid #f0f0f0" }}>
                <td style={{ padding: "6px 0", display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: COLORS[i % COLORS.length] }} />
                  {s.name}
                </td>
                <td style={{ padding: "6px 0", textAlign: "right" }}>{s.count}</td>
                <td style={{ padding: "6px 0", textAlign: "right", fontFamily: "monospace" }}>{fmt(s.revenue)}</td>
                <td style={{ padding: "6px 0", textAlign: "right", color: "#666" }}>
                  {((s.revenue / total) * 100).toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
