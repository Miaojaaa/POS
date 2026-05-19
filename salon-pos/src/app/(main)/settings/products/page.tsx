"use client";

import { useEffect, useState } from "react";

type Category = "ALL" | "CHEMICAL" | "RETAIL";

type Chemical = {
  id: string;
  name: string;
  unitVolumeG: number;
  costPerUnit: number;
  reorderPoint: number;
  sellable: boolean;
  salePrice: number | null;
  mainStock?: { quantity: number };
  subStocks: { quantity: number; currentVolumeG: number }[];
};

type RetailProduct = {
  id: string;
  name: string;
  price: number;
  stock: number;
  usableAsChemical: boolean;
  unitVolumeG: number | null;
  costPerG: number | null;
  isActive: boolean;
};

type FormType = "CHEMICAL" | "RETAIL";

const CATEGORY_BADGE: Record<FormType, { label: string; bg: string; color: string }> = {
  CHEMICAL: { label: "🧪 เคมี", bg: "#dbeafe", color: "#1d4ed8" },
  RETAIL: { label: "🛍️ Retail", bg: "#dcfce7", color: "#16a34a" },
};

export default function ProductsPage() {
  const [chemicals, setChemicals] = useState<Chemical[]>([]);
  const [retails, setRetails] = useState<RetailProduct[]>([]);
  const [tab, setTab] = useState<Category>("ALL");
  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState<FormType>("CHEMICAL");
  const [chemForm, setChemForm] = useState({ name: "", unitVolumeG: "", costPerUnit: "", initialMain: "10", initialSub: "2", sellable: false, salePrice: "" });
  const [retailForm, setRetailForm] = useState({ name: "", price: "", stock: "0", usableAsChemical: false, unitVolumeG: "", costPerG: "" });
  const [editingChemId, setEditingChemId] = useState<string | null>(null);
  const [editingRetailId, setEditingRetailId] = useState<string | null>(null);

  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [selectedProductType, setSelectedProductType] = useState<FormType | null>(null);

  // Stock adjust modal (for retail)
  const [adjustTarget, setAdjustTarget] = useState<RetailProduct | null>(null);
  const [adjustDelta, setAdjustDelta] = useState<number | "">("");
  const [adjustNote, setAdjustNote] = useState("");

  // Manager PIN gate
  const [unlocked, setUnlocked] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [pendingAction, setPendingAction] = useState<null | (() => void)>(null);

  async function load() {
    const [c, r] = await Promise.all([
      fetch("/api/products").then(r => r.json()),
      fetch("/api/retail-products").then(r => r.json()),
    ]);
    setChemicals(c);
    setRetails(r);
  }

  useEffect(() => { load(); }, []);

  function gate(action: () => void) {
    if (unlocked) action();
    else { setPendingAction(() => action); setShowPinModal(true); }
  }

  async function verifyPin() {
    setPinError("");
    const res = await fetch("/api/verify-pin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "MANAGER", pin }),
    });
    const data = await res.json();
    if (data.ok) {
      setUnlocked(true);
      setShowPinModal(false);
      setPin("");
      if (pendingAction) {
        pendingAction();
        setPendingAction(null);
      }
    } else {
      setPinError("Manager PIN ไม่ถูกต้อง");
    }
  }

  function openAddForm() {
    setEditingChemId(null);
    setEditingRetailId(null);
    setChemForm({ name: "", unitVolumeG: "", costPerUnit: "", initialMain: "10", initialSub: "2", sellable: false, salePrice: "" });
    setRetailForm({ name: "", price: "", stock: "0", usableAsChemical: false, unitVolumeG: "", costPerG: "" });
    setShowForm(true);
  }

  function handleEdit() {
    if (!selectedProductId || !selectedProductType) return;

    if (selectedProductType === "CHEMICAL") {
      const p = chemicals.find(x => x.id === selectedProductId);
      if (p) editChemical(p);
    } else {
      const p = retails.find(x => x.id === selectedProductId);
      if (p) editRetail(p);
    }
  }

  function handleDelete() {
    if (!selectedProductId || !selectedProductType) return;

    if (selectedProductType === "CHEMICAL") {
      const p = chemicals.find(x => x.id === selectedProductId);
      if (p) removeChemical(p.id, p.name);
    } else {
      const p = retails.find(x => x.id === selectedProductId);
      if (p) removeRetail(p.id, p.name);
    }
  }

  function editChemical(p: Chemical) {
    setEditingChemId(p.id);
    setEditingRetailId(null);
    setFormType("CHEMICAL");
    setChemForm({
      name: p.name,
      unitVolumeG: String(p.unitVolumeG),
      costPerUnit: String(p.costPerUnit),
      initialMain: "0",
      initialSub: "0",
      sellable: p.sellable,
      salePrice: p.salePrice != null ? String(p.salePrice) : "",
    });
    setShowForm(true);
  }

  function editRetail(p: RetailProduct) {
    setEditingRetailId(p.id);
    setEditingChemId(null);
    setFormType("RETAIL");
    setRetailForm({
      name: p.name,
      price: String(p.price),
      stock: String(p.stock),
      usableAsChemical: p.usableAsChemical,
      unitVolumeG: p.unitVolumeG != null ? String(p.unitVolumeG) : "",
      costPerG: p.costPerG != null ? String(p.costPerG) : "",
    });
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingChemId(null);
    setEditingRetailId(null);
  }

  async function saveProduct() {
    if (formType === "CHEMICAL") {
      if (!chemForm.name || !chemForm.unitVolumeG || !chemForm.costPerUnit) return alert("กรุณากรอกข้อมูลให้ครบ");
      gate(async () => {
        if (editingChemId) {
          await fetch(`/api/products/${editingChemId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: chemForm.name,
              unitVolumeG: Number(chemForm.unitVolumeG),
              costPerUnit: Number(chemForm.costPerUnit),
              sellable: chemForm.sellable,
              salePrice: chemForm.sellable && chemForm.salePrice ? Number(chemForm.salePrice) : null,
            }),
          });
        } else {
          await fetch("/api/products", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: chemForm.name,
              unitVolumeG: Number(chemForm.unitVolumeG),
              costPerUnit: Number(chemForm.costPerUnit),
              initialMain: Number(chemForm.initialMain),
              initialSub: Number(chemForm.initialSub),
              sellable: chemForm.sellable,
              salePrice: chemForm.sellable && chemForm.salePrice ? Number(chemForm.salePrice) : null,
            }),
          });
        }
        closeForm();
        setChemForm({ name: "", unitVolumeG: "", costPerUnit: "", initialMain: "10", initialSub: "2", sellable: false, salePrice: "" });
        await load();
      });
    } else {
      if (!retailForm.name || !retailForm.price) return alert("กรุณากรอกข้อมูลให้ครบ");
      gate(async () => {
        if (editingRetailId) {
          await fetch(`/api/retail-products/${editingRetailId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: retailForm.name,
              price: Number(retailForm.price),
              usableAsChemical: retailForm.usableAsChemical,
              unitVolumeG: retailForm.usableAsChemical && retailForm.unitVolumeG ? Number(retailForm.unitVolumeG) : null,
              costPerG: retailForm.usableAsChemical && retailForm.costPerG ? Number(retailForm.costPerG) : null,
            }),
          });
        } else {
          await fetch("/api/retail-products", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: retailForm.name,
              price: Number(retailForm.price),
              stock: Number(retailForm.stock) || 0,
              usableAsChemical: retailForm.usableAsChemical,
              unitVolumeG: retailForm.usableAsChemical && retailForm.unitVolumeG ? Number(retailForm.unitVolumeG) : null,
              costPerG: retailForm.usableAsChemical && retailForm.costPerG ? Number(retailForm.costPerG) : null,
            }),
          });
        }
        closeForm();
        setRetailForm({ name: "", price: "", stock: "0", usableAsChemical: false, unitVolumeG: "", costPerG: "" });
        await load();
      });
    }
  }

  async function removeChemical(id: string, name: string) {
    if (!confirm(`ลบเคมี "${name}"?`)) return;
    gate(async () => {
      await fetch(`/api/products/${id}`, { method: "DELETE" });
      setSelectedProductId(null);
      await load();
    });
  }

  async function applyRetailAdjust() {
    if (!adjustTarget || adjustDelta === "" || adjustDelta === 0) return;
    const newStock = adjustTarget.stock + Number(adjustDelta);
    if (newStock < 0) return alert("สต๊อกไม่พอ");
    gate(async () => {
      await fetch(`/api/retail-products/${adjustTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stock: newStock,
          adjustDelta: Number(adjustDelta),
          adjustNote: adjustNote || undefined,
        }),
      });
      setAdjustTarget(null);
      setAdjustDelta("");
      setAdjustNote("");
      await load();
    });
  }

  async function removeRetail(id: string, name: string) {
    if (!confirm(`ลบสินค้า "${name}"?`)) return;
    gate(async () => {
      await fetch(`/api/retail-products/${id}`, { method: "DELETE" });
      setSelectedProductId(null);
      await load();
    });
  }

  const showChem = tab === "ALL" || tab === "CHEMICAL";
  const showRetail = tab === "ALL" || tab === "RETAIL";

  function selectProduct(id: string, type: FormType) {
    if (selectedProductId === id) {
      setSelectedProductId(null);
      setSelectedProductType(null);
    } else {
      setSelectedProductId(id);
      setSelectedProductType(type);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h1 style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--olive)", margin: 0 }}>📦 จัดการสต๊อก</h1>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          {selectedProductId && (
            <>
              <button 
                className="btn-danger" 
                onClick={handleDelete}
                style={{ fontSize: "0.85rem", padding: "0.5rem 1rem" }}
              >
                ลบสินค้า
              </button>
              <button 
                className="btn-secondary" 
                onClick={handleEdit}
                style={{ fontSize: "0.85rem", padding: "0.5rem 1rem" }}
              >
                แก้ไขสินค้า
              </button>
            </>
          )}
          {unlocked ? (
            <button
              className="btn-secondary"
              onClick={() => setUnlocked(false)}
            >
              ล็อกสิทธิ์แก้ไข
            </button>
          ) : (
            <button
              className="btn-secondary"
              onClick={() => { setPin(""); setPinError(""); setPendingAction(null); setShowPinModal(true); }}
            >
              ปลดล็อกสิทธิ์แก้ไข
            </button>
          )}
          <button
            className="btn-primary"
            onClick={openAddForm}
            style={{ opacity: unlocked ? 1 : 0.6 }}
          >
            + เพิ่มสินค้า
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
        {(["ALL", "CHEMICAL", "RETAIL"] as const).map(t => {
          const label = t === "ALL" ? "ทั้งหมด" : t === "CHEMICAL" ? "🧪 เคมี" : "🛍️ Retail";
          const count = t === "ALL" ? chemicals.length + retails.length : t === "CHEMICAL" ? chemicals.length : retails.length;
          return (
            <button
              key={t}
              onClick={() => { setTab(t); setSelectedProductId(null); }}
              style={{
                padding: "0.5rem 1rem",
                borderRadius: 8,
                border: `2px solid ${tab === t ? "var(--olive)" : "var(--beige-dark)"}`,
                background: tab === t ? "var(--olive)" : "white",
                color: tab === t ? "white" : "var(--text-dark)",
                cursor: "pointer",
                fontSize: "0.875rem",
                fontWeight: 600,
              }}
            >
              {label} <span style={{ opacity: 0.7, marginLeft: 4 }}>({count})</span>
            </button>
          );
        })}
      </div>

      {!unlocked ? (
        <div className="card" style={{ marginBottom: "1rem", background: "#fff8e1", border: "1px solid #facc15" }}>
          <p style={{ margin: 0, fontSize: "0.85rem", color: "#854d0e" }}>
            ⚠️ กดปุ่ม <strong>ปลดล็อกสิทธิ์แก้ไข</strong> ก่อน เพื่อเพิ่ม/ปรับสต๊อก/แก้ไข/ลบสินค้า
          </p>
        </div>
      ) : (
        <div className="card" style={{ marginBottom: "1rem", background: "#dcfce7", border: "1px solid #86efac" }}>
          <p style={{ margin: 0, fontSize: "0.85rem", color: "#15803d" }}>
            ปลดล็อกแล้ว — สามารถเพิ่ม/ปรับสต๊อก/แก้ไข/ลบสินค้าได้
          </p>
        </div>
      )}

      {/* Chemicals table */}
      {showChem && chemicals.length > 0 && (
        <div className="card" style={{ marginBottom: "1rem" }}>
          <h3 style={{ margin: "0 0 0.75rem", fontSize: "0.95rem", color: "var(--olive)" }}>🧪 เคมี (สำหรับใช้กับลูกค้า)</h3>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid var(--beige-dark)", color: "#666" }}>
                <th style={{ textAlign: "left", padding: "8px 12px" }}>ชื่อสินค้า</th>
                <th style={{ textAlign: "center", padding: "8px 12px" }}>การใช้งาน</th>
                <th style={{ textAlign: "center", padding: "8px 12px" }}>ปริมาณ/ขวด</th>
                <th style={{ textAlign: "right", padding: "8px 12px" }}>ราคาต้นทุน</th>
                <th style={{ textAlign: "right", padding: "8px 12px" }}>ราคา/ก.</th>
                <th style={{ textAlign: "right", padding: "8px 12px" }}>ราคาขาย</th>
                <th style={{ textAlign: "center", padding: "8px 12px" }}>คลังหลัก</th>
                <th style={{ textAlign: "center", padding: "8px 12px" }}>คลังหน้าร้าน</th>
              </tr>
            </thead>
            <tbody>
              {chemicals.map(p => (
                <tr 
                  key={p.id} 
                  style={{ 
                    borderBottom: "1px solid #f5f5f5", 
                    cursor: "pointer",
                    background: selectedProductId === p.id ? "#f0f5e8" : "transparent"
                  }}
                  onClick={() => selectProduct(p.id, "CHEMICAL")}
                >
                  <td style={{ padding: "8px 12px", fontWeight: 500 }}>{p.name}</td>
                  <td style={{ padding: "8px 12px", textAlign: "center" }}>
                    <div style={{ display: "flex", gap: 4, justifyContent: "center", flexWrap: "wrap" }}>
                      <span style={{ fontSize: "0.7rem", padding: "2px 8px", borderRadius: 12, background: CATEGORY_BADGE.CHEMICAL.bg, color: CATEGORY_BADGE.CHEMICAL.color }}>
                        ใช้ในบริการ
                      </span>
                      {p.sellable && (
                        <span style={{ fontSize: "0.7rem", padding: "2px 8px", borderRadius: 12, background: CATEGORY_BADGE.RETAIL.bg, color: CATEGORY_BADGE.RETAIL.color }}>
                          ขายได้
                        </span>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: "8px 12px", textAlign: "center" }}>{(p.unitVolumeG / 1000).toFixed(0)} ก.</td>
                  <td style={{ padding: "8px 12px", textAlign: "right" }}>฿{p.costPerUnit.toLocaleString()}</td>
                  <td style={{ padding: "8px 12px", textAlign: "right" }}>฿{(p.costPerUnit / p.unitVolumeG).toFixed(4)}</td>
                  <td style={{ padding: "8px 12px", textAlign: "right" }}>
                    {p.sellable && p.salePrice != null ? `฿${p.salePrice.toLocaleString()}` : <span style={{ color: "#bbb" }}>—</span>}
                  </td>
                  <td style={{ padding: "8px 12px", textAlign: "center" }}>{p.mainStock?.quantity ?? 0} ขวด</td>
                  <td style={{ padding: "8px 12px", textAlign: "center" }}>
                    {p.subStocks?.[0]?.quantity ?? 0} ขวด + {((p.subStocks?.[0]?.currentVolumeG ?? 0) / 1000).toFixed(0)} ก.
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Retail table */}
      {showRetail && retails.length > 0 && (
        <div className="card">
          <h3 style={{ margin: "0 0 0.75rem", fontSize: "0.95rem", color: "var(--olive)" }}>🛍️ Retail (สินค้าขายให้ลูกค้า)</h3>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid var(--beige-dark)", color: "#666" }}>
                <th style={{ textAlign: "left", padding: "8px 12px" }}>ชื่อสินค้า</th>
                <th style={{ textAlign: "center", padding: "8px 12px" }}>การใช้งาน</th>
                <th style={{ textAlign: "right", padding: "8px 12px" }}>ราคาขาย</th>
                <th style={{ textAlign: "right", padding: "8px 12px" }}>ปริมาณ/ชิ้น</th>
                <th style={{ textAlign: "right", padding: "8px 12px" }}>ต้นทุน/ก.</th>
                <th style={{ textAlign: "right", padding: "8px 12px" }}>สต๊อก</th>
                <th style={{ width: 120 }}></th>
              </tr>
            </thead>
            <tbody>
              {retails.map(p => (
                <tr 
                  key={p.id} 
                  style={{ 
                    borderBottom: "1px solid #f5f5f5", 
                    cursor: "pointer",
                    background: selectedProductId === p.id ? "#f0f5e8" : "transparent"
                  }}
                  onClick={() => selectProduct(p.id, "RETAIL")}
                >
                  <td style={{ padding: "8px 12px", fontWeight: 500 }}>{p.name}</td>
                  <td style={{ padding: "8px 12px", textAlign: "center" }}>
                    <div style={{ display: "flex", gap: 4, justifyContent: "center", flexWrap: "wrap" }}>
                      <span style={{ fontSize: "0.7rem", padding: "2px 8px", borderRadius: 12, background: CATEGORY_BADGE.RETAIL.bg, color: CATEGORY_BADGE.RETAIL.color }}>
                        ขายได้
                      </span>
                      {p.usableAsChemical && (
                        <span style={{ fontSize: "0.7rem", padding: "2px 8px", borderRadius: 12, background: CATEGORY_BADGE.CHEMICAL.bg, color: CATEGORY_BADGE.CHEMICAL.color }}>
                          ใช้เป็นเคมี
                        </span>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: "8px 12px", textAlign: "right" }}>฿{p.price.toLocaleString()}</td>
                  <td style={{ padding: "8px 12px", textAlign: "right" }}>
                    {p.usableAsChemical && p.unitVolumeG != null ? `${p.unitVolumeG} ก.` : <span style={{ color: "#bbb" }}>—</span>}
                  </td>
                  <td style={{ padding: "8px 12px", textAlign: "right" }}>
                    {p.usableAsChemical && p.costPerG != null ? `฿${p.costPerG.toFixed(4)}` : <span style={{ color: "#bbb" }}>—</span>}
                  </td>
                  <td style={{ padding: "8px 12px", textAlign: "right" }}>
                    <span style={{ color: p.stock <= 0 ? "var(--alert-red)" : p.stock <= 5 ? "#d97706" : "inherit", fontWeight: 600 }}>
                      {p.stock} ชิ้น
                    </span>
                  </td>
                  <td style={{ padding: "8px 12px", textAlign: "right" }}>
                    <button onClick={(e) => { e.stopPropagation(); setAdjustTarget(p); }}
                      className="btn-secondary"
                      style={{ padding: "4px 10px", fontSize: "0.75rem" }}>
                      ปรับสต๊อก
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showChem && chemicals.length === 0 && tab === "CHEMICAL" && (
        <div className="card" style={{ textAlign: "center", padding: "2rem", color: "#aaa" }}>ยังไม่มีเคมี</div>
      )}
      {showRetail && retails.length === 0 && tab === "RETAIL" && (
        <div className="card" style={{ textAlign: "center", padding: "2rem", color: "#aaa" }}>ยังไม่มีสินค้า Retail</div>
      )}

      {/* Add/Edit Form Modal */}
      {showForm && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 500, position: "relative" }}>
            <button
              onClick={closeForm}
              style={{
                position: "absolute", top: "0.75rem", right: "1rem",
                background: "none", border: "none", fontSize: "1.5rem",
                cursor: "pointer", color: "#999", lineHeight: 1,
              }}
            >
              ×
            </button>
            <h3 style={{ margin: "0 0 1rem", color: "var(--olive)" }}>
              {editingChemId || editingRetailId ? "แก้ไขสินค้า" : "เพิ่มสินค้า"}
            </h3>

            {!(editingChemId || editingRetailId) && (
              <div style={{ marginBottom: "1rem" }}>
                <label className="label">ประเภท</label>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  {(["CHEMICAL", "RETAIL"] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => setFormType(t)}
                      style={{
                        flex: 1,
                        padding: "0.625rem",
                        borderRadius: 8,
                        border: `2px solid ${formType === t ? "var(--olive)" : "var(--beige-dark)"}`,
                        background: formType === t ? "#f0f5e8" : "white",
                        cursor: "pointer",
                        fontSize: "0.875rem",
                        fontWeight: 600,
                      }}
                    >
                      {CATEGORY_BADGE[t].label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {formType === "CHEMICAL" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <div><label className="label">ชื่อสินค้า</label><input className="input" value={chemForm.name} onChange={e => setChemForm({ ...chemForm, name: e.target.value })} /></div>
                <div><label className="label">ปริมาณต่อขวด (กรัม)</label><input type="number" className="input" value={chemForm.unitVolumeG} onChange={e => setChemForm({ ...chemForm, unitVolumeG: e.target.value })} placeholder="500" /></div>
                <div><label className="label">ราคาต้นทุนต่อขวด (บาท)</label><input type="number" className="input" value={chemForm.costPerUnit} onChange={e => setChemForm({ ...chemForm, costPerUnit: e.target.value })} /></div>
                {!editingChemId && (
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <div style={{ flex: 1 }}><label className="label">คลังหลักเริ่มต้น (ขวด)</label><input type="number" className="input" value={chemForm.initialMain} onChange={e => setChemForm({ ...chemForm, initialMain: e.target.value })} /></div>
                    <div style={{ flex: 1 }}><label className="label">คลังหน้าร้านเริ่มต้น (ขวด)</label><input type="number" className="input" value={chemForm.initialSub} onChange={e => setChemForm({ ...chemForm, initialSub: e.target.value })} /></div>
                  </div>
                )}
                <div style={{ borderTop: "1px dashed var(--beige-dark)", paddingTop: "0.75rem" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", fontSize: "0.9rem", marginBottom: chemForm.sellable ? "0.5rem" : 0 }}>
                    <input
                      type="checkbox"
                      checked={chemForm.sellable}
                      onChange={e => setChemForm({ ...chemForm, sellable: e.target.checked })}
                    />
                    <span>เปิดให้ขายเป็น Retail ได้ <span style={{ color: "#888", fontSize: "0.8rem" }}>(ไม่ติ๊ก = ใช้ในงานบริการเท่านั้น)</span></span>
                  </label>
                  {chemForm.sellable && (
                    <div>
                      <label className="label">ราคาขาย (บาท/ขวด)</label>
                      <input type="number" className="input" value={chemForm.salePrice} onChange={e => setChemForm({ ...chemForm, salePrice: e.target.value })} placeholder="ราคาที่ขายให้ลูกค้า" />
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <div><label className="label">ชื่อสินค้า</label><input className="input" placeholder="เช่น แชมพู Brand X" value={retailForm.name} onChange={e => setRetailForm({ ...retailForm, name: e.target.value })} /></div>
                <div><label className="label">ราคาขาย (บาท)</label><input type="number" className="input" value={retailForm.price} onChange={e => setRetailForm({ ...retailForm, price: e.target.value })} /></div>
                {!editingRetailId && (
                  <div><label className="label">สต๊อกเริ่มต้น (ชิ้น)</label><input type="number" className="input" value={retailForm.stock} onChange={e => setRetailForm({ ...retailForm, stock: e.target.value })} /></div>
                )}
                <div style={{ borderTop: "1px dashed var(--beige-dark)", paddingTop: "0.75rem" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", fontSize: "0.9rem", marginBottom: retailForm.usableAsChemical ? "0.5rem" : 0 }}>
                    <input
                      type="checkbox"
                      checked={retailForm.usableAsChemical}
                      onChange={e => setRetailForm({ ...retailForm, usableAsChemical: e.target.checked })}
                    />
                    <span>ใช้เป็นเคมีในงานบริการได้ (แบ่งใช้เป็นกรัม)</span>
                  </label>
                  {retailForm.usableAsChemical && (
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <div style={{ flex: 1 }}>
                        <label className="label">ปริมาณ/ชิ้น (กรัม)</label>
                        <input type="number" className="input" value={retailForm.unitVolumeG} onChange={e => setRetailForm({ ...retailForm, unitVolumeG: e.target.value })} placeholder="500" />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label className="label">ต้นทุน/กรัม (บาท)</label>
                        <input type="number" step="0.0001" className="input" value={retailForm.costPerG} onChange={e => setRetailForm({ ...retailForm, costPerG: e.target.value })} placeholder="0.5" />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div style={{ display: "flex", gap: "0.5rem", marginTop: "1.25rem" }}>
              <button className="btn-primary" style={{ flex: 1 }} onClick={saveProduct}>
                บันทึก {!unlocked && "(ต้องใช้ PIN)"}
              </button>
              <button className="btn-secondary" style={{ flex: 1 }} onClick={closeForm}>ยกเลิก</button>
            </div>
          </div>
        </div>
      )}

      {/* Stock Adjust Modal (Retail) */}
      {adjustTarget && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 400 }}>
            <h3 style={{ margin: "0 0 0.5rem", color: "var(--olive)" }}>⚙️ ปรับสต๊อก: {adjustTarget.name}</h3>
            <p style={{ fontSize: "0.875rem", color: "#666", marginBottom: "1rem" }}>
              สต๊อกปัจจุบัน: <strong>{adjustTarget.stock}</strong> ชิ้น
            </p>
            <label className="label">จำนวนที่ต้องการเปลี่ยน (+ เพิ่ม / − ลด)</label>
            <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem" }}>
              <button onClick={() => setAdjustDelta(d => (Number(d) || 0) - 1)}
                style={{ width: 40, background: "var(--beige)", border: "1px solid var(--beige-dark)", borderRadius: 8, cursor: "pointer", fontSize: "1.2rem", fontWeight: 700 }}>−</button>
              <input type="number" className="input" style={{ flex: 1, marginBottom: 0, textAlign: "center", fontSize: "1.1rem", fontWeight: 700 }}
                value={adjustDelta} onChange={e => setAdjustDelta(e.target.value === "" ? "" : Number(e.target.value))} />
              <button onClick={() => setAdjustDelta(d => (Number(d) || 0) + 1)}
                style={{ width: 40, background: "var(--olive)", color: "white", border: "none", borderRadius: 8, cursor: "pointer", fontSize: "1.2rem", fontWeight: 700 }}>+</button>
            </div>
            {adjustDelta !== "" && Number(adjustDelta) !== 0 && (
              <div style={{ background: Number(adjustDelta) > 0 ? "#dcfce7" : "#fee2e2", padding: "0.5rem 0.75rem", borderRadius: 8, marginBottom: "0.75rem", fontSize: "0.875rem" }}>
                สต๊อกใหม่: <strong>{adjustTarget.stock + Number(adjustDelta)}</strong> ชิ้น
              </div>
            )}
            <label className="label">หมายเหตุ (ถ้ามี)</label>
            <input className="input" placeholder="เช่น รับสินค้าเข้า, ของหาย"
              value={adjustNote} onChange={e => setAdjustNote(e.target.value)} />
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
              <button className="btn-primary" style={{ flex: 1 }} onClick={applyRetailAdjust}
                disabled={adjustDelta === "" || Number(adjustDelta) === 0}>
                ✓ บันทึก {!unlocked && "(ต้องใช้ PIN)"}
              </button>
              <button className="btn-secondary" style={{ flex: 1 }} onClick={() => { setAdjustTarget(null); setAdjustDelta(""); setAdjustNote(""); }}>
                ยกเลิก
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manager PIN Modal */}
      {showPinModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 340 }}>
            <h3 style={{ margin: "0 0 0.5rem", color: "var(--olive)" }}>🔐 Manager PIN</h3>
            <p style={{ fontSize: "0.875rem", color: "#666", marginBottom: "1rem" }}>
              การแก้ไขสต๊อก/สินค้าต้องใช้ Manager PIN
            </p>
            <input type="password" className="input" placeholder="PIN 4-6 หลัก" value={pin}
              onChange={e => setPin(e.target.value)}
              onKeyDown={e => e.key === "Enter" && verifyPin()}
              autoFocus />
            {pinError && <div style={{ color: "var(--alert-red)", fontSize: "0.875rem", marginTop: "0.5rem" }}>{pinError}</div>}
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
              <button className="btn-primary" style={{ flex: 1 }} onClick={verifyPin}>ยืนยัน</button>
              <button className="btn-secondary" style={{ flex: 1 }} onClick={() => { setShowPinModal(false); setPin(""); setPinError(""); setPendingAction(null); }}>
                ยกเลิก
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
