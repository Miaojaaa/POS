"use client";

import { useEffect, useState } from "react";

type Service = { id: string; name: string; price: number; duration: number; isActive: boolean; category: { name: string; id: string } };
type Category = { id: string; name: string };

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", price: "", duration: "60", categoryId: "" });
  
  const [showPinModal, setShowPinModal] = useState(false);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");

  useEffect(() => {
    refresh();
    fetch("/api/categories").then(r => r.json()).then(setCategories);
  }, []);

  async function refresh() {
    const res = await fetch("/api/services");
    setServices(await res.json());
  }

  function handleEdit() {
    const s = services.find(sv => sv.id === selectedServiceId);
    if (!s) return;
    
    setEditingId(s.id);
    setForm({
      name: s.name,
      price: s.price.toString(),
      duration: s.duration.toString(),
      categoryId: s.category.id,
    });
    setShowForm(true);
  }

  async function handleSaveClick() {
    if (!form.name || !form.price || !form.categoryId) { 
      alert("กรุณากรอกข้อมูลให้ครบ"); 
      return; 
    }

    if (editingId) {
      setShowPinModal(true);
    } else {
      save();
    }
  }

  async function verifyAndSave() {
    setPinError("");
    const res = await fetch("/api/verify-pin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "OWNER", pin }),
    });

    if (res.ok) {
      setShowPinModal(false);
      setPin("");
      save();
    } else {
      setPinError("PIN ไม่ถูกต้อง");
    }
  }

  async function save() {
    const url = editingId ? `/api/services/${editingId}` : "/api/services";
    const method = editingId ? "PATCH" : "POST";

    await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        name: form.name, 
        price: Number(form.price), 
        duration: Number(form.duration), 
        categoryId: form.categoryId 
      }),
    });

    setShowForm(false);
    setEditingId(null);
    setForm({ name: "", price: "", duration: "60", categoryId: "" });
    refresh();
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
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button 
            className="btn-secondary" 
            disabled={!selectedServiceId}
            onClick={handleEdit}
            style={{ opacity: selectedServiceId ? 1 : 0.5 }}
          >
            แก้ไขบริการ
          </button>
          <button className="btn-primary" onClick={() => { setEditingId(null); setSelectedServiceId(null); setForm({ name: "", price: "", duration: "60", categoryId: "" }); setShowForm(true); }}>
            + เพิ่มบริการ
          </button>
        </div>
      </div>

      {Object.entries(byCategory).map(([cat, svcs]) => (
        <div key={cat} className="card" style={{ marginBottom: "1rem" }}>
          <h3 style={{ margin: "0 0 1rem", color: "var(--olive)" }}>{cat}</h3>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--beige-dark)", color: "#666" }}>
                <th style={{ textAlign: "left", padding: "8px 12px" }}>บริการ</th>
                <th style={{ textAlign: "right", padding: "8px 12px" }}>ราคา (฿)</th>
                <th style={{ textAlign: "center", padding: "8px 12px" }}>เวลา (นาที)</th>
              </tr>
            </thead>
            <tbody>
              {svcs.map(s => (
                <tr 
                  key={s.id} 
                  style={{ 
                    borderBottom: "1px solid #f9f9f9", 
                    cursor: "pointer",
                    background: selectedServiceId === s.id ? "#f0f5e8" : "transparent"
                  }}
                  onClick={() => setSelectedServiceId(selectedServiceId === s.id ? null : s.id)}
                >
                  <td style={{ padding: "8px 12px" }}>{s.name}</td>
                  <td style={{ padding: "8px 12px", textAlign: "right" }}>{Math.round(s.price).toLocaleString()}</td>
                  <td style={{ padding: "8px 12px", textAlign: "center" }}>{s.duration}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {showForm && (
        <div className="modal-overlay">
          <div className="modal">
            <h3 style={{ margin: "0 0 1rem", color: "var(--olive)" }}>{editingId ? "แก้ไขบริการ" : "เพิ่มบริการ"}</h3>
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
              <button className="btn-primary" style={{ flex: 1 }} onClick={handleSaveClick}>บันทึก</button>
              <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setShowForm(false)}>ยกเลิก</button>
            </div>
          </div>
        </div>
      )}

      {showPinModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 320 }}>
            <h3 style={{ margin: "0 0 1rem", color: "var(--olive)" }}>ยืนยันสิทธิ์ Owner</h3>
            <p style={{ fontSize: "0.875rem", color: "#666", marginBottom: "1rem" }}>กรุณากรอก PIN ของ Owner เพื่อยืนยันการแก้ไขราคา</p>
            <input 
              type="password" 
              className="input" 
              placeholder="กรอก PIN" 
              value={pin} 
              onChange={e => setPin(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && verifyAndSave()}
              autoFocus
            />
            {pinError && <p style={{ color: "var(--alert-red)", fontSize: "0.75rem", marginTop: 4 }}>{pinError}</p>}
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "1.25rem" }}>
              <button className="btn-primary" style={{ flex: 1 }} onClick={verifyAndSave}>ยืนยัน</button>
              <button className="btn-secondary" style={{ flex: 1 }} onClick={() => { setShowPinModal(false); setPin(""); setPinError(""); }}>ยกเลิก</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
