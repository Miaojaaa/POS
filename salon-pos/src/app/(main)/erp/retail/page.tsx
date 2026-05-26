"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import SearchInput from "@/components/SearchInput";
import { useBarcodeScanner } from "@/hooks/useBarcodeScanner";

type RetailProduct = {
  id: string;
  name: string;
  barcode: string | null;
  price: number;
  stock: number;
  usableAsChemical: boolean;
  unitVolumeG: number | null;
  costPerG: number | null;
  isActive: boolean;
};

export default function RetailStockPage() {
  const [items, setItems] = useState<RetailProduct[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editQty, setEditQty] = useState<number>(0);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(p => p.name.toLowerCase().includes(q));
  }, [items, search]);

  // Manager PIN gate (matches /settings/products)
  const [unlocked, setUnlocked] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [pendingAction, setPendingAction] = useState<null | (() => void)>(null);

  async function load() {
    const res = await fetch("/api/retail-products");
    const data = await res.json();
    if (Array.isArray(data)) setItems(data);
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

  function startEdit(p: RetailProduct) {
    setEditingId(p.id);
    setEditQty(p.stock);
  }

  // Quick-add modal (opened when scanner sees an unknown barcode)
  const [quickAdd, setQuickAdd] = useState<{ barcode: string; name: string; price: string; stock: string } | null>(null);
  const [quickAddSaving, setQuickAddSaving] = useState(false);

  async function submitQuickAdd() {
    if (!quickAdd) return;
    if (!quickAdd.name.trim() || !quickAdd.price) {
      alert("กรุณากรอกชื่อและราคา");
      return;
    }
    setQuickAddSaving(true);
    try {
      const res = await fetch("/api/retail-products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: quickAdd.name.trim(),
          barcode: quickAdd.barcode,
          price: Number(quickAdd.price),
          stock: Number(quickAdd.stock) || 0,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "เพิ่มสินค้าไม่สำเร็จ");
        return;
      }
      setQuickAdd(null);
      await load();
    } finally {
      setQuickAddSaving(false);
    }
  }

  // Scanner handler — must come AFTER `load` is in scope (useCallback closure).
  const handleScan = useCallback(async (code: string) => {
    const res = await fetch(`/api/retail-products/by-barcode?code=${encodeURIComponent(code)}`);
    const data = await res.json().catch(() => null);
    if (data?.found) {
      const p = data.product as RetailProduct;
      // Setting search to the product name surfaces the row even if the table
      // was filtered to something else; startEdit pops it into edit mode.
      setSearch(p.name);
      setEditingId(p.id);
      setEditQty(p.stock);
    } else {
      // Unknown barcode → quick-add modal pre-filled with the scanned code.
      setQuickAdd({ barcode: code, name: "", price: "", stock: "0" });
    }
  }, []);
  useBarcodeScanner(handleScan);

  function cancelEdit() {
    setEditingId(null);
  }

  async function saveEdit(p: RetailProduct) {
    const qty = Number(editQty);
    if (!Number.isFinite(qty) || qty < 0) {
      alert("กรุณากรอกตัวเลขที่ถูกต้อง (>= 0)");
      return;
    }
    const delta = qty - p.stock;
    gate(async () => {
      setSaving(true);
      try {
        const res = await fetch(`/api/retail-products/${p.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            stock: qty,
            adjustDelta: delta,
            adjustNote: "แก้ไขจากหน้าคลังหน้าร้าน Retail",
          }),
        });
        if (res.ok) {
          setEditingId(null);
          await load();
        } else {
          let msg = `บันทึกไม่สำเร็จ (HTTP ${res.status})`;
          try {
            const err = await res.json();
            if (err?.error) msg += ` — ${err.error}`;
          } catch {}
          alert(msg);
        }
      } catch (err) {
        console.error("Save retail stock error:", err);
        alert(`การเชื่อมต่อล้มเหลว — ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        setSaving(false);
      }
    });
  }

  const totalValue = items.reduce((s, p) => s + p.stock * p.price, 0);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--olive)", margin: 0 }}>คลังสินค้า Retail</h1>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
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
          <div style={{ fontSize: "0.875rem", background: "white", padding: "0.5rem 1rem", borderRadius: 8, fontWeight: 700 }}>
            มูลค่ารวม: ฿{totalValue.toLocaleString()}
          </div>
        </div>
      </div>

      <div style={{ marginBottom: "1rem", maxWidth: 360 }}>
        <SearchInput
          items={items.map(p => ({ id: p.id, label: p.name, sublabel: `สต๊อก ${p.stock} ชิ้น · ฿${p.price.toLocaleString()}` }))}
          value={search}
          onChange={setSearch}
          onSelect={(item) => setSearch(item.label)}
          placeholder="🔍 ค้นหาสินค้า Retail..."
        />
      </div>

      {!unlocked && (
        <div className="card" style={{ marginBottom: "1rem", background: "#fff8e1", border: "1px solid #facc15" }}>
          <p style={{ margin: 0, fontSize: "0.85rem", color: "#854d0e" }}>
            กดปุ่ม <strong>ปลดล็อกสิทธิ์แก้ไข</strong> ก่อน เพื่อแก้ไขสต๊อก
          </p>
        </div>
      )}

      <div className="card">
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid var(--beige-dark)", color: "#666" }}>
              <th style={{ textAlign: "left", padding: "8px 12px" }}>สินค้า</th>
              <th style={{ textAlign: "center", padding: "8px 12px" }}>ใช้เป็นเคมีได้</th>
              <th style={{ textAlign: "right", padding: "8px 12px" }}>ราคาขาย (฿)</th>
              <th style={{ textAlign: "right", padding: "8px 12px" }}>ปริมาณ/ชิ้น</th>
              <th style={{ textAlign: "center", padding: "8px 12px", width: 180 }}>สต๊อก (ชิ้น)</th>
              <th style={{ textAlign: "right", padding: "8px 12px" }}>มูลค่า (฿)</th>
              <th style={{ textAlign: "center", padding: "8px 12px" }}>สถานะ</th>
              <th style={{ textAlign: "center", padding: "8px 12px", width: 140 }}>จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr><td colSpan={8} style={{ textAlign: "center", padding: "2rem", color: "#aaa" }}>ยังไม่มีสินค้า Retail — เพิ่มได้ที่ Settings → สินค้า</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8} style={{ textAlign: "center", padding: "2rem", color: "#aaa" }}>ไม่พบสินค้าตรงคำค้นหา</td></tr>
            ) : filtered.map(p => {
              const low = p.stock <= 0;
              const warn = p.stock > 0 && p.stock <= 5;
              return (
                <tr key={p.id} style={{ borderBottom: "1px solid #f5f5f5", background: low ? "#fff8f8" : "white" }}>
                  <td style={{ padding: "8px 12px", fontWeight: 500 }}>{p.name}</td>
                  <td style={{ padding: "8px 12px", textAlign: "center" }}>
                    {p.usableAsChemical ? (
                      <span style={{ fontSize: "0.7rem", padding: "2px 8px", borderRadius: 12, background: "#dbeafe", color: "#1d4ed8" }}>
                        ใช้เป็นเคมี
                      </span>
                    ) : (
                      <span style={{ color: "#bbb", fontSize: "0.8rem" }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: "8px 12px", textAlign: "right" }}>฿{p.price.toLocaleString()}</td>
                  <td style={{ padding: "8px 12px", textAlign: "right" }}>
                    {p.usableAsChemical && p.unitVolumeG != null ? `${p.unitVolumeG} ก.` : <span style={{ color: "#bbb" }}>—</span>}
                  </td>
                  <td style={{ padding: "8px 12px", textAlign: "center" }}>
                    {editingId === p.id ? (
                      <input
                        type="number"
                        className="input"
                        style={{ width: 90, textAlign: "center", padding: "4px" }}
                        value={editQty}
                        onChange={e => setEditQty(Number(e.target.value))}
                        onKeyDown={e => {
                          if (e.key === "Enter") saveEdit(p);
                          if (e.key === "Escape") cancelEdit();
                        }}
                        min={0}
                        autoFocus
                      />
                    ) : (
                      <span style={{ fontWeight: 700, color: low ? "var(--alert-red)" : warn ? "#d97706" : "inherit" }}>
                        {p.stock}
                      </span>
                    )}
                  </td>
                  <td style={{ padding: "8px 12px", textAlign: "right" }}>{(p.stock * p.price).toLocaleString()}</td>
                  <td style={{ padding: "8px 12px", textAlign: "center", fontSize: "0.8rem" }}>
                    {low ? (
                      <span style={{ color: "var(--alert-red)", fontWeight: 700 }}>หมด</span>
                    ) : warn ? (
                      <span style={{ color: "#d97706", fontWeight: 700 }}>ใกล้หมด</span>
                    ) : (
                      <span style={{ color: "var(--success-green)" }}>ปกติ</span>
                    )}
                  </td>
                  <td style={{ padding: "8px 12px", textAlign: "center" }}>
                    {editingId === p.id ? (
                      <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
                        <button
                          className="btn-primary"
                          style={{ padding: "4px 8px", fontSize: "0.75rem" }}
                          onClick={() => saveEdit(p)}
                          disabled={saving}
                        >
                          บันทึก
                        </button>
                        <button
                          className="btn-secondary"
                          style={{ padding: "4px 8px", fontSize: "0.75rem" }}
                          onClick={cancelEdit}
                          disabled={saving}
                        >
                          ยกเลิก
                        </button>
                      </div>
                    ) : (
                      <button
                        className="btn-secondary"
                        style={{ padding: "4px 8px", fontSize: "0.75rem" }}
                        onClick={() => startEdit(p)}
                      >
                        แก้ไข
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Quick-add modal — appears when scanner reads an unknown barcode */}
      {quickAdd && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 380 }}>
            <h3 style={{ margin: "0 0 0.5rem", color: "var(--olive)" }}>เพิ่มสินค้าใหม่ (จากบาร์โค้ด)</h3>
            <p style={{ fontSize: "0.85rem", color: "#666", marginBottom: "0.75rem" }}>
              ไม่พบสินค้าที่มีบาร์โค้ดนี้ — กรอกชื่อกับราคาเพื่อบันทึกเป็นสินค้าใหม่
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <div>
                <label className="label">บาร์โค้ด</label>
                <input className="input" value={quickAdd.barcode} readOnly style={{ background: "#f5f5f5", fontFamily: "monospace" }} />
              </div>
              <div>
                <label className="label">ชื่อสินค้า</label>
                <input
                  className="input"
                  placeholder="เช่น แชมพู Brand X"
                  value={quickAdd.name}
                  onChange={e => setQuickAdd(s => s ? { ...s, name: e.target.value } : s)}
                  autoFocus
                />
              </div>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <div style={{ flex: 1 }}>
                  <label className="label">ราคาขาย (บาท)</label>
                  <input
                    type="number"
                    className="input"
                    value={quickAdd.price}
                    onChange={e => setQuickAdd(s => s ? { ...s, price: e.target.value } : s)}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label className="label">สต๊อกเริ่มต้น</label>
                  <input
                    type="number"
                    className="input"
                    value={quickAdd.stock}
                    onChange={e => setQuickAdd(s => s ? { ...s, stock: e.target.value } : s)}
                  />
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
              <button
                className="btn-primary"
                style={{ flex: 1 }}
                onClick={submitQuickAdd}
                disabled={quickAddSaving}
              >
                {quickAddSaving ? "กำลังบันทึก..." : "บันทึก"}
              </button>
              <button
                className="btn-secondary"
                style={{ flex: 1 }}
                onClick={() => setQuickAdd(null)}
                disabled={quickAddSaving}
              >
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
            <h3 style={{ margin: "0 0 0.5rem", color: "var(--olive)" }}>Manager PIN</h3>
            <p style={{ fontSize: "0.875rem", color: "#666", marginBottom: "1rem" }}>
              การแก้ไขสต๊อก Retail ต้องใช้ Manager PIN
            </p>
            <input
              type="password"
              className="input"
              placeholder="PIN 4-6 หลัก"
              value={pin}
              onChange={e => setPin(e.target.value)}
              onKeyDown={e => e.key === "Enter" && verifyPin()}
              autoFocus
            />
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
