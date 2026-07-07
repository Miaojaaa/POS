"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { type DailyRow } from "@/components/reports/TrendChart";
import { exportMonthlyXlsx, type OrderForExport } from "@/lib/excel";

const WaterfallChart = dynamic(() => import("@/components/reports/WaterfallChart"), { ssr: false, loading: () => <div>กำลังโหลดกราฟ...</div> });
const DonutChart = dynamic(() => import("@/components/reports/DonutChart"), { ssr: false, loading: () => <div>กำลังโหลดกราฟ...</div> });
const TrendChart = dynamic(() => import("@/components/reports/TrendChart"), { ssr: false, loading: () => <div>กำลังโหลดกราฟ...</div> });
const CompareChart = dynamic(() => import("@/components/reports/CompareChart"), { ssr: false, loading: () => <div>กำลังโหลดกราฟ...</div> });


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
  topServices: { name: string; count: number; revenue: number }[];
  topTechs: { name: string; count: number; revenue: number }[];
  daily: DailyRow[];
};

type ViewMode = "default" | "waterfall" | "donut" | "trend" | "compare";

const TAB_LABELS: Record<ViewMode, string> = {
  default: "ภาพรวม",
  waterfall: "กำไร",
  donut: "top 5 บริการ",
  trend: "Trend",
  compare: "Compare",
};

