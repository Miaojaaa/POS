"use client";

import { useEffect, useState } from "react";
import { useBranch } from "@/context/BranchContext";
import { Settings, PlusCircle, FolderPlus, Edit, Trash2, Lock } from "lucide-react";

type Service = { id: string; name: string; price: number; duration: number; isActive: boolean };
type Category = { id: string; name: string; groupId: string | null; services: Service[] };
type Group = { id: string; name: string; sortOrder: number; categories: Category[] };
type EditDraft = Record<string, { name: string; price: string }>;

const stripEmoji = (s: string) => s.replace(/[\u{1F300}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F1E6}-\u{1F1FF}\u2728\u2B50\uFE0F]/gu, '').trim();

export default function ServicesPage() {
  const [groups, setGroups] = useState<Group[]>([]);

  // Add service form
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", price: "", duration: "60", categoryId: "" });
  const [formGroupId, setFormGroupId] = useState<string>("");

  // Inline add inside "Add service" modal
  const [inlineNewGroup, setInlineNewGroup] = useState<string | null>(null);
  const [inlineNewCat, setInlineNewCat] = useState<string | null>(null);
  const [inlineError, setInlineError] = useState("");
  const [inlineSaving, setInlineSaving] = useState(false);

  // Bulk-edit state
  const [isEditing, setIsEditing] = useState(false);
  const [editDraft, setEditDraft] = useState<EditDraft>({});
  const [initialDraft, setInitialDraft] = useState<string>("");
  const [saving, setSaving] = useState(false);

  // PIN modal
  const [showPinModal, setShowPinModal] = useState(false);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");

  // Group: add/edit/delete
  const [showAddGroup, setShowAddGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [groupError, setGroupError] = useState("");
  const [groupSaving, setGroupSaving] = useState(false);

  const [editGroupTarget, setEditGroupTarget] = useState<Group | null>(null);
  const [editGroupName, setEditGroupName] = useState("");

  const [deleteGroupTarget, setDeleteGroupTarget] = useState<Group | null>(null);
  const [deleteGroupError, setDeleteGroupError] = useState("");

  // Category: add/edit/move/delete
  const [addCatGroupId, setAddCatGroupId] = useState<string | null>(null);
  const [newCatName, setNewCatName] = useState("");
  const [addCatError, setAddCatError] = useState("");
  const [addCatSaving, setAddCatSaving] = useState(false);

  const [editCatTarget, setEditCatTarget] = useState<Category | null>(null);
  const [editCatName, setEditCatName] = useState("");
  const [editCatGroupId, setEditCatGroupId] = useState<string>("");

  const [deleteCatTarget, setDeleteCatTarget] = useState<Category | null>(null);
  const [deleteCatError, setDeleteCatError] = useState("");

  useEffect(() => { refresh(); }, []);

  async function refresh() {
    const res = await fetch("/api/service-groups");
    const data = await res.json();
    if (Array.isArray(data)) setGroups(data);
  }

  // Flat list helpers
  const allCategories: Category[] = groups.flatMap(g => g.categories);
  const allServices: { svc: Service; cat: Category; group: Group }[] = groups.flatMap(g =>
    g.categories.flatMap(c => c.services.map(s => ({ svc: s, cat: c, group: g })))
  );

  /* ---- Bulk Edit ---- */

  function startEditMode() {
    setShowPinModal(true);
  }

  function enterEditMode() {
    const draft: EditDraft = {};
    allServices.forEach(({ svc }) => {
      draft[svc.id] = { name: svc.name, price: svc.price.toString() };
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
    setEditDraft(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  }

  const hasChanges = isEditing && JSON.stringify(editDraft) !== initialDraft;

  async function saveAllChanges() {
    if (!hasChanges) return;
    setSaving(true);
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
            body: JSON.stringify({ name: draft.name, price: Number(draft.price) }),
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

  /* ---- Group CRUD ---- */

  async function handleAddGroup() {
    if (!newGroupName.trim()) return;
    setGroupError("");
    setGroupSaving(true);
    const res = await fetch("/api/service-groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newGroupName.trim() }),
    });
    setGroupSaving(false);
    if (!res.ok) {
      const data = await res.json();
      setGroupError(data.error ?? "เกิดข้อผิดพลาด");
      return;
    }
    setShowAddGroup(false);
    setNewGroupName("");
    await refresh();
  }

  async function handleEditGroup() {
    if (!editGroupTarget || !editGroupName.trim()) return;
    setGroupError("");
    const res = await fetch(`/api/service-groups/${editGroupTarget.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editGroupName.trim() }),
    });
    if (!res.ok) {
      const data = await res.json();
      setGroupError(data.error ?? "เกิดข้อผิดพลาด");
      return;
    }
    setEditGroupTarget(null);
    setEditGroupName("");
    await refresh();
  }

  async function confirmDeleteGroup() {
    if (!deleteGroupTarget) return;
    setDeleteGroupError("");
    const res = await fetch(`/api/service-groups/${deleteGroupTarget.id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json();
      setDeleteGroupError(data.error ?? "เกิดข้อผิดพลาด");
      return;
    }
    if (formGroupId === deleteGroupTarget.id) {
      setFormGroupId("");
      setForm(f => ({ ...f, categoryId: "" }));
    }
    setDeleteGroupTarget(null);
    await refresh();
  }

  /* ---- Category CRUD ---- */

  async function handleAddCategory() {
    if (!newCatName.trim() || !addCatGroupId) return;
    setAddCatError("");
    setAddCatSaving(true);
    const res = await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newCatName.trim(), groupId: addCatGroupId }),
    });
    setAddCatSaving(false);
    if (!res.ok) {
      const data = await res.json();
      setAddCatError(data.error ?? "เกิดข้อผิดพลาด");
      return;
    }
    setAddCatGroupId(null);
    setNewCatName("");
    await refresh();
  }

  async function handleEditCategory() {
    if (!editCatTarget || !editCatName.trim()) return;
    setAddCatError("");
    const res = await fetch(`/api/categories/${editCatTarget.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editCatName.trim(), groupId: editCatGroupId || null }),
    });
    if (!res.ok) {
      const data = await res.json();
      setAddCatError(data.error ?? "เกิดข้อผิดพลาด");
      return;
    }
    setEditCatTarget(null);
    setEditCatName("");
    setEditCatGroupId("");
    await refresh();
  }

  async function confirmDeleteCategory() {
    if (!deleteCatTarget) return;
    setDeleteCatError("");
    const res = await fetch(`/api/categories/${deleteCatTarget.id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json();
      setDeleteCatError(data.error ?? "เกิดข้อผิดพลาด");
      return;
    }
    if (form.categoryId === deleteCatTarget.id) setForm(f => ({ ...f, categoryId: "" }));
    setDeleteCatTarget(null);
    await refresh();
  }

  /* ---- Inline add inside "Add service" modal ---- */

  async function inlineAddGroup() {
    if (!inlineNewGroup?.trim()) return;
    setInlineError("");
    setInlineSaving(true);
    const res = await fetch("/api/service-groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: inlineNewGroup.trim() }),
    });
    const data = await res.json();
    setInlineSaving(false);
    if (!res.ok) { setInlineError(data.error ?? "เกิดข้อผิดพลาด"); return; }
    setInlineNewGroup(null);
    await refresh();
    setFormGroupId(data.id);
  }

  async function inlineAddCat() {
    if (!inlineNewCat?.trim() || !formGroupId) return;
    setInlineError("");
    setInlineSaving(true);
    const res = await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: inlineNewCat.trim(), groupId: formGroupId }),
    });
    const data = await res.json();
    setInlineSaving(false);
    if (!res.ok) { setInlineError(data.error ?? "เกิดข้อผิดพลาด"); return; }
    setInlineNewCat(null);
    await refresh();
    setForm(f => ({ ...f, categoryId: data.id }));
  }

  /* ---- Add service ---- */

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
    await refresh();
  }

  /* ---- Render ---- */

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", flexWrap: "wrap", gap: "0.5rem" }}>
        <h1 style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "1.4rem", fontWeight: 700, color: "var(--olive)", margin: 0 }}>
          <Settings size={24} /> จัดการบริการ
        </h1>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          {!isEditing ? (
            <>
              <button
                className="btn-secondary"
                onClick={startEditMode}
                disabled={allServices.length === 0}
                style={{ opacity: allServices.length === 0 ? 0.5 : 1 }}
              >
                แก้ไขบริการ
              </button>
              <button className="btn-primary" onClick={() => {
                setForm({ name: "", price: "", duration: "60", categoryId: "" });
                setFormGroupId("");
                setInlineNewGroup(null);
                setInlineNewCat(null);
                setInlineError("");
                setShowForm(true);
              }}>
                + เพิ่มบริการ
              </button>
            </>
          ) : (
            <>
              <button
                className="btn-primary"
                onClick={saveAllChanges}
                disabled={!hasChanges || saving}
              >
                {saving ? "กำลังบันทึก..." : "บันทึกทั้งหมด"}
              </button>
              <button className="btn-secondary" onClick={cancelEdit} disabled={saving}>ยกเลิก</button>
            </>
          )}
        </div>
      </div>

      {isEditing && (
        <div style={{
          background: "#fff8e1", border: "1px solid #ffe082", borderRadius: 8,
          padding: "0.75rem 1rem", marginBottom: "1rem", fontSize: "0.875rem", color: "#6d4c00",
          display: "flex", alignItems: "center", gap: "0.5rem",
        }}>
          <span style={{ fontSize: "1.1rem" }}>📝</span>
          <span>โหมดแก้ไข — แก้ชื่อและราคาบริการได้โดยตรง จากนั้นกด &quot;บันทึกทั้งหมด&quot;</span>
        </div>
      )}

      {groups.length === 0 && (
        <div className="card" style={{ textAlign: "center", padding: "2rem", color: "#999" }}>
          ยังไม่มีหมวดหมู่ใหญ่ — กด &quot;+ หมวดหมู่ใหญ่&quot; เพื่อเริ่มต้น
        </div>
      )}

      {groups.map(group => (
        <div key={group.id} className="card" style={{ marginBottom: "1.25rem" }}>
          {/* Group header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", borderBottom: "2px solid var(--beige-dark)", paddingBottom: "0.5rem" }}>
            <h2 style={{ margin: 0, color: "var(--olive)", fontSize: "1.15rem" }}>{group.name}</h2>
            <div style={{ display: "flex", gap: "0.25rem" }}>
              <button
                onClick={() => { setAddCatGroupId(group.id); setNewCatName(""); setAddCatError(""); }}
                style={{ background: "none", border: "1px solid var(--beige-dark)", borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontSize: "0.8rem" }}
                title="เพิ่มหมวดหมู่ย่อย"
              >
                + หมวดหมู่ย่อย
              </button>
              <button
                onClick={() => { setEditGroupTarget(group); setEditGroupName(group.name); setGroupError(""); }}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: "0.95rem", padding: "4px 8px" }}
                title="แก้ไขชื่อ"
              >
                <Edit size={16} />
              </button>
              <button
                onClick={() => { setDeleteGroupTarget(group); setDeleteGroupError(""); }}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#e53e3e", fontSize: "0.95rem", padding: "4px 8px" }}
                title="ลบหมวดหมู่ใหญ่"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>

          {/* Categories in group */}
          {group.categories.length === 0 ? (
            <div style={{ color: "#999", fontSize: "0.875rem", fontStyle: "italic", padding: "0.5rem 0" }}>
              ยังไม่มีหมวดหมู่ย่อยในกลุ่มนี้
            </div>
          ) : group.categories.map(cat => (
            <div key={cat.id} style={{ marginBottom: "1rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                <h3 style={{ margin: 0, color: "var(--olive-dark, #555)", fontSize: "0.95rem", fontWeight: 600 }}>
                  {stripEmoji(cat.name)} <span style={{ color: "#999", fontWeight: 400, fontSize: "0.8rem" }}>({cat.services.length})</span>
                </h3>
                {isEditing && (
                  <div style={{ display: "flex", gap: "0.25rem" }}>
                    <button
                      onClick={() => { setEditCatTarget(cat); setEditCatName(cat.name); setEditCatGroupId(cat.groupId ?? ""); setAddCatError(""); }}
                      style={{ background: "none", border: "none", cursor: "pointer", fontSize: "0.85rem", padding: "2px 6px" }}
                      title="แก้ไข / ย้ายกลุ่ม"
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      onClick={() => { setDeleteCatTarget(cat); setDeleteCatError(""); }}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "#e53e3e", fontSize: "0.85rem", padding: "2px 6px" }}
                      title="ลบหมวดหมู่ย่อย"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}
              </div>
              {cat.services.length === 0 ? (
                <div style={{ color: "#bbb", fontSize: "0.8rem", fontStyle: "italic", paddingLeft: "0.5rem" }}>ยังไม่มีบริการ</div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem", tableLayout: "fixed" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--beige-dark)", color: "#666" }}>
                      <th style={{ textAlign: "left", padding: "6px 12px", width: "70%" }}>บริการ</th>
                      <th style={{ textAlign: "right", padding: "6px 12px", width: "30%" }}>ราคา (฿)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cat.services.map(s => (
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
                          ) : s.name}
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
                          ) : Math.round(s.price).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ))}
        </div>
      ))}

      {/* Add service modal */}
      {showForm && (() => {
        const selectedGroup = groups.find(g => g.id === formGroupId);
        const selectedCat = selectedGroup?.categories.find(c => c.id === form.categoryId);
        const iconBtn: React.CSSProperties = {
          background: "none", border: "1px solid var(--beige-dark)", borderRadius: 6,
          padding: "0 10px", cursor: "pointer", fontSize: "0.9rem", height: 38, minWidth: 38,
        };
        return (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 440 }}>
            <h3 style={{ display: "flex", alignItems: "center", gap: "0.5rem", margin: "0 0 1rem", color: "var(--olive)" }}>
              <PlusCircle size={18} /> เพิ่มบริการ
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>

              {/* Group selector */}
              <div>
                <label className="label">หมวดหมู่ใหญ่</label>
                {inlineNewGroup !== null ? (
                  <div style={{ display: "flex", gap: 6 }}>
                    <input
                      className="input"
                      placeholder="ชื่อหมวดหมู่ใหญ่ใหม่ (เช่น 💆 ความงาม)"
                      value={inlineNewGroup}
                      onChange={e => setInlineNewGroup(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && inlineAddGroup()}
                      autoFocus
                      style={{ flex: 1, margin: 0 }}
                    />
                    <button style={iconBtn} onClick={inlineAddGroup} disabled={!inlineNewGroup.trim() || inlineSaving} title="บันทึก">✓</button>
                    <button style={iconBtn} onClick={() => { setInlineNewGroup(null); setInlineError(""); }} title="ยกเลิก">✕</button>
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: 6 }}>
                    <select
                      className="input"
                      value={formGroupId}
                      onChange={e => { setFormGroupId(e.target.value); setForm(f => ({ ...f, categoryId: "" })); }}
                      style={{ flex: 1, margin: 0 }}
                    >
                      <option value="">-- เลือกหมวดหมู่ใหญ่ --</option>
                      {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                    </select>
                    <button
                      style={iconBtn}
                      onClick={() => { setInlineNewGroup(""); setInlineError(""); }}
                      title="เพิ่มหมวดหมู่ใหญ่ใหม่"
                    >➕</button>
                    {selectedGroup && (
                      <button
                        style={{ ...iconBtn, color: "#e53e3e" }}
                        onClick={() => { setDeleteGroupTarget(selectedGroup); setDeleteGroupError(""); }}
                        title="ลบหมวดหมู่ใหญ่นี้"
                      ><Trash2 size={16} /></button>
                    )}
                  </div>
                )}
              </div>

              {/* Category selector — filtered by selected group */}
              <div>
                <label className="label">หมวดหมู่ย่อย</label>
                {inlineNewCat !== null ? (
                  <div style={{ display: "flex", gap: 6 }}>
                    <input
                      className="input"
                      placeholder="ชื่อหมวดหมู่ย่อยใหม่"
                      value={inlineNewCat}
                      onChange={e => setInlineNewCat(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && inlineAddCat()}
                      autoFocus
                      style={{ flex: 1, margin: 0 }}
                    />
                    <button style={iconBtn} onClick={inlineAddCat} disabled={!inlineNewCat.trim() || inlineSaving} title="บันทึก">✓</button>
                    <button style={iconBtn} onClick={() => { setInlineNewCat(null); setInlineError(""); }} title="ยกเลิก">✕</button>
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: 6 }}>
                    <select
                      className="input"
                      value={form.categoryId}
                      onChange={e => setForm({ ...form, categoryId: e.target.value })}
                      disabled={!formGroupId}
                      style={{ flex: 1, margin: 0 }}
                    >
                      <option value="">{formGroupId ? "-- เลือกหมวดหมู่ย่อย --" : "(เลือกหมวดหมู่ใหญ่ก่อน)"}</option>
                      {selectedGroup?.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <button
                      style={iconBtn}
                      onClick={() => { setInlineNewCat(""); setInlineError(""); }}
                      disabled={!formGroupId}
                      title="เพิ่มหมวดหมู่ย่อยใหม่"
                    >➕</button>
                    {selectedCat && (
                      <button
                        style={{ ...iconBtn, color: "#e53e3e" }}
                        onClick={() => { setDeleteCatTarget(selectedCat); setDeleteCatError(""); }}
                        title="ลบหมวดหมู่ย่อยนี้"
                      ><Trash2 size={16} /></button>
                    )}
                  </div>
                )}
              </div>

              {inlineError && <p style={{ color: "var(--alert-red)", fontSize: "0.8rem", margin: 0 }}>{inlineError}</p>}

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
              <button className="btn-primary" style={{ flex: 1 }} onClick={handleAddService} disabled={!form.name || !form.price || !form.categoryId}>
                บันทึก
              </button>
              <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setShowForm(false)}>ยกเลิก</button>
            </div>
          </div>
        </div>
        );
      })()}

      {/* Add group modal */}
      {showAddGroup && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 360 }}>
            <h3 style={{ display: "flex", alignItems: "center", gap: "0.5rem", margin: "0 0 0.5rem", color: "var(--olive)" }}>
              <FolderPlus size={18} /> เพิ่มหมวดหมู่ใหญ่
            </h3>
            <p style={{ fontSize: "0.8rem", color: "#888", marginBottom: "1rem" }}>เช่น &quot;ผม&quot;, &quot;เล็บ&quot; — ใส่อีโมจิด้านหน้าเพื่อให้แสดงเป็น tab ใน POS</p>
            <input
              className="input"
              placeholder="ชื่อหมวดหมู่ใหญ่"
              value={newGroupName}
              onChange={e => setNewGroupName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleAddGroup()}
              autoFocus
            />
            {groupError && <p style={{ color: "var(--alert-red)", fontSize: "0.8rem", marginTop: 4 }}>{groupError}</p>}
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "1.25rem" }}>
              <button className="btn-primary" style={{ flex: 1 }} onClick={handleAddGroup} disabled={!newGroupName.trim() || groupSaving}>
                {groupSaving ? "กำลังบันทึก..." : "บันทึก"}
              </button>
              <button className="btn-secondary" style={{ flex: 1 }} onClick={() => { setShowAddGroup(false); setGroupError(""); }}>ยกเลิก</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit group modal */}
      {editGroupTarget && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 360 }}>
            <h3 style={{ display: "flex", alignItems: "center", gap: "0.5rem", margin: "0 0 1rem", color: "var(--olive)" }}>
              <Edit size={18} /> แก้ไขหมวดหมู่ใหญ่
            </h3>
            <input
              className="input"
              value={editGroupName}
              onChange={e => setEditGroupName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleEditGroup()}
              autoFocus
            />
            {groupError && <p style={{ color: "var(--alert-red)", fontSize: "0.8rem", marginTop: 4 }}>{groupError}</p>}
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "1.25rem" }}>
              <button className="btn-primary" style={{ flex: 1 }} onClick={handleEditGroup} disabled={!editGroupName.trim() || editGroupName.trim() === editGroupTarget.name}>
                บันทึก
              </button>
              <button className="btn-secondary" style={{ flex: 1 }} onClick={() => { setEditGroupTarget(null); setGroupError(""); }}>ยกเลิก</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete group modal */}
      {deleteGroupTarget && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 380 }}>
            <h3 style={{ display: "flex", alignItems: "center", gap: "0.5rem", margin: "0 0 1rem", color: "#c53030" }}>
              <Trash2 size={18} /> ลบหมวดหมู่ใหญ่
            </h3>
            {deleteGroupTarget.categories.length > 0 ? (
              <>
                <p style={{ fontSize: "0.875rem", color: "#666", marginBottom: "1rem" }}>
                  ไม่สามารถลบ <strong>&quot;{deleteGroupTarget.name}&quot;</strong> ได้ เพราะยังมี{" "}
                  <strong>{deleteGroupTarget.categories.length} หมวดหมู่ย่อย</strong> อยู่ในกลุ่ม
                  กรุณาย้ายหรือลบหมวดหมู่ย่อยก่อน
                </p>
                <button className="btn-secondary" style={{ width: "100%" }} onClick={() => setDeleteGroupTarget(null)}>ปิด</button>
              </>
            ) : (
              <>
                <p style={{ fontSize: "0.875rem", color: "#666", marginBottom: "1rem" }}>
                  ต้องการลบหมวดหมู่ใหญ่ <strong>&quot;{deleteGroupTarget.name}&quot;</strong> ใช่หรือไม่?
                </p>
                {deleteGroupError && <p style={{ color: "var(--alert-red)", fontSize: "0.8rem", marginBottom: "0.75rem" }}>{deleteGroupError}</p>}
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button className="btn-primary" style={{ flex: 1, background: "#e53e3e" }} onClick={confirmDeleteGroup}>ลบ</button>
                  <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setDeleteGroupTarget(null)}>ยกเลิก</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Add category modal */}
      {addCatGroupId && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 360 }}>
            <h3 style={{ display: "flex", alignItems: "center", gap: "0.5rem", margin: "0 0 0.5rem", color: "var(--olive)" }}>
              <FolderPlus size={18} /> เพิ่มหมวดหมู่ย่อย
            </h3>
            <p style={{ fontSize: "0.8rem", color: "#888", marginBottom: "1rem" }}>
              เพิ่มในกลุ่ม: <strong>{groups.find(g => g.id === addCatGroupId)?.name}</strong>
            </p>
            <input
              className="input"
              placeholder="ชื่อหมวดหมู่ย่อย"
              value={newCatName}
              onChange={e => setNewCatName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleAddCategory()}
              autoFocus
            />
            {addCatError && <p style={{ color: "var(--alert-red)", fontSize: "0.8rem", marginTop: 4 }}>{addCatError}</p>}
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "1.25rem" }}>
              <button className="btn-primary" style={{ flex: 1 }} onClick={handleAddCategory} disabled={!newCatName.trim() || addCatSaving}>
                {addCatSaving ? "กำลังบันทึก..." : "บันทึก"}
              </button>
              <button className="btn-secondary" style={{ flex: 1 }} onClick={() => { setAddCatGroupId(null); setAddCatError(""); }}>ยกเลิก</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit category modal */}
      {editCatTarget && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 360 }}>
            <h3 style={{ display: "flex", alignItems: "center", gap: "0.5rem", margin: "0 0 1rem", color: "var(--olive)" }}>
              <Edit size={18} /> แก้ไข / ย้ายหมวดหมู่ย่อย
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <div>
                <label className="label">ชื่อ</label>
                <input className="input" value={editCatName} onChange={e => setEditCatName(e.target.value)} autoFocus />
              </div>
              <div>
                <label className="label">อยู่ในกลุ่ม</label>
                <select className="input" value={editCatGroupId} onChange={e => setEditCatGroupId(e.target.value)}>
                  <option value="">-- ไม่อยู่ในกลุ่ม --</option>
                  {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
            </div>
            {addCatError && <p style={{ color: "var(--alert-red)", fontSize: "0.8rem", marginTop: 4 }}>{addCatError}</p>}
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "1.25rem" }}>
              <button
                className="btn-primary"
                style={{ flex: 1 }}
                onClick={handleEditCategory}
                disabled={
                  !editCatName.trim() ||
                  (editCatName.trim() === editCatTarget.name && (editCatGroupId || null) === editCatTarget.groupId)
                }
              >
                บันทึก
              </button>
              <button className="btn-secondary" style={{ flex: 1 }} onClick={() => { setEditCatTarget(null); setAddCatError(""); }}>ยกเลิก</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete category modal */}
      {deleteCatTarget && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 380 }}>
            <h3 style={{ display: "flex", alignItems: "center", gap: "0.5rem", margin: "0 0 1rem", color: "#c53030" }}>
              <Trash2 size={18} /> ลบหมวดหมู่ย่อย
            </h3>
            {deleteCatTarget.services.length > 0 ? (
              <>
                <p style={{ fontSize: "0.875rem", color: "#666", marginBottom: "1rem" }}>
                  ไม่สามารถลบ <strong>&quot;{deleteCatTarget.name}&quot;</strong> ได้ เพราะยังมี{" "}
                  <strong>{deleteCatTarget.services.length} บริการ</strong> อยู่ในหมวดหมู่นี้
                </p>
                <button className="btn-secondary" style={{ width: "100%" }} onClick={() => setDeleteCatTarget(null)}>ปิด</button>
              </>
            ) : (
              <>
                <p style={{ fontSize: "0.875rem", color: "#666", marginBottom: "1rem" }}>
                  ต้องการลบหมวดหมู่ย่อย <strong>&quot;{deleteCatTarget.name}&quot;</strong> ใช่หรือไม่?
                </p>
                {deleteCatError && <p style={{ color: "var(--alert-red)", fontSize: "0.8rem", marginBottom: "0.75rem" }}>{deleteCatError}</p>}
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button className="btn-primary" style={{ flex: 1, background: "#e53e3e" }} onClick={confirmDeleteCategory}>ลบ</button>
                  <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setDeleteCatTarget(null)}>ยกเลิก</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* PIN modal */}
      {showPinModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 320 }}>
            <h3 style={{ display: "flex", alignItems: "center", gap: "0.5rem", margin: "0 0 1rem", color: "var(--olive)" }}>
              <Lock size={18} /> ยืนยันสิทธิ์ Owner
            </h3>
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
