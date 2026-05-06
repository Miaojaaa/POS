"use client";

import { useEffect, useState } from "react";

type Expense = { id: string; category: string; description: string; amount: number; date: string; createdBy: { name: string } };

const CATEGORIES: Record<string, string> = {
  UTILITY: "ค่าสาธารณูปโภค",
  RENT: "ค่าเช่า",
  SUPPLIES: "วัสดุอุปกรณ์",
  SALARY: "เงินเดือน",
  OTHER: "อื่นๆ",
};

export default function ExpensesPage() {
  const today = new Date();
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [year, setYear] = useState(today.getFullYear());
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ category: "UTILITY", description: "", amount: "", date: today.toISOString().slice(0, 10) });

  async function load() {
    const res = await fetch(`/api/expenses?month=${month}&year=${year}`);
    setExpenses(await res.json());
  }

  useEffect(() => { load(); }, [month, year]);

  async function save() {
    if (!form.description || !form.amount) { alert("กรุณากรอกข้อมูลให้ครบ"); return; }
    await fetch("/api/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, amount: Number(form.amount) }),
    });
    setShowForm(false);
    load();
  }

  const total = expenses.reduce((s, e) => s + e.amount, 0);
  const byCategory = expenses.reduce<Record<string, number>>((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + e.amount;
    return acc;
  }, {});

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--olive)", margin: 0 }}>💸 ค่าใช้จ่าย</h1>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <select className="input" style={{ width: 120 }} value={month} onChange={e => setMonth(Number(e.target.value))}>
            {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>เดือน {i + 1}</option>)}
          </select>
          <select className="input" style={{ width: 100 }} value={year} onChange={e => setYear(Number(e.target.value))}>
            {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y + 543}</option>)}
          </select>
          <button className="btn-primary" onClick={() => setShowForm(true)}>+ เพิ่มค่าใช้จ่าย</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.5rem" }}>
        <div className="card">
          <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--alert-red)" }}>฿{total.toLocaleString()}</div>
          <div style={{ color: "#888" }}>ค่าใช้จ่ายทั้งหมด</div>
        </div>
        <div className="card">
          <div style={{ fontSize: "0.85rem", fontWeight: 600, marginBottom: 8 }}>แบ่งตามประเภท:</div>
          {Object.entries(byCategory).map(([cat, amt]) => (
            <div key={cat} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", marginBottom: 4 }}>
              <span>{CATEGORIES[cat] || cat}</span>
              <span style={{ fontWeight: 600 }}>฿{amt.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid var(--beige-dark)", color: "#666" }}>
              <th style={{ textAlign: "left", padding: "8px 12px" }}>วันที่</th>
              <th style={{ textAlign: "left", padding: "8px 12px" }}>ประเภท</th>
              <th style={{ textAlign: "left", padding: "8px 12px" }}>รายละเอียด</th>
              <th style={{ textAlign: "right", padding: "8px 12px" }}>จำนวนเงิน</th>
              <th style={{ textAlign: "center", padding: "8px 12px" }}>บันทึกโดย</th>
            </tr>
          </thead>
          <tbody>
            {expenses.map(e => (
              <tr key={e.id} style={{ borderBottom: "1px solid #f5f5f5" }}>
                <td style={{ padding: "8px 12px" }}>{e.date}</td>
                <td style={{ padding: "8px 12px" }}>{CATEGORIES[e.category] || e.category}</td>
                <td style={{ padding: "8px 12px" }}>{e.description}</td>
                <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 600 }}>฿{e.amount.toLocaleString()}</td>
                <td style={{ padding: "8px 12px", textAlign: "center", color: "#888" }}>{e.createdBy.name}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {expenses.length === 0 && <p style={{ color: "#aaa", textAlign: "center", padding: "2rem" }}>ไม่มีค่าใช้จ่าย</p>}
      </div>

      {showForm && (
        <div className="modal-overlay">
          <div className="modal">
            <h3 style={{ margin: "0 0 1rem", color: "var(--olive)" }}>เพิ่มค่าใช้จ่าย</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <div>
                <label className="label">ประเภท</label>
                <select className="input" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                  {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="label">รายละเอียด</label>
                <input className="input" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="เช่น ค่าไฟเดือนพฤษภาคม" />
              </div>
              <div>
                <label className="label">จำนวนเงิน (บาท)</label>
                <input type="number" className="input" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
              </div>
              <div>
                <label className="label">วันที่</label>
                <input type="date" className="input" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
              </div>
            </div>
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "1.25rem" }}>
              <button className="btn-primary" style={{ flex: 1 }} onClick={save}>บันทึก</button>
              <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setShowForm(false)}>ยกเลิก</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
