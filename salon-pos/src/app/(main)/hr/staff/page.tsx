"use client";

import { useEffect, useState } from "react";

type User = { id: string; name: string; email: string; role: string; phone?: string; baseSalary?: number; positionAllowance?: number; isActive: boolean };

const ROLE_ORDER = ["OWNER", "MANAGER", "CASHIER", "TECHNICIAN", "ASSISTANT"];
const ROLES: Record<string, string> = {
  OWNER: "👑 เจ้าของร้าน",
  MANAGER: "👔 ผู้จัดการ",
  CASHIER: "💵 แคชเชียร์",
  TECHNICIAN: "✂️ ช่าง",
  ASSISTANT: "🧴 ผู้ช่วยช่าง",
};

export default function StaffPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", email: "", password: "changeme123", role: "TECHNICIAN", phone: "", baseSalary: 0, positionAllowance: 0 });
  
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [unlockPin, setUnlockPin] = useState("");
  const [ownerPinStr, setOwnerPinStr] = useState("");

  const isChanged = () => {
    if (!editingId) return !!(form.name && form.email);
    const original = users.find(u => u.id === editingId);
    if (!original) return false;

    // Normalize values for comparison
    const currentPhone = form.phone || "";
    const originalPhone = original.phone || "";

    return (
      form.name !== original.name ||
      form.email !== original.email ||
      currentPhone !== originalPhone ||
      form.role !== original.role ||
      Number(form.baseSalary) !== Number(original.baseSalary || 0) ||
      Number(form.positionAllowance) !== Number(original.positionAllowance || 0)
    );
  };

  const handleClose = () => {
    if (isChanged()) {
      setShowExitConfirm(true);
    } else {
      setShowForm(false);
    }
  };

  useEffect(() => {
    fetch("/api/users").then(r => r.json()).then(setUsers);
  }, []);

  function handleAddClick() {
    if (!isUnlocked) {
      alert("กรุณาปลดล็อกสิทธิ์ก่อนเพิ่มพนักงาน");
      setShowUnlockModal(true);
      return;
    }
    setEditingId(null);
    setForm({ name: "", email: "", password: "changeme123", role: "TECHNICIAN", phone: "", baseSalary: 0, positionAllowance: 0 });
    setShowForm(true);
  }

  function handleEditClick(u: User) {
    setEditingId(u.id);
    setForm({ name: u.name, email: u.email, password: "", role: u.role, phone: u.phone || "", baseSalary: u.baseSalary || 0, positionAllowance: u.positionAllowance || 0 });
    setShowForm(true);
  }

  async function handleDelete(id: string) {
    if (!ownerPinStr) { alert("กรุณาปลดล็อกสิทธิ์ก่อน"); return; }
    const targetUser = users.find(u => u.id === id);
    if (!targetUser) return;
    if (confirm(`คุณต้องการลบรายชื่อพนักงาน: ${targetUser.name} ใช่หรือไม่?`)) {
      try {
        const res = await fetch(`/api/users/${id}?ownerPin=${ownerPinStr}`, {
          method: "DELETE",
        });
        if (res.ok) {
          setShowForm(false);
          fetch("/api/users").then(r => r.json()).then(setUsers);
        } else {
          const contentType = res.headers.get("content-type");
          if (contentType && contentType.includes("application/json")) {
            const err = await res.json();
            alert(err.error || "ลบไม่สำเร็จ");
          } else {
            alert("เกิดข้อผิดพลาดในการลบข้อมูล (Server Error)");
          }
        }
      } catch (err) {
        console.error("Delete error:", err);
        alert("การเชื่อมต่อล้มเหลว");
      }
    }
  }

  async function handleUnlock() {
    try {
      const res = await fetch("/api/verify-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "OWNER", pin: unlockPin }),
      });
      if (res.ok) {
        setIsUnlocked(true);
        setOwnerPinStr(unlockPin);
        setShowUnlockModal(false);
        setUnlockPin("");
      } else {
        alert("รหัส PIN ไม่ถูกต้อง");
      }
    } catch (err) {
      alert("ไม่สามารถเชื่อมต่อระบบตรวจสอบ PIN ได้");
    }
  }

  async function handleSave() {
    if (!form.name || !form.email) { alert("กรุณากรอกชื่อและอีเมล"); return; }
    
    try {
      if (editingId) {
        if (!ownerPinStr) { alert("กรุณาปลดล็อกด้วย Owner PIN ก่อน"); return; }
        const res = await fetch(`/api/users/${editingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...form, ownerPin: ownerPinStr }),
        });
        if (res.ok) {
          setShowForm(false);
          fetch("/api/users").then(r => r.json()).then(setUsers);
        } else {
          const contentType = res.headers.get("content-type");
          if (contentType && contentType.includes("application/json")) {
            const err = await res.json();
            alert(err.error || "แก้ไขไม่สำเร็จ");
          } else {
            alert("เกิดข้อผิดพลาดในการแก้ไขข้อมูล (Server Error)");
          }
        }
      } else {
        const res = await fetch("/api/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...form, ownerPin: ownerPinStr }),
        });
        if (res.ok) {
          setShowForm(false);
          fetch("/api/users").then(r => r.json()).then(setUsers);
        } else {
          const contentType = res.headers.get("content-type");
          if (contentType && contentType.includes("application/json")) {
            const err = await res.json();
            alert(err.error || "เพิ่มพนักงานไม่สำเร็จ");
          } else {
            alert("เกิดข้อผิดพลาดในการเพิ่มข้อมูล (Server Error)");
          }
        }
      }
    } catch (err) {
      console.error("Save error:", err);
      alert("การเชื่อมต่อล้มเหลว");
    }
  }

  const byRole = users.reduce<Record<string, User[]>>((acc, u) => {
    const roles = u.role.split(",");
    roles.forEach(r => {
      if (!acc[r]) acc[r] = [];
      acc[r].push(u);
    });
    return acc;
  }, {});

  const sortedRoles = Object.keys(byRole).sort((a, b) => {
    const ia = ROLE_ORDER.indexOf(a);
    const ib = ROLE_ORDER.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });

  const toggleRole = (r: string) => {
    const currentRoles = form.role.split(",").filter(Boolean);
    if (currentRoles.includes(r)) {
      if (currentRoles.length > 1) {
        setForm({ ...form, role: currentRoles.filter(x => x !== r).join(",") });
      } else {
        alert("ต้องมีอย่างน้อย 1 ตำแหน่ง");
      }
    } else {
      setForm({ ...form, role: [...currentRoles, r].join(",") });
    }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--olive)", margin: 0 }}>👤 พนักงาน</h1>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          {!isUnlocked && (
            <button className="btn-secondary" onClick={() => setShowUnlockModal(true)}>
              🔒 ปลดล็อกสิทธิ์แก้ไข
            </button>
          )}
          {isUnlocked && (
            <button className="btn-secondary" onClick={() => { setIsUnlocked(false); setOwnerPinStr(""); }}>
              🔓 ล็อกสิทธิ์แก้ไข
            </button>
          )}
          <button 
            className="btn-primary" 
            onClick={handleAddClick}
            style={{ opacity: isUnlocked ? 1 : 0.6 }}
          >
            + เพิ่มพนักงาน
          </button>
        </div>
      </div>

      {sortedRoles.map((role) => {
        const staff = byRole[role];
        return (
        <div key={role} style={{ marginBottom: "1.5rem" }}>
          <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--olive)", marginBottom: "0.75rem" }}>
            {ROLES[role] || role} ({staff.length} คน)
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "0.75rem" }}>
            {staff.map(u => (
              <div key={u.id} className="card" style={{ position: "relative" }}>
                {isUnlocked && (
                  <button 
                    onClick={() => handleEditClick(u)}
                    style={{ position: "absolute", top: 8, right: 8, background: "none", border: "none", cursor: "pointer", fontSize: "1.2rem" }}
                    title="แก้ไข"
                  >
                    ✏️
                  </button>
                )}
                <div style={{ fontWeight: 700, marginBottom: 4 }}>{u.name}</div>
                <div style={{ fontSize: "0.8rem", color: "#888" }}>{u.email}</div>
                {u.phone && <div style={{ fontSize: "0.8rem", color: "#888" }}>📞 {u.phone}</div>}
                <div style={{ fontSize: "0.8rem", marginTop: 4, color: (u.baseSalary || 0) > 0 ? "var(--olive)" : "#aaa", fontWeight: 600 }}>
                  💰 เงินเดือน: ฿{(u.baseSalary || 0).toLocaleString()}
                </div>
                <div style={{ fontSize: "0.8rem", color: (u.positionAllowance || 0) > 0 ? "var(--olive)" : "#aaa", fontWeight: 600 }}>
                  🎖️ ค่าตำแหน่ง: ฿{(u.positionAllowance || 0).toLocaleString()}
                </div>
                <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: "4px" }}>
                  {u.role.split(",").map(r => (
                    <span key={r} style={{ fontSize: "0.75rem", background: "#f5f5f5", padding: "2px 8px", borderRadius: 8, color: "#666" }}>
                      {ROLES[r] || r}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
        );
      })}

      {showUnlockModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 300 }}>
            <h3 style={{ margin: "0 0 1rem", color: "var(--olive)" }}>🔒 ปลดล็อกสิทธิ์แก้ไข</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <div>
                <label className="label">รหัส Owner PIN</label>
                <input 
                  type="password" 
                  placeholder="ใส่รหัส" 
                  className="input" 
                  value={unlockPin} 
                  onChange={e => setUnlockPin(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleUnlock()}
                  autoFocus
                />
              </div>
            </div>
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "1.25rem" }}>
              <button className="btn-primary" style={{ flex: 1 }} onClick={handleUnlock}>ยืนยัน</button>
              <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setShowUnlockModal(false)}>ยกเลิก</button>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <div className="modal-overlay">
          <div className="modal" style={{ position: "relative" }}>
            <button 
              onClick={handleClose}
              style={{
                position: "absolute",
                top: "1rem",
                right: "1rem",
                background: "none",
                border: "none",
                fontSize: "1.5rem",
                cursor: "pointer",
                color: "#999",
                lineHeight: 1
              }}
            >
              ×
            </button>
            <h3 style={{ margin: "0 0 1rem", color: "var(--olive)" }}>{editingId ? "แก้ไขข้อมูลพนักงาน" : "เพิ่มพนักงาน"}</h3>
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
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                <div>
                  <label className="label">💰 เงินเดือนพื้นฐาน (บาท)</label>
                  <input
                    type="number"
                    className="input"
                    min={0}
                    step={100}
                    placeholder="0"
                    value={form.baseSalary || ""}
                    onChange={e => setForm({ ...form, baseSalary: Number(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <label className="label">🎖️ ค่าตำแหน่ง (บาท)</label>
                  <input
                    type="number"
                    className="input"
                    min={0}
                    step={100}
                    placeholder="0"
                    value={form.positionAllowance || ""}
                    onChange={e => setForm({ ...form, positionAllowance: Number(e.target.value) || 0 })}
                  />
                </div>
                <div style={{ gridColumn: "1 / -1", fontSize: "0.75rem", color: "#888", marginTop: -2 }}>
                  จะแสดงในหน้า เงินเดือน &amp; ค่าคอม โดยอัตโนมัติ
                </div>
              </div>
              <div>
                <label className="label">ตำแหน่ง (เลือกได้หลายข้อ)</label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", padding: "0.5rem", background: "#f9f9f9", borderRadius: 8 }}>
                  {Object.entries(ROLES).map(([k, v]) => (
                    <label key={k} style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.9rem", cursor: "pointer" }}>
                      <input 
                        type="checkbox" 
                        checked={form.role.split(",").includes(k)} 
                        onChange={() => toggleRole(k)} 
                      />
                      {v}
                    </label>
                  ))}
                </div>
              </div>
              {!editingId && (
                <div>
                  <label className="label">รหัสผ่านเริ่มต้น</label>
                  <input className="input" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
                </div>
              )}
            </div>
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "1.25rem" }}>
              <button 
                className="btn-primary" 
                style={{ flex: 1, opacity: isChanged() ? 1 : 0.5, cursor: isChanged() ? "pointer" : "not-allowed" }} 
                onClick={handleSave}
                disabled={!isChanged()}
              >
                บันทึก
              </button>
              {editingId && (
                <button className="btn-secondary" style={{ flex: 1, background: "#dc3545", color: "white", border: "none" }} onClick={() => handleDelete(editingId)}>
                  ลบพนักงาน
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {showExitConfirm && (
        <div className="modal-overlay" style={{ zIndex: 1100 }}>
          <div className="modal" style={{ maxWidth: 320, textAlign: "center" }}>
            <h3 style={{ margin: "0 0 1rem", color: "var(--olive)" }}>ยืนยันการยกเลิก?</h3>
            <p style={{ fontSize: "0.9rem", color: "#666", marginBottom: "1.5rem" }}>
              ข้อมูลที่คุณแก้ไขยังไม่ได้บันทึก ต้องการยกเลิกการแก้ไขใช่หรือไม่?
            </p>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button 
                className="btn-secondary" 
                style={{ flex: 1, background: "#dc3545", color: "white", border: "none" }} 
                onClick={() => { setShowExitConfirm(false); setShowForm(false); }}
              >
                ใช่, ยกเลิก
              </button>
              <button 
                className="btn-primary" 
                style={{ flex: 1 }} 
                onClick={() => setShowExitConfirm(false)}
              >
                ไม่, แก้ไขต่อ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
