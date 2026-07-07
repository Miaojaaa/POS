"use client";

import { useEffect, useState, useCallback } from "react";
import type { CommissionMode } from "@/lib/system-config";
import { useBranch } from "@/context/BranchContext";
import { BarChart3 } from "lucide-react";

const roleMap: Record<string, string> = {
  MANAGER: "ผู้จัดการ",
  TECHNICIAN: "ช่างทำผม",
  ASSISTANT: "ผู้ช่วยช่าง",
  CONTENT_CREATOR: "คอนเทนต์ครีเอเตอร์",
};

const getRoleName = (rolesString: string) => {
  if (!rolesString) return "-";
  return rolesString.split(',').map(r => roleMap[r.trim()] || r.trim()).join(', ');
};

type TechKPI = {
  id: string;
  name: string;
  role: string;
  orderCount: number;
  revenue: number;
  avgPct: number;
  isLow?: boolean;
};

export default function KPIPage() {
  const { branches } = useBranch();
  const today = new Date();
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [year, setYear] = useState(today.getFullYear());
  const [branchFilter, setBranchFilter] = useState<string>("ALL");
  const [kpiData, setKpiData] = useState<TechKPI[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [commissionMode, setCommissionMode] = useState<CommissionMode>("POOL");

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const startOfMonth = new Date(year, month - 1, 1).toISOString();
      const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999).toISOString();

      // PAID-only matches what generatePayrollRun consumes, so % share + orderCount line up
      // with the Payroll page in PER_HEAD mode.
      const branchQS = branchFilter !== "ALL" ? `&branchId=${branchFilter}` : "";
      const [usersRes, ordersRes] = await Promise.all([
        fetch("/api/users"),
        fetch(`/api/orders?status=PAID&startDate=${startOfMonth}&endDate=${endOfMonth}${branchQS}`),
      ]);

      if (!usersRes.ok || !ordersRes.ok) {
        const usersText = await usersRes.text();
        const ordersText = await ordersRes.text();
        console.error("Fetch failed:", {
          usersStatus: usersRes.status,
          usersText,
          ordersStatus: ordersRes.status,
          ordersText
        });
        throw new Error(`Failed to fetch data: Users ${usersRes.status}, Orders ${ordersRes.status}`);
      }

      type UserRef = { id: string; name: string; role: string; branchId?: string };
      type AssistantRef = { user?: { id: string } };
      type OrderForKpi = { technicianId: string; total: number; assistants: AssistantRef[] };

      const allUsers: UserRef[] = await usersRes.json();
      const users = branchFilter === "ALL" ? allUsers : allUsers.filter(u => (u.branchId ?? "main") === branchFilter);
      const orders: OrderForKpi[] = await ordersRes.json();

      // Role-keyed sets + per-role order totals — same denominator the payroll PER_HEAD
      // formula uses, so KPI's % column is exactly the share that drives commission.
      const techIds = new Set(
        users.filter(u => u.role.split(",").includes("TECHNICIAN")).map(u => u.id),
      );
      const assistIds = new Set(
        users.filter(u => u.role.split(",").includes("ASSISTANT")).map(u => u.id),
      );
      const totalTechOrders = orders.filter(o => techIds.has(o.technicianId)).length;
      const totalAssistSlots = orders.reduce(
        (s, o) => s + o.assistants.filter(a => a.user && assistIds.has(a.user.id)).length,
        0,
      );

      const kpi = users
        .filter(u => u.role.split(",").some(r => ["TECHNICIAN", "ASSISTANT"].includes(r)))
        .map(u => {
          const myTechOrders = orders.filter(o => o.technicianId === u.id);
          const myAssistOrders = orders.filter(o => o.assistants.some(a => a.user?.id === u.id));
          const myAllOrders = orders.filter(o =>
            o.technicianId === u.id || o.assistants.some(a => a.user?.id === u.id),
          );
          const revenue = myAllOrders.reduce((s, o) => s + o.total, 0);

          // Tech path wins when a user has both roles — matches the if/else if in payroll.ts.
          const roles = u.role.split(",");
          let shareNum = 0;
          let shareDen = 0;
          if (roles.includes("TECHNICIAN") && totalTechOrders > 0) {
            shareNum = myTechOrders.length;
            shareDen = totalTechOrders;
          } else if (roles.includes("ASSISTANT") && totalAssistSlots > 0) {
            shareNum = myAssistOrders.length;
            shareDen = totalAssistSlots;
          }
          const avgPct = shareDen > 0 ? (shareNum / shareDen) * 100 : 0;

          return { id: u.id, name: u.name, role: u.role, orderCount: myAllOrders.length, revenue, avgPct };
        });

      const teamAvg = kpi.reduce((s, k) => s + k.orderCount, 0) / (kpi.length || 1);
      setKpiData(kpi.map(k => ({ ...k, isLow: k.orderCount < teamAvg * 0.5 })));
      setLastUpdated(new Date());
    } catch (err) {
      console.error("Failed to load KPI data", err);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [month, year, branchFilter]);

  useEffect(() => {
    load();
    const timer = setInterval(() => load(true), 86400000); // Auto-refresh every 1 day
    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => {
    const loadCfg = () => {
      fetch("/api/system-config")
        .then(r => r.json())
        .then((d: { finance?: { commissionMode?: CommissionMode } }) => {
          if (d.finance?.commissionMode) setCommissionMode(d.finance.commissionMode);
        })
        .catch(() => { /* keep default */ });
    };
    loadCfg();
    window.addEventListener("system-config-updated", loadCfg);
    return () => window.removeEventListener("system-config-updated", loadCfg);
  }, []);

  const teamAvg = kpiData.length > 0 ? kpiData.reduce((s, k) => s + k.orderCount, 0) / kpiData.length : 0;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <div>
          <h1 style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "1.4rem", fontWeight: 700, color: "var(--olive)", margin: 0 }}>
            <BarChart3 size={24} /> KPI ช่าง
          </h1>
          {lastUpdated && (
            <span style={{ fontSize: "0.75rem", color: "#888" }}>
              อัปเดตล่าสุด: {lastUpdated.toLocaleTimeString()}
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <button 
            className="btn-secondary" 
            style={{ padding: "6px 10px", fontSize: "1rem" }} 
            onClick={() => load()}
            title="รีเฟรช"
            disabled={loading}
          >
            {loading ? "..." : "🔄"}
          </button>
          <select className="input" style={{ width: 140 }} value={branchFilter} onChange={e => setBranchFilter(e.target.value)}>
            <option value="ALL">ทุกสาขา</option>
            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
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
        {(() => {
          const showShare = commissionMode !== "NONE";
          const shareHeader = commissionMode === "PER_HEAD" ? "% ส่วนแบ่งงาน" : "% เทียบทีม";
          return (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid var(--beige-dark)", color: "#666" }}>
                  <th style={{ textAlign: "left", padding: "8px 12px" }}>ช่าง</th>
                  <th style={{ textAlign: "left", padding: "8px 12px" }}>ตำแหน่ง</th>
                  <th style={{ textAlign: "center", padding: "8px 12px" }}>จำนวนออร์เดอร์</th>
                  {showShare && <th style={{ textAlign: "center", padding: "8px 12px" }}>{shareHeader}</th>}
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
                      <td style={{ padding: "8px 12px", color: "#666", fontSize: "0.8rem" }}>{getRoleName(k.role)}</td>
                      <td style={{ padding: "8px 12px", textAlign: "center", fontWeight: 700 }}>{k.orderCount}</td>
                      {showShare && (
                        <td style={{ padding: "8px 12px", textAlign: "center" }}>
                          <span style={{ color: k.avgPct >= 20 ? "var(--success-green)" : "#888" }}>
                            {k.avgPct.toFixed(1)}%
                          </span>
                        </td>
                      )}
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
          );
        })()}
        {kpiData.length === 0 && !loading && <p style={{ color: "#aaa", textAlign: "center", padding: "2rem" }}>ไม่มีข้อมูล</p>}
        {loading && !kpiData.length && <p style={{ color: "#aaa", textAlign: "center", padding: "2rem" }}>กำลังโหลด...</p>}
      </div>
    </div>
  );
}
