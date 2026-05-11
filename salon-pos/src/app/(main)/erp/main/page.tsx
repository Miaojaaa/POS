"use client";

import { useEffect, useState } from "react";

type StockItem = {
  id: string;
  name: string;
  unitVolumeG: number;
  costPerUnit: number;
  reorderPoint: number;
  mainQty: number;
  subQty: number;
  subVolumeG: number;
  totalVolumeG: number;
  isLow: boolean;
  costPerG: number;
};

export default function MainStockPage() {
  const [stock, setStock] = useState<StockItem[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editQty, setEditQty] = useState<number>(0);
  const [saving, setSaving] = useState(false);

  async function load() {
    const res = await fetch("/api/stock");
    const data = await res.json();
    setStock(data);
  }

  useEffect(() => {
    load();
  }, []);

  const totalValue = stock.reduce((s, p) => s + p.mainQty * p.costPerUnit, 0);

  function startEdit(item: StockItem) {
    setEditingId(item.id);
    setEditQty(item.mainQty);
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function saveEdit(id: string) {
    const qty = Number(editQty);
    if (!Number.isFinite(qty) || qty < 0) {
      alert("กรุณากรอกตัวเลขที่ถูกต้อง (>= 0)");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/stock", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, mainQty: qty }),
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
      console.error("Save main stock error:", err);
      alert(`การเชื่อมต่อล้มเหลว — ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--olive)", margin: 0 }}>📦 คลังหลัก (Main Warehouse)</h1>
        <div style={{ fontSize: "0.875rem", background: "white", padding: "0.5rem 1rem", borderRadius: 8, fontWeight: 700 }}>
          มูลค่าสต็อก: ฿{totalValue.toLocaleString()}
        </div>
      </div>

      <div className="card">
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid var(--beige-dark)", color: "#666" }}>
              <th style={{ textAlign: "left", padding: "8px 12px" }}>สินค้า</th>
              <th style={{ textAlign: "center", padding: "8px 12px" }}>ปริมาณต่อขวด (กรัม)</th>
              <th style={{ textAlign: "center", padding: "8px 12px", width: "180px" }}>คลังหลัก (ขวด)</th>
              <th style={{ textAlign: "center", padding: "8px 12px" }}>คลังหน้าร้าน (ขวด + ก.)</th>
              <th style={{ textAlign: "right", padding: "8px 12px" }}>ราคาต่อขวด (฿)</th>
              <th style={{ textAlign: "right", padding: "8px 12px" }}>มูลค่า (฿)</th>
              <th style={{ textAlign: "center", padding: "8px 12px" }}>สถานะ</th>
              <th style={{ textAlign: "center", padding: "8px 12px", width: "100px" }}>จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {stock.map(p => (
              <tr key={p.id} style={{ borderBottom: "1px solid #f5f5f5", background: p.isLow ? "#fff8f8" : "white" }}>
                <td style={{ padding: "8px 12px", fontWeight: 500 }}>{p.name}</td>
                <td style={{ padding: "8px 12px", textAlign: "center" }}>{(p.unitVolumeG).toLocaleString()}</td>
                <td style={{ padding: "8px 12px", textAlign: "center" }}>
                  {editingId === p.id ? (
                    <input
                      type="number"
                      className="input"
                      style={{ width: "80px", textAlign: "center", padding: "4px" }}
                      value={editQty}
                      onChange={e => setEditQty(Number(e.target.value))}
                      onKeyDown={e => {
                        if (e.key === "Enter") saveEdit(p.id);
                        if (e.key === "Escape") cancelEdit();
                      }}
                      min={0}
                      autoFocus
                    />
                  ) : (
                    <span style={{ fontWeight: 700 }}>{p.mainQty}</span>
                  )}
                </td>
                <td style={{ padding: "8px 12px", textAlign: "center", color: "#555" }}>
                  {p.subQty} + {(p.subVolumeG).toLocaleString()}
                </td>
                <td style={{ padding: "8px 12px", textAlign: "right" }}>{p.costPerUnit.toLocaleString()}</td>
                <td style={{ padding: "8px 12px", textAlign: "right" }}>{(p.mainQty * p.costPerUnit).toLocaleString()}</td>
                <td style={{ padding: "8px 12px", textAlign: "center" }}>
                  {p.isLow ? (
                    <span style={{ color: "var(--alert-red)", fontSize: "0.8rem", fontWeight: 700 }}>⚠️ ใกล้หมด</span>
                  ) : (
                    <span style={{ color: "var(--success-green)", fontSize: "0.8rem" }}>✓ ปกติ</span>
                  )}
                </td>
                <td style={{ padding: "8px 12px", textAlign: "center" }}>
                  {editingId === p.id ? (
                    <div style={{ display: "flex", gap: "4px", justifyContent: "center" }}>
                      <button 
                        className="btn-primary" 
                        style={{ padding: "4px 8px", fontSize: "0.75rem" }}
                        onClick={() => saveEdit(p.id)}
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
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
