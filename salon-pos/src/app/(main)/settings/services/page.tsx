"use client";

import { useEffect, useState } from "react";

type Service = { id: string; name: string; price: number; duration: number; isActive: boolean; category: { name: string } };
type Category = { id: string; name: string };

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", price: "", duration: "60", categoryId: "" });

  useEffect(() => {
    fetch("/api/services").then(r => r.json()).then(setServices);
    fetch("/api/categories").then(r => r.json()).then(setCategories);
  }, []);

  async function save() {
    if (!form.name || !form.price || !form.categoryId) { alert("กรุณากรอกข้อมูลให้ครบ"); return; }
    await fetch("/api/services", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: form.name, price: Number(form.price), duration: Number(form.duration), categoryId: form.categoryId }),
    });
    setShowForm(false);
    fetch("/api/services").then(r => r.json()).then(setServices);
  }

  const byCategory = services.reduce<Record<string, Service[]>>((acc, s) => {
    const cat = s.category.name;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(s);
    return acc;
  }, {});

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--olive)", margin: 0 }}>⚙️ จัดการบริการ</h1>
        <button className="btn-primary" onClick={() => setShowForm(true)}>+ เพิ่มบริการ</button>
      </div>

      {Object.entries(byCategory).map(([cat, svcs]) => (
        <div key={cat} className="card" style={{ marginBottom: "1rem" }}>
          <h3 style={{ margin: "0 0 1rem", color: "var(--olive)" }}>{cat}</h3>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--beige-dark)", color: "#666" }}>
                <th style={{ textAlign: "left", padding: "6px 8px" }}>บริการ</th>
                <th style={{ textAlign: "right", padding: "6px 8px" }}>ราคา</th>
                <th style={{ textAlign: "center", padding: "6px 8px" }}>เวลา (นาที)</th>
              </tr>
            </thead>
            <tbody>
              {svcs.map(s => (
                <tr key={s.id} style={{ borderBottom: "1px solid #f9f9f9" }}>
                  <td style={{ padding: "6px 8px" }}>{s.name}</td>
                  <td style={{ padding: "6px 8px", textAlign: "right" }}>฿{s.price.toLocaleString()}</td>
                  <td style={{ padding: "6px 8px", textAlign: "center" }}>{s.duration}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {showForm && (
        <div className="modal-overlay">
          <div className="modal">
            <h3 style={{ margin: "0 0 1rem", color: "var(--olive)" }}>เพิ่มบริการ</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <div>
                <label className="label">หมวดหมู่</label>
                <select className="input" value={form.categoryId} onChange={e => setForm({ ...form, categoryId: e.target.value })}>
                  <option value="">-- เลือกหมวดหมู่ --</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">ชื่อบริการ</label>
                <input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <label className="label">ราคา (บาท)</label>
                <input type="number" className="input" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} />
              </div>
              <div>
                <label className="label">เวลา (นาที)</label>
                <input type="number" className="input" value={form.duration} onChange={e => setForm({ ...form, duration: e.target.value })} />
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
