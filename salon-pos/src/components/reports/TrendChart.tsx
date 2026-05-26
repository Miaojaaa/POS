"use client";

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type DailyRow = {
  day: number;
  net: number;
  chemCost: number;
  expense: number;
  profit: number;
  orderCount: number;
};

type Props = { daily: DailyRow[]; month: number; year: number };

const fmt = (n: number) => `฿${Math.round(n).toLocaleString()}`;
const fmtTooltip = (v: unknown) => fmt(typeof v === "number" ? v : 0);

export default function TrendChart({ daily, month, year }: Props) {
  const hasData = daily.some(d => d.net !== 0 || d.expense !== 0);
  const monthLabel = `${String(month).padStart(2, "0")}/${year + 543}`;

  if (!hasData) {
    return <p style={{ color: "#aaa", textAlign: "center", padding: "2rem" }}>ยังไม่มีข้อมูลในเดือน {monthLabel}</p>;
  }

  return (
    <>
      <div style={{ width: "100%", minHeight: 340 }}>
        <ResponsiveContainer width="100%" height={340} minWidth={0}>
          <LineChart data={daily} margin={{ top: 16, right: 16, left: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="day" tick={{ fontSize: 11 }} label={{ value: `วันที่ (${monthLabel})`, position: "insideBottom", offset: -2, fontSize: 12 }} />
            <YAxis tickFormatter={fmt} tick={{ fontSize: 11 }} width={80} />
            <Tooltip
              formatter={fmtTooltip}
              labelFormatter={(v) => `วันที่ ${v}`}
              contentStyle={{ fontSize: 12 }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line type="monotone" dataKey="net" name="รายได้สุทธิ" stroke="#6B7C45" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="chemCost" name="ต้นทุนเคมี" stroke="#C4863B" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="expense" name="ค่าใช้จ่ายอื่น" stroke="#A65A7C" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="profit" name="กำไรสุทธิ" stroke="#1d4ed8" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="card" style={{ marginTop: "1rem", padding: "0.75rem 1rem", background: "#fafafa", maxHeight: 280, overflowY: "auto" }}>
        <div style={{ fontSize: "0.8rem", color: "#666", marginBottom: 6, fontWeight: 600 }}>ข้อมูลดิบประกอบกราฟ (รายวัน)</div>
        <table style={{ width: "100%", fontSize: "0.8rem", borderCollapse: "collapse" }}>
          <thead style={{ position: "sticky", top: 0, background: "#fafafa" }}>
            <tr style={{ borderBottom: "1px solid #e5e5e5", color: "#888" }}>
              <th style={{ textAlign: "left", padding: "6px 4px" }}>วันที่</th>
              <th style={{ textAlign: "right", padding: "6px 4px" }}>ออร์เดอร์</th>
              <th style={{ textAlign: "right", padding: "6px 4px" }}>รายได้สุทธิ</th>
              <th style={{ textAlign: "right", padding: "6px 4px" }}>ต้นทุนเคมี</th>
              <th style={{ textAlign: "right", padding: "6px 4px" }}>ค่าใช้จ่ายอื่น</th>
              <th style={{ textAlign: "right", padding: "6px 4px" }}>กำไรสุทธิ</th>
            </tr>
          </thead>
          <tbody>
            {daily.map(d => (
              <tr key={d.day} style={{ borderBottom: "1px solid #f0f0f0" }}>
                <td style={{ padding: "5px 4px" }}>{d.day}</td>
                <td style={{ padding: "5px 4px", textAlign: "right" }}>{d.orderCount}</td>
                <td style={{ padding: "5px 4px", textAlign: "right", fontFamily: "monospace", color: "#6B7C45" }}>{fmt(d.net)}</td>
                <td style={{ padding: "5px 4px", textAlign: "right", fontFamily: "monospace", color: "#C4863B" }}>{fmt(d.chemCost)}</td>
                <td style={{ padding: "5px 4px", textAlign: "right", fontFamily: "monospace", color: "#A65A7C" }}>{fmt(d.expense)}</td>
                <td style={{
                  padding: "5px 4px",
                  textAlign: "right",
                  fontFamily: "monospace",
                  color: d.profit >= 0 ? "#1d4ed8" : "#D94F4F",
                  fontWeight: 600,
                }}>
                  {fmt(d.profit)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
