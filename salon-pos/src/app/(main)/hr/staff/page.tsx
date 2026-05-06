"use client";

import { useEffect, useState } from "react";

type User = { id: string; name: string; email: string; role: string; phone?: string; isActive: boolean };

const ROLES: Record<string, string> = {
  OWNER: "เจ้าของร้าน",
  MANAGER: "ผู้จัดการ",
  CASHIER: "แคชเชียร์",
  TECHNICIAN: "ช่าง",
  ASSISTANT: "ผู้ช่วยช่าง",
};

export default function StaffPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "changeme123", role: "TECHNICIAN", phone: "" });

  useEffect(() => {
    fetch("/api/users").then(r => r.json()).then(setUsers);
  }, []);

  async function handleAdd() {
    if (!form.name || !form.email) { alert("กรุณากรอกชื่อและอีเมล"); return; }
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setShowForm(false);
      fetch("/api/users").then(r => r.json()).then(setUsers);
    }
  }

  const byRole = users.reduce<Record<string, User[]>>((acc, u) => {
    if (!acc[u.role]) acc[u.role] = [];
    acc[u.role].push(u);
    return acc;
  }, {});

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--olive)", margin: 0 }}>👤 พนักงาน</h1>
        <button className="btn-primary" onClick={() => setShowForm(true)}>+ เพิ่มพนักงาน</button>
      </div>

      {Object.entries(byRole).map(([role, staff]) => (
        <div key={role} style={{ marginBottom: "1.5rem" }}>
          <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--olive)", marginBottom: "0.75rem" }}>
            {ROLES[role] || role} ({staff.length} คน)
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "0.75rem" }}>
            {staff.map(u => (
              <div key={u.id} className="card">
                <div style={{ fontWeight: 700, marginBottom: 4 }}>{u.name}</div>
                <div style={{ fontSize: "0.8rem", color: "#888" }}>{u.email}</div>
                {u.phone && <div style={{ fontSize: "0.8rem", color: "#888" }}>📞 {u.phone}</div>}
                <div style={{ marginTop: 8, fontSize: "0.8rem", background: "#f5f5f5", padding: "2px 8px", borderRadius: 8, display: "inline-block" }}>
                  {ROLES[u.role]}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {showForm && (
        <div className="modal-overlay">
          <div className="modal">
            <h3 style={{ margin: "0 0 1rem", color: "var(--olive)" }}>เพิ่มพนักงาน</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <div>
                <label className="label">ชื่อ</label>
                <input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <label className="label">อีเมล</label>
                <input type="email" className="input" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
              </div>
              <div>
                <label className="label">เบอร์โทร</label>
                <input className="input" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div>
                <label className="label">ตำแหน่ง</label>
                <select className="input" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                  {Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="label">รหัสผ่านเริ่มต้น</label>
                <input className="input" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
              </div>
            </div>
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "1.25rem" }}>
              <button className="btn-primary" style={{ flex: 1 }} onClick={handleAdd}>บันทึก</button>
              <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setShowForm(false)}>ยกเลิก</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
