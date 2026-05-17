"use client";

import { useEffect, useState } from "react";
import { useBranch } from "@/context/BranchContext";

type Branch = { id: string; name: string };
type StockItem = { id: string; name: string; unitVolumeG: number; costPerUnit: number; reorderPoint: number; mainQty: number; subQty: number; subVolumeG: number; isLow: boolean };

export default function SubStockPage() {
  const { branches, selectedBranchId, setSelectedBranchId } = useBranch();
  const [stock, setStock] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/stock?branchId=${selectedBranchId}`).then(r => r.json()).then(data => {
      if (Array.isArray(data)) setStock(data);
      else setStock([]);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [selectedBranchId]);

  const low = Array.isArray(stock) ? stock.filter(s => s.isLow) : [];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--olive)", margin: 0 }}>🏪 คลังหน้าร้าน (Sub Warehouse)</h1>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <label style={{ fontSize: "0.9rem", fontWeight: 600, color: "#666" }}>เลือกสาขา:</label>
          <select 
            className="input" 
            style={{ width: 180, marginBottom: 0 }}
            value={selectedBranchId}
            onChange={e => setSelectedBranchId(e.target.value)}
          >
            {branches.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
      </div>

      {low.length > 0 && (
        <div style={{ background: "#FFF0F0", border: "1px solid var(--alert-red)", borderRadius: 8, padding: "0.75rem 1rem", marginBottom: "1rem" }}>
          <strong style={{ color: "var(--alert-red)" }}>⚠️ สินค้าใกล้หมด {low.length} รายการ:</strong>
          <div style={{ fontSize: "0.875rem", marginTop: 4 }}>{low.map(s => s.name).join(", ")}</div>
        </div>
      )}

      <div className="card">
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid var(--beige-dark)", color: "#666" }}>
              <th style={{ textAlign: "left", padding: "8px 12px" }}>สินค้า</th>
              <th style={{ textAlign: "center", padding: "8px 12px" }}>จำนวน (ขวด)</th>
              <th style={{ textAlign: "center", padding: "8px 12px" }}>ปริมาณที่เหลือในขวดปัจจุบัน (ก.)</th>
              <th style={{ textAlign: "right", padding: "8px 12px" }}>ต้นทุนต่อกรัม (฿)</th>
              <th style={{ textAlign: "center", padding: "8px 12px" }}>Reorder Point (ก.)</th>
              <th style={{ textAlign: "center", padding: "8px 12px" }}>สถานะ</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ textAlign: "center", padding: "3rem", color: "#888" }}>กำลังโหลดข้อมูล...</td></tr>
            ) : Array.isArray(stock) && stock.map(p => (
              <tr key={p.id} style={{ borderBottom: "1px solid #f5f5f5", background: p.isLow ? "#fff8f8" : "white" }}>
                <td style={{ padding: "8px 12px", fontWeight: 500 }}>{p.name}</td>
                <td style={{ padding: "8px 12px", textAlign: "center", fontWeight: 700 }}>{p.subQty}</td>
                <td style={{ padding: "8px 12px", textAlign: "center" }}>
                  {p.subVolumeG.toLocaleString()}
                </td>
                <td style={{ padding: "8px 12px", textAlign: "right" }}>
                  {(p.costPerUnit / p.unitVolumeG).toFixed(4)}
                </td>
                <td style={{ padding: "8px 12px", textAlign: "center", color: "#888" }}>
                  {(p.reorderPoint).toLocaleString()}
                </td>
                <td style={{ padding: "8px 12px", textAlign: "center" }}>
                  {p.isLow ? (
                    <span style={{ color: "var(--alert-red)", fontWeight: 700, fontSize: "0.8rem" }}>⚠️ ใกล้หมด</span>
                  ) : (
                    <span style={{ color: "var(--success-green)", fontSize: "0.8rem" }}>✓ ปกติ</span>
                  )}
                </td>
              </tr>
            ))}
            {!loading && (!Array.isArray(stock) || stock.length === 0) && (
              <tr><td colSpan={6} style={{ textAlign: "center", padding: "2rem", color: "#aaa" }}>ไม่มีข้อมูลในคลัง</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