export default function RevenuePage() {
  const today = new Date();
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [year, setYear] = useState(today.getFullYear());
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [view, setView] = useState<ViewMode>("default");

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/reports?month=${month}&year=${year}`);
    setData(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, [month, year]);

  async function handleExport() {
    setExporting(true);
    try {
      const startOfMonth = new Date(year, month - 1, 1).toISOString();
      const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999).toISOString();
      const res = await fetch(`/api/orders?status=PAID&startDate=${startOfMonth}&endDate=${endOfMonth}`);
      const orders: OrderForExport[] = await res.json();
      if (!Array.isArray(orders)) {
        alert("ไม่สามารถดึงข้อมูลออร์เดอร์ได้");
        return;
      }
      await exportMonthlyXlsx(orders, { month, year }, `รายงานรายได้-${year}-${String(month).padStart(2, "0")}.xlsx`);
    } catch (err) {
      console.error("Export error:", err);
      alert(`ส่งออกไม่สำเร็จ — ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setExporting(false);
    }
  }

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

      {/* View-mode tabs */}
      <div style={{ display: "flex", gap: "0.4rem", marginBottom: "1rem", flexWrap: "wrap" }}>
        {(Object.keys(TAB_LABELS) as ViewMode[]).map(v => {
          const active = view === v;
          return (
            <button
              key={v}
              onClick={() => setView(v)}
              style={{
                padding: "6px 16px",
                borderRadius: 20,
                border: "1.5px solid",
                borderColor: active ? "var(--olive)" : "var(--beige-dark)",
                background: active ? "var(--olive)" : "white",
                color: active ? "white" : "var(--text-dark)",
                fontSize: "0.85rem",
                fontWeight: active ? 600 : 400,
                cursor: "pointer",
              }}
            >
              {TAB_LABELS[v]}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div>กำลังโหลด...</div>
      ) : data ? (
        view === "waterfall" ? (
          <div className="card">
            <h3 style={{ margin: "0 0 0.75rem", fontSize: "1rem", color: "var(--olive)" }}>📊 รายได้ → กำไร (Waterfall)</h3>
            <WaterfallChart
              totalNet={data.totalNet}
              totalChemCost={data.totalChemCost}
              totalExpense={data.totalExpense}
              netProfit={data.netProfit}
            />
          </div>
        ) : view === "donut" ? (
          <div className="card">
            <h3 style={{ margin: "0 0 0.75rem", fontSize: "1rem", color: "var(--olive)" }}>🍩 สัดส่วนรายได้ตามบริการ (Top 5)</h3>
            <DonutChart topServices={data.topServices} />
          </div>
        ) : view === "trend" ? (
          <div className="card">
            <h3 style={{ margin: "0 0 0.75rem", fontSize: "1rem", color: "var(--olive)" }}>📈 แนวโน้มรายวัน</h3>
            <TrendChart daily={data.daily || []} month={month} year={year} />
          </div>
        ) : view === "compare" ? (
          <div className="card">
            <h3 style={{ margin: "0 0 0.75rem", fontSize: "1rem", color: "var(--olive)" }}>📊 เปรียบเทียบช่วงเวลา</h3>
            <CompareChart />
          </div>
        ) : (
        <>
          {/* Revenue breakdown: 3 columns */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem", marginBottom: "1rem" }}>
            <div className="card" style={{ textAlign: "center", borderLeft: "4px solid var(--olive)" }}>
              <div style={{ fontSize: "0.8rem", color: "#888", marginBottom: 4 }}>Net Total (รวม Service Charge, ก่อน VAT)</div>
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
              <div style={{ fontSize: "0.8rem", color: "#888", marginBottom: 4 }}>รวมทั้งสิ้น (รวม VAT)</div>
              <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#1d4ed8" }}>
                ฿{data.totalGross.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </div>
              <div style={{ fontSize: "0.7rem", color: "#aaa", marginTop: 2 }}>{data.orderCount} ออร์เดอร์</div>
            </div>
          </div>

          {/* Cost / Profit row */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem", marginBottom: "1.5rem" }}>
            <div className="card" style={{ textAlign: "center" }}>
              <div style={{ fontSize: "0.8rem", color: "#888", marginBottom: 4 }}>ต้นทุนเคมี</div>
              <div style={{ fontSize: "1.3rem", fontWeight: 700, color: "#C4863B" }}>
                ฿{data.totalChemCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
            </div>
            <div className="card" style={{ textAlign: "center" }}>
              <div style={{ fontSize: "0.8rem", color: "#888", marginBottom: 4 }}>ค่าใช้จ่ายอื่น</div>
              <div style={{ fontSize: "1.3rem", fontWeight: 700, color: "#A65A7C" }}>
                ฿{data.totalExpense.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
            </div>
            <div className="card" style={{ textAlign: "center" }}>
              <div style={{ fontSize: "0.8rem", color: "#888", marginBottom: 4 }}>กำไรสุทธิ (Net − ต้นทุน − ค่าใช้จ่าย)</div>
              <div style={{ fontSize: "1.3rem", fontWeight: 700, color: data.netProfit >= 0 ? "var(--success-green)" : "var(--alert-red)" }}>
                ฿{data.netProfit.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <div className="card">
              <h3 style={{ margin: "0 0 1rem", fontSize: "1rem", color: "var(--olive)" }}>🏆 Top 5 บริการยอดนิยม (฿)</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                {data.topServices.map((s, i) => {
                  const maxRevenue = data.topServices[0]?.revenue || 1;
                  const percentage = (s.revenue / maxRevenue) * 100;
                  return (
                    <div key={i} style={{ fontSize: "0.875rem" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                        <span>{i + 1}. {s.name} ({s.count} ครั้ง)</span>
                        <span style={{ fontWeight: 700 }}>{Math.round(s.revenue).toLocaleString()}</span>
                      </div>
                      <div style={{ width: "100%", height: "8px", backgroundColor: "#f0f0f0", borderRadius: "4px", overflow: "hidden" }}>
                        <div
                          style={{
                            width: `${percentage}%`,
                            height: "100%",
                            backgroundColor: "var(--olive)",
                            borderRadius: "4px",
                            transition: "width 0.5s ease-in-out",
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              {data.topServices.length === 0 && <p style={{ color: "#aaa" }}>ไม่มีข้อมูล</p>}
            </div>

            <div className="card">
              <h3 style={{ margin: "0 0 1rem", fontSize: "1rem", color: "var(--olive)" }}>✂️ ช่างที่สร้างรายได้สูงสุด (฿)</h3>
              {data.topTechs.map((t, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #f5f5f5", fontSize: "0.875rem" }}>
                  <span>{i + 1}. {t.name} ({t.count} ออร์เดอร์)</span>
                  <span style={{ fontWeight: 700 }}>{Math.round(t.revenue).toLocaleString()}</span>
                </div>
              ))}
              {data.topTechs.length === 0 && <p style={{ color: "#aaa" }}>ไม่มีข้อมูล</p>}
            </div>
          </div>
        </>
        )
      ) : null}
    </div>
  );
}
