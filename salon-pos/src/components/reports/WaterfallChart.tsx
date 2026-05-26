"use client";

import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Props = {
  totalNet: number;
  totalChemCost: number;
  totalExpense: number;
  netProfit: number;
};

type Step = { name: string; base: number; delta: number; color: string; isTotal: boolean };

const fmt = (n: number) => `฿${Math.round(n).toLocaleString()}`;
const fmtTooltip = (v: unknown, _name: unknown, props: { payload?: Step }) => {
  const num = typeof v === "number" ? v : 0;
  return [fmt(num), props.payload?.isTotal ? "ยอดรวม" : "หักออก"] as [string, string];
};
const fmtLabel = (v: unknown) => fmt(typeof v === "number" ? v : 0);

/**
 * Recharts has no first-class waterfall, so we fake one with a stacked bar:
 * an invisible "base" lifts each bar to where the running total sits, and the
 * visible segment shows the delta. The first ("รายได้สุทธิ") and last
 * ("กำไรสุทธิ") columns are full-height totals; the middle columns are the
 * subtractive deductions that bring you from one to the other.
 */
export default function WaterfallChart({ totalNet, totalChemCost, totalExpense, netProfit }: Props) {
  const steps: Step[] = [
    { name: "รายได้สุทธิ", base: 0, delta: totalNet, color: "#6B7C45", isTotal: true },
    { name: "− ต้นทุนเคมี", base: totalNet - totalChemCost, delta: totalChemCost, color: "#C4863B", isTotal: false },
    { name: "− ค่าใช้จ่าย", base: totalNet - totalChemCost - totalExpense, delta: totalExpense, color: "#A65A7C", isTotal: false },
    { name: "กำไรสุทธิ", base: 0, delta: netProfit, color: netProfit >= 0 ? "#16a34a" : "#D94F4F", isTotal: true },
  ];

  return (
    <>
      <div style={{ width: "100%", minHeight: 340 }}>
        <ResponsiveContainer width="100%" height={340} minWidth={0}>
          <BarChart data={steps} margin={{ top: 24, right: 16, left: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis tickFormatter={fmt} tick={{ fontSize: 11 }} width={80} />
            <Tooltip
              formatter={fmtTooltip}
              labelStyle={{ fontSize: 12 }}
              contentStyle={{ fontSize: 12 }}
            />
            <Bar dataKey="base" stackId="a" fill="transparent" />
            <Bar dataKey="delta" stackId="a" radius={[6, 6, 0, 0]}>
              {steps.map((s, i) => <Cell key={i} fill={s.color} />)}
              <LabelList dataKey="delta" position="top" formatter={fmtLabel} style={{ fontSize: 11, fill: "#444" }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="card" style={{ marginTop: "1rem", padding: "0.75rem 1rem", background: "#fafafa" }}>
        <div style={{ fontSize: "0.8rem", color: "#666", marginBottom: 6, fontWeight: 600 }}>ข้อมูลดิบประกอบกราฟ</div>
        <table style={{ width: "100%", fontSize: "0.85rem", borderCollapse: "collapse" }}>
          <tbody>
            {steps.map((s, i) => (
              <tr key={i} style={{ borderBottom: "1px solid #f0f0f0" }}>
                <td style={{ padding: "6px 0", color: s.color, fontWeight: s.isTotal ? 700 : 400 }}>{s.name}</td>
                <td style={{ padding: "6px 0", textAlign: "right", fontFamily: "monospace", fontWeight: s.isTotal ? 700 : 400 }}>
                  {fmt(s.delta)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
