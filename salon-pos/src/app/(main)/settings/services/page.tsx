"use client";

import { useEffect, useState } from "react";

type Service = { id: string; name: string; price: number; duration: number; isActive: boolean; category: { name: string; id: string } };
type Category = { id: string; name: string };
type EditDraft = Record<string, { name: string; price: string }>;

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", price: "", duration: "60", categoryId: "" });

  // Bulk-edit state
  const [isEditing, setIsEditing] = useState(false);
  const [editDraft, setEditDraft] = useState<EditDraft>({});
  const [initialDraft, setInitialDraft] = useState<string>("");
  const [saving, setSaving] = useState(false);

  // PIN modal
  const [showPinModal, setShowPinModal] = useState(false);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");

  useEffect(() => {
    refresh();
    fetch("/api/categories").then(r => r.json()).then(data => {
      if (Array.isArray(data)) setCategories(data);
    });
  }, []);

  async function refresh() {
    const res = await fetch("/api/services");
    const data = await res.json();
    if (Array.isArray(data)) setServices(data);
  }

  /* ---- Bulk Edit ---- */

  function startEditMode() {
    // Ask for PIN before entering edit mode
    setShowPinModal(true);
  }

  function enterEditMode() {
    const draft: EditDraft = {};
    services.forEach(s => {
      draft[s.id] = { name: s.name, price: s.price.toString() };
    });
    setEditDraft(draft);
    setInitialDraft(JSON.stringify(draft));
    setIsEditing(true);
  }

  function cancelEdit() {
    setIsEditing(false);
    setEditDraft({});
    setInitialDraft("");
  }

  function updateDraft(id: string, field: "name" | "price", value: string) {
    setEditDraft(prev => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }));
  }

  const hasChanges = isEditing && JSON.stringify(editDraft) !== initialDraft;

  async function saveAllChanges() {
    if (!hasChanges) return;
    setSaving(true);

    // Find which services actually changed
    const initial: EditDraft = JSON.parse(initialDraft);
    const promises: Promise<Response>[] = [];

    for (const [id, draft] of Object.entries(editDraft)) {
      const orig = initial[id];
      if (!orig) continue;
      if (draft.name !== orig.name || draft.price !== orig.price) {
        promises.push(
          fetch(`/api/services/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: draft.name,
              price: Number(draft.price),
            }),
          })
        );
      }
    }

    await Promise.all(promises);
    await refresh();
    setSaving(false);
    setIsEditing(false);
    setEditDraft({});
    setInitialDraft("");
  }

  /* ---- PIN verify ---- */

  async function verifyPin() {
    setPinError("");
    const res = await fetch("/api/verify-pin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "OWNER", pin }),
    });

    if (res.ok) {
      setShowPinModal(false);
      setPin("");
      enterEditMode();
    } else {
      setPinError("PIN ไม่ถูกต้อง");
    }
  }

  /* ---- Add new service ---- */

  async function handleAddService() {
    if (!form.name || !form.price || !form.categoryId) {
      alert("กรุณากรอกข้อมูลให้ครบ");
      return;
    }

    await fetch("/api/services", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        price: Number(form.price),
        duration: Number(form.duration),
        categoryId: form.categoryId,
      }),
    });

    setShowForm(false);
    setForm({ name: "", price: "", duration: "60", categoryId: "" });
    refresh();
  }

  /* ---- Group by category ---- */

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
          {!isEditing ? (
            <>
              <button
                className="btn-secondary"
                onClick={startEditMode}
                disabled={services.length === 0}
                style={{ opacity: services.length === 0 ? 0.5 : 1 }}
              >
                ✏️ แก้ไขบริการ
              </button>
              <button className="btn-primary" onClick={() => { setForm({ name: "", price: "", duration: "60", categoryId: "" }); setShowForm(true); }}>
                + เพิ่มบริการ
              </button>
            </>
          ) : (
            <>
              <button
                className="btn-primary"
                onClick={saveAllChanges}
                disabled={!hasChanges || saving}
                style={{ opacity: hasChanges && !saving ? 1 : 0.5 }}
              >
                {saving ? "กำลังบันทึก..." : "💾 บันทึกทั้งหมด"}
              </button>
              <button className="btn-secondary" onClick={cancelEdit} disabled={saving}>
                ยกเลิก
              </button>
            </>
          )}
        </div>
      </div>

      {isEditing && (
        <div style={{
          background: "#fff8e1",
          border: "1px solid #ffe082",
          borderRadius: "8px",
          padding: "0.75rem 1rem",
          marginBottom: "1rem",
          fontSize: "0.875rem",
          color: "#6d4c00",
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
        }}>
          <span style={{ fontSize: "1.1rem" }}>📝</span>
          <span>โหมดแก้ไข — แก้ไขชื่อและราคาบริการได้โดยตรง จากนั้นกด &quot;บันทึกทั้งหมด&quot;</span>
        </div>
      )}

      {Object.entries(byCategory).map(([cat, svcs]) => (
        <div key={cat} className="card" style={{ marginBottom: "1rem" }}>
          <h3 style={{ margin: "0 0 1rem", color: "var(--olive)" }}>{cat}</h3>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem", tableLayout: "fixed" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--beige-dark)", color: "#666" }}>
                <th style={{ textAlign: "left", padding: "8px 12px", width: "70%" }}>บริการ</th>
                <th style={{ textAlign: "right", padding: "8px 12px", width: "30%" }}>ราคา (฿)</th>
              </tr>
            </thead>
            <tbody>
              {svcs.map(s => (
                <tr
                  key={s.id}
                  style={{
                    borderBottom: "1px solid #f9f9f9",
                    background: isEditing && editDraft[s.id] && (
                      editDraft[s.id].name !== s.name || editDraft[s.id].price !== s.price.toString()
                    ) ? "#f0f5e8" : "transparent",
                  }}
                >
                  <td style={{ padding: isEditing ? "4px 8px" : "8px 12px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {isEditing ? (
                      <input
                        className="input"
                        value={editDraft[s.id]?.name ?? s.name}
                        onChange={e => updateDraft(s.id, "name", e.target.value)}
                        style={{ width: "100%", padding: "6px 8px", fontSize: "0.875rem", margin: 0 }}
                      />
                    ) : (
                      s.name
                    )}
                  </td>
                  <td style={{ padding: isEditing ? "4px 8px" : "8px 12px", textAlign: "right" }}>
                    {isEditing ? (
                      <input
                        type="number"
                        className="input"
                        value={editDraft[s.id]?.price ?? s.price.toString()}
                        onChange={e => updateDraft(s.id, "price", e.target.value)}
                        style={{ width: "100%", padding: "6px 8px", fontSize: "0.875rem", textAlign: "right", margin: 0 }}
                      />
                    ) : (
                      Math.round(s.price).toLocaleString()
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {/* Add new service modal */}
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
            </div>
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "1.25rem" }}>
              <button
                className="btn-primary"
                style={{ flex: 1 }}
                onClick={handleAddService}
                disabled={!form.name || !form.price || !form.categoryId}
              >
                บันทึก
              </button>
              <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setShowForm(false)}>ยกเลิก</button>
            </div>
          </div>
        </div>
      )}

      {/* PIN modal */}
      {showPinModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 320 }}>
            <h3 style={{ margin: "0 0 1rem", color: "var(--olive)" }}>ยืนยันสิทธิ์ Owner</h3>
            <p style={{ fontSize: "0.875rem", color: "#666", marginBottom: "1rem" }}>กรุณากรอก PIN ของ Owner เพื่อเข้าสู่โหมดแก้ไข</p>
            <input
              type="password"
              className="input"
              placeholder="กรอก PIN"
              value={pin}
              onChange={e => setPin(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && verifyPin()}
              autoFocus
            />
            {pinError && <p style={{ color: "var(--alert-red)", fontSize: "0.75rem", marginTop: 4 }}>{pinError}</p>}
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "1.25rem" }}>
              <button className="btn-primary" style={{ flex: 1 }} onClick={verifyPin}>ยืนยัน</button>
              <button className="btn-secondary" style={{ flex: 1 }} onClick={() => { setShowPinModal(false); setPin(""); setPinError(""); }}>ยกเลิก</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
