"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Legend, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

type Mode = "month" | "year";

type Period = { month?: number; year: number };

type MonthData = {
  totalNet: number;
  totalChemCost: number;
  totalExpense: number;
  netProfit: number;
  orderCount: number;
};

type YearData = MonthData & {
  monthly: { month: number; net: number; chemCost: number; expense: number; profit: number; orderCount: number }[];
};

const fmt = (n: number) => `฿${Math.round(n).toLocaleString()}`;
const fmtTooltip = (v: unknown) => fmt(typeof v === "number" ? v : 0);
const pct = (a: number, b: number) => (b === 0 ? (a === 0 ? 0 : 100) : ((a - b) / Math.abs(b)) * 100);

const MONTHS_TH = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

const COLORS = { A: "#6B7C45", B: "#C4863B" };

function labelOf(mode: Mode, p: Period): string {
  if (mode === "month") return `${MONTHS_TH[(p.month ?? 1) - 1]} ${p.year + 543}`;
  return `${p.year + 543}`;
}

async function fetchData(mode: Mode, p: Period): Promise<MonthData | YearData | null> {
  const url = mode === "month"
    ? `/api/reports?month=${p.month}&year=${p.year}`
    : `/api/reports?year=${p.year}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  return res.json();
}

export default function CompareChart() {
  const today = new Date();
  const [mode, setMode] = useState<Mode>("month");

  const [periodA, setPeriodA] = useState<Period>({ month: today.getMonth() + 1, year: today.getFullYear() });
  const [periodB, setPeriodB] = useState<Period>({
    month: today.getMonth() === 0 ? 12 : today.getMonth(),
    year: today.getMonth() === 0 ? today.getFullYear() - 1 : today.getFullYear(),
  });

  const [dataA, setDataA] = useState<MonthData | YearData | null>(null);
  const [dataB, setDataB] = useState<MonthData | YearData | null>(null);
  const [loading, setLoading] = useState(false);

  // When switching mode, strip/inject month so the API call matches the new shape.
  useEffect(() => {
    if (mode === "year") {
      setPeriodA(p => ({ year: p.year }));
      setPeriodB(p => ({ year: p.year }));
    } else {
      setPeriodA(p => ({ month: p.month ?? today.getMonth() + 1, year: p.year }));
      setPeriodB(p => ({ month: p.month ?? (today.getMonth() === 0 ? 12 : today.getMonth()), year: p.year }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([fetchData(mode, periodA), fetchData(mode, periodB)])
      .then(([a, b]) => {
        if (cancelled) return;
        setDataA(a);
        setDataB(b);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [mode, periodA, periodB]);

  const metricRows = useMemo(() => {
    if (!dataA || !dataB) return [];
    return [
      { key: "net",     label: "รายได้สุทธิ",     a: dataA.totalNet,       b: dataB.totalNet },
      { key: "chem",    label: "ต้นทุนเคมี",      a: dataA.totalChemCost,  b: dataB.totalChemCost },
      { key: "expense", label: "ค่าใช้จ่ายอื่น",  a: dataA.totalExpense,   b: dataB.totalExpense },
      { key: "profit",  label: "กำไรสุทธิ",       a: dataA.netProfit,      b: dataB.netProfit },
    ];
  }, [dataA, dataB]);

  const monthlyOverlay = useMemo(() => {
    if (mode !== "year" || !dataA || !dataB) return [];
    const ya = dataA as YearData;
    const yb = dataB as YearData;
    if (!Array.isArray(ya.monthly) || !Array.isArray(yb.monthly)) return [];
    return ya.monthly.map((row, i) => ({
      month: MONTHS_TH[i],
      [labelOf("year", periodA)]: row.net,
      [labelOf("year", periodB)]: yb.monthly[i]?.net ?? 0,
    }));
  }, [mode, dataA, dataB, periodA, periodB]);

  const years = [today.getFullYear() - 2, today.getFullYear() - 1, today.getFullYear()];
  const labelA = labelOf(mode, periodA);
  const labelB = labelOf(mode, periodB);

  return (
    <div>
      {/* Mode toggle */}
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem", alignItems: "center" }}>
        <span style={{ fontSize: "0.85rem", color: "#666" }}>เปรียบเทียบ:</span>
        {(["month", "year"] as Mode[]).map(m => {
          const active = mode === m;
          return (
            <button
              key={m}
              onClick={() => setMode(m)}
              style={{
                padding: "4px 14px",
                borderRadius: 16,
                border: "1.5px solid",
                borderColor: active ? "var(--olive)" : "var(--beige-dark)",
                background: active ? "var(--olive)" : "white",
                color: active ? "white" : "var(--text-dark)",
                fontSize: "0.8rem",
                fontWeight: active ? 600 : 400,
                cursor: "pointer",
              }}
            >
              {m === "month" ? "เดือน vs เดือน" : "ปี vs ปี"}
            </button>
          );
        })}
      </div>

      {/* Period pickers */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "1rem" }}>
        {([
          { p: periodA, set: setPeriodA, label: "ช่วง A", color: COLORS.A },
          { p: periodB, set: setPeriodB, label: "ช่วง B", color: COLORS.B },
        ] as const).map(({ p, set, label, color }) => (
          <div key={label} className="card" style={{ padding: "0.75rem 1rem", borderLeft: `4px solid ${color}` }}>
            <div style={{ fontSize: "0.75rem", color: "#666", marginBottom: 4 }}>
              <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: color, marginRight: 6 }} />
              {label}
            </div>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              {mode === "month" && (
                <select
                  className="input"
                  style={{ flex: 1, marginBottom: 0 }}
                  value={p.month ?? 1}
                  onChange={e => set({ ...p, month: Number(e.target.value) })}
                >
                  {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>เดือน {i + 1}</option>)}
                </select>
              )}
              <select
                className="input"
                style={{ width: 110, marginBottom: 0 }}
                value={p.year}
                onChange={e => set({ ...p, year: Number(e.target.value) })}
              >
                {years.map(y => <option key={y} value={y}>{y + 543}</option>)}
              </select>
            </div>
          </div>
        ))}
      </div>

      {loading ? (
        <div style={{ padding: "2rem", textAlign: "center", color: "#888" }}>กำลังโหลด...</div>
      ) : !dataA || !dataB ? (
        <div style={{ padding: "2rem", textAlign: "center", color: "#aaa" }}>โหลดข้อมูลไม่สำเร็จ</div>
      ) : (
        <>
          {/* Bar chart: paired bars per metric (both modes use this) */}
          <div style={{ width: "100%", minHeight: 320, marginBottom: "1rem" }}>
            <ResponsiveContainer width="100%" height={320} minWidth={0}>
              <BarChart
                data={metricRows.map(r => ({ name: r.label, [labelA]: r.a, [labelB]: r.b }))}
                margin={{ top: 24, right: 16, left: 8, bottom: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={fmt} tick={{ fontSize: 11 }} width={80} />
                <Tooltip formatter={fmtTooltip} contentStyle={{ fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey={labelA} fill={COLORS.A} radius={[4, 4, 0, 0]} />
                <Bar dataKey={labelB} fill={COLORS.B} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Year mode: extra LineChart overlaying 12 months of net revenue */}
          {mode === "year" && monthlyOverlay.length > 0 && (
            <div className="card" style={{ marginBottom: "1rem" }}>
              <div style={{ fontSize: "0.85rem", color: "#666", marginBottom: 6, fontWeight: 600 }}>
                แนวโน้มรายได้สุทธิรายเดือน ({labelA} vs {labelB})
              </div>
              <div style={{ width: "100%", minHeight: 280 }}>
                <ResponsiveContainer width="100%" height={280} minWidth={0}>
                  <LineChart data={monthlyOverlay} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={fmt} tick={{ fontSize: 11 }} width={80} />
                    <Tooltip formatter={fmtTooltip} contentStyle={{ fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line type="monotone" dataKey={labelA} stroke={COLORS.A} strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey={labelB} stroke={COLORS.B} strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Raw data table */}
          <div className="card" style={{ padding: "0.75rem 1rem", background: "#fafafa" }}>
            <div style={{ fontSize: "0.8rem", color: "#666", marginBottom: 6, fontWeight: 600 }}>ข้อมูลดิบประกอบกราฟ</div>
            <table style={{ width: "100%", fontSize: "0.85rem", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #e5e5e5", color: "#888" }}>
                  <th style={{ textAlign: "left", padding: "6px 4px" }}>รายการ</th>
                  <th style={{ textAlign: "right", padding: "6px 4px", color: COLORS.A }}>{labelA}</th>
                  <th style={{ textAlign: "right", padding: "6px 4px", color: COLORS.B }}>{labelB}</th>
                  <th style={{ textAlign: "right", padding: "6px 4px" }}>ผลต่าง</th>
                  <th style={{ textAlign: "right", padding: "6px 4px" }}>เปลี่ยนแปลง</th>
                </tr>
              </thead>
              <tbody>
                {metricRows.map(r => {
                  const diff = r.a - r.b;
                  const change = pct(r.a, r.b);
                  const better = r.key === "net" || r.key === "profit" ? diff >= 0 : diff <= 0;
                  const arrow = diff === 0 ? "→" : diff > 0 ? "▲" : "▼";
                  const color = diff === 0 ? "#888" : better ? "var(--success-green)" : "var(--alert-red)";
                  return (
                    <tr key={r.key} style={{ borderBottom: "1px solid #f0f0f0" }}>
                      <td style={{ padding: "6px 4px" }}>{r.label}</td>
                      <td style={{ padding: "6px 4px", textAlign: "right", fontFamily: "monospace" }}>{fmt(r.a)}</td>
                      <td style={{ padding: "6px 4px", textAlign: "right", fontFamily: "monospace" }}>{fmt(r.b)}</td>
                      <td style={{ padding: "6px 4px", textAlign: "right", fontFamily: "monospace", color }}>
                        {arrow} {fmt(Math.abs(diff))}
                      </td>
                      <td style={{ padding: "6px 4px", textAlign: "right", color, fontWeight: 600 }}>
                        {Number.isFinite(change) ? `${change >= 0 ? "+" : ""}${change.toFixed(1)}%` : "—"}
                      </td>
                    </tr>
                  );
                })}
                <tr>
                  <td style={{ padding: "6px 4px", color: "#888", fontSize: "0.8rem" }}>จำนวนออร์เดอร์</td>
                  <td style={{ padding: "6px 4px", textAlign: "right", fontFamily: "monospace", color: "#888" }}>{dataA.orderCount.toLocaleString()}</td>
                  <td style={{ padding: "6px 4px", textAlign: "right", fontFamily: "monospace", color: "#888" }}>{dataB.orderCount.toLocaleString()}</td>
                  <td style={{ padding: "6px 4px", textAlign: "right", fontFamily: "monospace", color: "#888" }}>{(dataA.orderCount - dataB.orderCount).toLocaleString()}</td>
                  <td style={{ padding: "6px 4px", textAlign: "right", color: "#888" }}>
                    {dataB.orderCount === 0 ? "—" : `${((dataA.orderCount - dataB.orderCount) / dataB.orderCount * 100).toFixed(1)}%`}
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
