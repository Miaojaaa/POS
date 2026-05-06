"use client";

import { useState, useEffect } from "react";

type Customer = {
  id: string;
  name: string;
  phone: string;
  birthdate?: string;
  allergyHistory?: string;
  walletBalance: number;
  memberLevel: string;
  createdAt: string;
};

const LEVEL_COLOR: Record<string, string> = {
  BASIC: "#888",
  SILVER: "#9e9e9e",
  GOLD: "#c9a227",
};

export default function MembersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [q, setQ] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", birthdate: "", allergyHistory: "", memberLevel: "BASIC" });

  async function load(search = "") {
    const res = await fetch(`/api/customers${search ? `?q=${encodeURIComponent(search)}` : ""}`);
    setCustomers(await res.json());
  }

  useEffect(() => { load(); }, []);

  function openNew() {
    setForm({ name: "", phone: "", birthdate: "", allergyHistory: "", memberLevel: "BASIC" });
    setEditing(null);
    setShowForm(true);
  }

  function openEdit(c: Customer) {
    setForm({ name: c.name, phone: c.phone, birthdate: c.birthdate || "", allergyHistory: c.allergyHistory || "", memberLevel: c.memberLevel });
    setEditing(c);
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.name || !form.phone) { alert("กรุณากรอกชื่อและเบอร์โทร"); return; }
    if (editing) {
      await fetch("/api/customers", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editing.id, ...form }),
      });
    } else {
      await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
    }
    setShowForm(false);
    load(q);
  }

  const filtered = customers.filter(c =>
    c.name.includes(q) || c.phone.includes(q)
  );

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--olive)", margin: 0 }}>👥 สมาชิก</h1>
        <button className="btn-primary" onClick={openNew}>+ เพิ่มสมาชิกใหม่</button>
      </div>

      <div style={{ marginBottom: "1rem" }}>
        <input
          className="input"
          style={{ maxWidth: 400 }}
          placeholder="ค้นหาชื่อหรือเบอร์โทร..."
          value={q}
          onChange={e => { setQ(e.target.value); load(e.target.value); }}
        />
      </div>

      <div className="card">
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid var(--beige-dark)", color: "#666" }}>
              <th style={{ textAlign: "left", padding: "8px 12px" }}>ชื่อ</th>
              <th style={{ textAlign: "left", padding: "8px 12px" }}>เบอร์โทร</th>
              <th style={{ textAlign: "center", padding: "8px 12px" }}>ระดับ</th>
              <th style={{ textAlign: "right", padding: "8px 12px" }}>Wallet</th>
              <th style={{ padding: "8px 12px" }}>ประวัติแพ้</th>
              <th style={{ padding: "8px 12px" }}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(c => (
              <tr key={c.id} style={{ borderBottom: "1px solid #f5f5f5" }}>
                <td style={{ padding: "8px 12px", fontWeight: 500 }}>{c.name}</td>
                <td style={{ padding: "8px 12px" }}>{c.phone}</td>
                <td style={{ padding: "8px 12px", textAlign: "center" }}>
                  <span style={{ color: LEVEL_COLOR[c.memberLevel], fontWeight: 600 }}>{c.memberLevel}</span>
                </td>
                <td style={{ padding: "8px 12px", textAlign: "right" }}>฿{c.walletBalance.toLocaleString()}</td>
                <td style={{ padding: "8px 12px" }}>
                  {c.allergyHistory && (
                    <span style={{ color: "var(--alert-red)", fontSize: "0.8rem" }}>⚠️ {c.allergyHistory.slice(0, 30)}</span>
                  )}
                </td>
                <td style={{ padding: "8px 12px" }}>
                  <button className="btn-secondary" style={{ fontSize: "0.8rem", padding: "3px 10px" }} onClick={() => openEdit(c)}>
                    แก้ไข
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p style={{ color: "#aaa", textAlign: "center", padding: "2rem" }}>ไม่พบสมาชิก</p>
        )}
      </div>

      {showForm && (
        <div className="modal-overlay">
          <div className="modal">
            <h3 style={{ margin: "0 0 1rem", color: "var(--olive)" }}>
              {editing ? "แก้ไขข้อมูลสมาชิก" : "เพิ่มสมาชิกใหม่"}
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <div>
                <label className="label">ชื่อ-นามสกุล *</label>
                <input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <label className="label">เบอร์โทร *</label>
                <input className="input" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} disabled={!!editing} />
              </div>
              <div>
                <label className="label">วันเกิด</label>
                <input type="date" className="input" value={form.birthdate} onChange={e => setForm({ ...form, birthdate: e.target.value })} />
              </div>
              <div>
                <label className="label">ระดับสมาชิก</label>
                <select className="input" value={form.memberLevel} onChange={e => setForm({ ...form, memberLevel: e.target.value })}>
                  <option value="BASIC">BASIC</option>
                  <option value="SILVER">SILVER</option>
                  <option value="GOLD">GOLD</option>
                </select>
              </div>
              {!editing && (
                <div>
                  <label className="label">ประวัติการแพ้สารเคมี</label>
                  <textarea className="input" rows={2} value={form.allergyHistory} onChange={e => setForm({ ...form, allergyHistory: e.target.value })} placeholder="ระบุถ้ามี..." />
                  <div style={{ fontSize: "0.75rem", color: "var(--alert-red)" }}>⚠️ ข้อมูลนี้จะถูกบันทึกถาวร แก้ไขไม่ได้</div>
                </div>
              )}
              {editing?.allergyHistory && (
                <div className="allergy-alert">⚠️ {editing.allergyHistory}</div>
              )}
            </div>
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "1.25rem" }}>
              <button className="btn-primary" style={{ flex: 1 }} onClick={handleSave}>บันทึก</button>
              <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setShowForm(false)}>ยกเลิก</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
