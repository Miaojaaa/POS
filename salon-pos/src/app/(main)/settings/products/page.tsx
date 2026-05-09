"use client";

import { useEffect, useState } from "react";

type Product = { id: string; name: string; unitVolumeG: number; costPerUnit: number; reorderPoint: number; mainStock?: { quantity: number }; subStock?: { quantity: number; currentVolumeG: number } };

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", unitVolumeG: "", costPerUnit: "", reorderPoint: "", initialMain: "10", initialSub: "2" });

  useEffect(() => {
    fetch("/api/products").then(r => r.json()).then(setProducts);
  }, []);

  async function save() {
    if (!form.name || !form.unitVolumeG || !form.costPerUnit) { alert("กรุณากรอกข้อมูลให้ครบ"); return; }
    await fetch("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        unitVolumeG: Number(form.unitVolumeG),
        costPerUnit: Number(form.costPerUnit),
        reorderPoint: Number(form.reorderPoint) || 0,
        initialMain: Number(form.initialMain),
        initialSub: Number(form.initialSub),
      }),
    });
    setShowForm(false);
    fetch("/api/products").then(r => r.json()).then(setProducts);
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--olive)", margin: 0 }}>🧴 จัดการสินค้า/เคมี</h1>
        <button className="btn-primary" onClick={() => setShowForm(true)}>+ เพิ่มสินค้า</button>
      </div>

      <div className="card">
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid var(--beige-dark)", color: "#666" }}>
              <th style={{ textAlign: "left", padding: "8px 12px" }}>ชื่อสินค้า</th>
              <th style={{ textAlign: "center", padding: "8px 12px" }}>ปริมาณต่อขวด (ก.)</th>
              <th style={{ textAlign: "right", padding: "8px 12px" }}>ราคาต้นทุนต่อขวด (฿)</th>
              <th style={{ textAlign: "right", padding: "8px 12px" }}>ราคาต่อกรัม (฿)</th>
              <th style={{ textAlign: "center", padding: "8px 12px" }}>คลังหลัก (ขวด)</th>
              <th style={{ textAlign: "center", padding: "8px 12px" }}>คลังหน้าร้าน (ขวด + ก.)</th>
            </tr>
          </thead>
          <tbody>
            {products.map(p => (
              <tr key={p.id} style={{ borderBottom: "1px solid #f5f5f5" }}>
                <td style={{ padding: "8px 12px", fontWeight: 500 }}>{p.name}</td>
                <td style={{ padding: "8px 12px", textAlign: "center" }}>{(p.unitVolumeG).toLocaleString()}</td>
                <td style={{ padding: "8px 12px", textAlign: "right" }}>{p.costPerUnit.toLocaleString()}</td>
                <td style={{ padding: "8px 12px", textAlign: "right" }}>{(p.costPerUnit / p.unitVolumeG).toFixed(4)}</td>
                <td style={{ padding: "8px 12px", textAlign: "center" }}>{p.mainStock?.quantity ?? 0}</td>
                <td style={{ padding: "8px 12px", textAlign: "center" }}>
                  {p.subStock?.quantity ?? 0} + {((p.subStock?.currentVolumeG ?? 0)).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="modal-overlay">
          <div className="modal">
            <h3 style={{ margin: "0 0 1rem", color: "var(--olive)" }}>เพิ่มสินค้า/เคมี</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <div><label className="label">ชื่อสินค้า</label><input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
              <div><label className="label">ปริมาณต่อขวด (กรัม)</label><input type="number" className="input" value={form.unitVolumeG} onChange={e => setForm({ ...form, unitVolumeG: e.target.value })} placeholder="500" /></div>
              <div><label className="label">ราคาต้นทุนต่อขวด (บาท)</label><input type="number" className="input" value={form.costPerUnit} onChange={e => setForm({ ...form, costPerUnit: e.target.value })} /></div>
              <div><label className="label">Reorder Point (ก.)</label><input type="number" className="input" value={form.reorderPoint} onChange={e => setForm({ ...form, reorderPoint: e.target.value })} placeholder="1000" /></div>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <div style={{ flex: 1 }}><label className="label">คลังหลักเริ่มต้น (ขวด)</label><input type="number" className="input" value={form.initialMain} onChange={e => setForm({ ...form, initialMain: e.target.value })} /></div>
                <div style={{ flex: 1 }}><label className="label">คลังหน้าร้านเริ่มต้น (ขวด)</label><input type="number" className="input" value={form.initialSub} onChange={e => setForm({ ...form, initialSub: e.target.value })} /></div>
              </div>
            </div>
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "1.25rem" }}>
              <button className="btn-primary" style={{ flex: 1 }} onClick={save}>บันทึก</button>
              <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setShowForm(false)}>ยกเลิก</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
