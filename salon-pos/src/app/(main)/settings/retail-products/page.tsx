"use client";

import { useEffect, useState } from "react";

type RetailProduct = {
  id: string;
  name: string;
  price: number;
  stock: number;
  isActive: boolean;
};

export default function RetailProductsPage() {
  const [items, setItems] = useState<RetailProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [price, setPrice] = useState<number | "">("");
  const [stock, setStock] = useState<number | "">(0);

  // Stock adjust modal
  const [adjustTarget, setAdjustTarget] = useState<RetailProduct | null>(null);
  const [adjustDelta, setAdjustDelta] = useState<number | "">("");
  const [adjustNote, setAdjustNote] = useState("");

  // Manager PIN gate (one-time per session)
  const [unlocked, setUnlocked] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [pendingAction, setPendingAction] = useState<null | (() => void)>(null);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/retail-products");
    setItems(await res.json());
    setLoading(false);
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

  async function create() {
    if (!name || price === "") return alert("กรุณากรอกชื่อและราคา");
    gate(async () => {
      const res = await fetch("/api/retail-products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, price: Number(price), stock: Number(stock) || 0 }),
      });
      if (res.ok) {
        setName(""); setPrice(""); setStock(0); setShowForm(false);
        await load();
      }
    });
  }

  async function applyAdjust() {
    if (!adjustTarget || adjustDelta === "" || adjustDelta === 0) return;
    const newStock = adjustTarget.stock + Number(adjustDelta);
    if (newStock < 0) return alert("สต๊อกไม่พอ");
    gate(async () => {
      const res = await fetch(`/api/retail-products/${adjustTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stock: newStock,
          adjustDelta: Number(adjustDelta),
          adjustNote: adjustNote || undefined,
        }),
      });
      if (res.ok) {
        setAdjustTarget(null);
        setAdjustDelta("");
        setAdjustNote("");
        await load();
      }
    });
  }

  async function remove(id: string, name: string) {
    if (!confirm(`ลบสินค้า "${name}"?`)) return;
    gate(async () => {
      await fetch(`/api/retail-products/${id}`, { method: "DELETE" });
      await load();
    });
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--olive)", margin: 0 }}>🛍️ สินค้า Retail / สต๊อก</h1>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          {unlocked ? (
            <span style={{ fontSize: "0.8rem", color: "var(--success-green, #2d6a4f)", fontWeight: 600 }}>🔓 ปลดล็อกแล้ว</span>
          ) : (
            <span style={{ fontSize: "0.8rem", color: "#888" }}>🔒 ต้องการ Manager PIN</span>
          )}
          <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
            {showForm ? "ยกเลิก" : "+ เพิ่มสินค้าใหม่"}
          </button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: "1rem", background: "#fff8e1", border: "1px solid #facc15" }}>
        <p style={{ margin: 0, fontSize: "0.85rem", color: "#854d0e" }}>
          ⚠️ การ <strong>เพิ่ม/ลด/แก้ไข/ลบ</strong> สต๊อกสินค้า Retail ต้องใช้ Manager PIN
        </p>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: "1rem" }}>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr auto", gap: "0.75rem", alignItems: "end" }}>
            <div>
              <label className="label">ชื่อสินค้า</label>
              <input className="input" placeholder="เช่น แชมพู Brand X" value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div>
              <label className="label">ราคา (บาท)</label>
              <input type="number" className="input" placeholder="0" value={price}
                onChange={e => setPrice(e.target.value === "" ? "" : Number(e.target.value))} />
            </div>
            <div>
              <label className="label">สต๊อกเริ่มต้น</label>
              <input type="number" className="input" placeholder="0" value={stock}
                onChange={e => setStock(e.target.value === "" ? "" : Number(e.target.value))} />
            </div>
            <button className="btn-primary" onClick={create} disabled={!name || price === ""}>บันทึก</button>
          </div>
        </div>
      )}

      <div className="card">
        {loading ? <p>กำลังโหลด...</p> : items.length === 0 ? (
          <p style={{ color: "#aaa", textAlign: "center" }}>ยังไม่มีสินค้า</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid var(--beige-dark)", color: "#666" }}>
                <th style={{ textAlign: "left", padding: "8px 12px" }}>สินค้า</th>
                <th style={{ textAlign: "right", padding: "8px 12px", width: 120 }}>ราคา</th>
                <th style={{ textAlign: "right", padding: "8px 12px", width: 100 }}>สต๊อก</th>
                <th style={{ width: 240 }}></th>
              </tr>
            </thead>
            <tbody>
              {items.map(p => (
                <tr key={p.id} style={{ borderBottom: "1px solid #f5f5f5" }}>
                  <td style={{ padding: "8px 12px", fontWeight: 500 }}>{p.name}</td>
                  <td style={{ padding: "8px 12px", textAlign: "right" }}>฿{p.price.toLocaleString()}</td>
                  <td style={{ padding: "8px 12px", textAlign: "right" }}>
                    <span style={{ color: p.stock <= 0 ? "var(--alert-red)" : p.stock <= 5 ? "#d97706" : "inherit", fontWeight: 600 }}>
                      {p.stock}
                    </span>
                  </td>
                  <td style={{ padding: "8px 12px", textAlign: "right" }}>
                    <button onClick={() => setAdjustTarget(p)}
                      style={{ background: "var(--olive)", color: "white", border: "none", borderRadius: 6, padding: "4px 10px", cursor: "pointer", marginRight: 4, fontSize: "0.75rem" }}>
                      ⚙️ ปรับสต๊อก
                    </button>
                    <button onClick={() => remove(p.id, p.name)}
                      style={{ background: "none", border: "1px solid #dc2626", color: "#dc2626", borderRadius: 6, padding: "4px 8px", cursor: "pointer", fontSize: "0.75rem" }}>
                      ลบ
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Stock Adjust Modal */}
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
            <input className="input" placeholder="เช่น รับสินค้าเข้า, ของหาย, สูญเสีย"
              value={adjustNote} onChange={e => setAdjustNote(e.target.value)} />

            <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
              <button className="btn-primary" style={{ flex: 1 }} onClick={applyAdjust}
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
