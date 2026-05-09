"use client";

import { useEffect, useState } from "react";

type PayrollItem = {
  id: string;
  userId: string;
  baseSalary: number;
  poolCommission: number;
  retailCommission: number;
  totalAmount: number;
  orderCount: number;
  user: { name: string; role: string };
};
type PayrollRun = { id: string; month: number; year: number; status: string; items: PayrollItem[] };

const ROLES: Record<string, string> = { OWNER: "เจ้าของ", MANAGER: "ผู้จัดการ", CASHIER: "แคชเชียร์", TECHNICIAN: "ช่าง", ASSISTANT: "ผู้ช่วย" };

export default function PayrollPage() {
  const today = new Date();
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [year, setYear] = useState(today.getFullYear());
  const [run, setRun] = useState<PayrollRun | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [editing, setEditing] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/payroll?month=${month}&year=${year}`);
    const data = await res.json();
    setRun(data);
    setEditing({});
    setLoading(false);
  }

  useEffect(() => { load(); }, [month, year]);

  async function generate() {
    setGenerating(true);
    const res = await fetch("/api/payroll", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month, year }),
    });
    const data = await res.json();
    setRun(data);
    setEditing({});
    setGenerating(false);
  }

  async function saveBaseSalary(itemId: string) {
    const val = editing[itemId];
    if (val == null) return;
    const num = Number(val);
    if (isNaN(num) || num < 0) return;
    setSavingId(itemId);
    const res = await fetch(`/api/payroll/items/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ baseSalary: num }),
    });
    if (res.ok) {
      const updated: PayrollItem = await res.json();
      setRun(prev => prev ? {
        ...prev,
        items: prev.items.map(i => i.id === itemId ? updated : i),
      } : prev);
      setEditing(prev => {
        const next = { ...prev };
        delete next[itemId];
        return next;
      });
    }
    setSavingId(null);
  }

  const totalPayroll = run?.items.reduce((s, i) => s + i.totalAmount, 0) ?? 0;
  const totalBase = run?.items.reduce((s, i) => s + i.baseSalary, 0) ?? 0;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--olive)", margin: 0 }}>💼 เงินเดือน & ค่าคอม</h1>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <select className="input" style={{ width: 120 }} value={month} onChange={e => setMonth(Number(e.target.value))}>
            {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>เดือน {i + 1}</option>)}
          </select>
          <select className="input" style={{ width: 100 }} value={year} onChange={e => setYear(Number(e.target.value))}>
            {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y + 543}</option>)}
          </select>
          <button className="btn-primary" onClick={generate} disabled={generating}>
            {generating ? "กำลังคำนวณ..." : "⚙️ คำนวณเงินเดือน"}
          </button>
        </div>
      </div>

      {loading ? (
        <div>กำลังโหลด...</div>
      ) : run ? (
        <>
          <div style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem" }}>
            <div className="card" style={{ textAlign: "center", flex: 1 }}>
              <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--olive)" }}>฿{totalPayroll.toLocaleString()}</div>
              <div style={{ color: "#888", fontSize: "0.875rem" }}>ยอดจ่ายรวมทั้งหมด</div>
            </div>
            <div className="card" style={{ textAlign: "center", flex: 1 }}>
              <div style={{ fontSize: "1.5rem", fontWeight: 700 }}>฿{totalBase.toLocaleString()}</div>
              <div style={{ color: "#888", fontSize: "0.875rem" }}>เงินเดือนพื้นฐานรวม</div>
            </div>
            <div className="card" style={{ textAlign: "center", flex: 1 }}>
              <div style={{ fontSize: "1.5rem", fontWeight: 700 }}>{run.items.filter(i => i.orderCount > 0).length} คน</div>
              <div style={{ color: "#888", fontSize: "0.875rem" }}>มีออร์เดอร์</div>
            </div>
          </div>

          <div className="card">
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid var(--beige-dark)", color: "#666" }}>
                  <th style={{ textAlign: "left", padding: "8px 12px" }}>พนักงาน</th>
                  <th style={{ textAlign: "center", padding: "8px 12px" }}>ตำแหน่ง</th>
                  <th style={{ textAlign: "center", padding: "8px 12px" }}>ออร์เดอร์</th>
                  <th style={{ textAlign: "right", padding: "8px 12px" }}>เงินเดือนพื้นฐาน</th>
                  <th style={{ textAlign: "right", padding: "8px 12px" }}>ค่าคอม Pool</th>
                  <th style={{ textAlign: "right", padding: "8px 12px" }}>ค่าคอม Retail</th>
                  <th style={{ textAlign: "right", padding: "8px 12px" }}>รวม</th>
                </tr>
              </thead>
              <tbody>
                {run.items.sort((a, b) => b.totalAmount - a.totalAmount).map(item => {
                  const isEditing = editing[item.id] !== undefined;
                  const editVal = editing[item.id];
                  return (
                    <tr key={item.id} style={{ borderBottom: "1px solid #f5f5f5" }}>
                      <td style={{ padding: "8px 12px", fontWeight: 500 }}>{item.user.name}</td>
                      <td style={{ padding: "8px 12px", textAlign: "center", color: "#666" }}>{ROLES[item.user.role]}</td>
                      <td style={{ padding: "8px 12px", textAlign: "center" }}>{item.orderCount}</td>
                      <td style={{ padding: "8px 12px", textAlign: "right" }}>
                        <div style={{ display: "flex", gap: "0.25rem", justifyContent: "flex-end", alignItems: "center" }}>
                          <input
                            type="number"
                            min={0}
                            value={isEditing ? editVal : item.baseSalary || ""}
                            placeholder="0"
                            onChange={e => setEditing(prev => ({ ...prev, [item.id]: e.target.value }))}
                            onKeyDown={e => { if (e.key === "Enter") saveBaseSalary(item.id); }}
                            style={{
                              width: 110,
                              padding: "4px 8px",
                              border: "1px solid var(--beige-dark)",
                              borderRadius: 6,
                              textAlign: "right",
                              background: isEditing ? "#fff8e1" : "white",
                            }}
                          />
                          {isEditing && (
                            <button
                              onClick={() => saveBaseSalary(item.id)}
                              disabled={savingId === item.id}
                              style={{
                                background: "var(--olive)",
                                color: "white",
                                border: "none",
                                borderRadius: 6,
                                padding: "4px 8px",
                                cursor: "pointer",
                                fontSize: "0.75rem",
                              }}
                            >
                              {savingId === item.id ? "..." : "✓"}
                            </button>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: "8px 12px", textAlign: "right" }}>฿{item.poolCommission.toLocaleString()}</td>
                      <td style={{ padding: "8px 12px", textAlign: "right" }}>฿{item.retailCommission.toLocaleString()}</td>
                      <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 700, color: "var(--olive)" }}>
                        ฿{item.totalAmount.toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="card" style={{ textAlign: "center", padding: "3rem" }}>
          <p style={{ color: "#aaa" }}>ยังไม่มีข้อมูลเงินเดือนเดือนนี้</p>
          <button className="btn-primary" onClick={generate}>⚙️ คำนวณเงินเดือน</button>
        </div>
      )}
    </div>
  );
}
