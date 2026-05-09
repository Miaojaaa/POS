"use client";

import { useEffect, useState } from "react";

type StockItem = { id: string; name: string; unitVolumeG: number; costPerUnit: number; reorderPoint: number; mainQty: number; subQty: number; subVolumeG: number; isLow: boolean };

export default function SubStockPage() {
  const [stock, setStock] = useState<StockItem[]>([]);

  useEffect(() => {
    fetch("/api/stock").then(r => r.json()).then(setStock);
  }, []);

  const low = stock.filter(s => s.isLow);

  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--olive)", marginBottom: "1.5rem" }}>🏪 คลังหน้าร้าน (Sub Warehouse)</h1>

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
            {stock.map(p => (
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
          </tbody>
        </table>
      </div>
    </div>
  );
}
