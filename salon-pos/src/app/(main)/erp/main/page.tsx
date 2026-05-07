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

  useEffect(() => {
    fetch("/api/stock").then(r => r.json()).then(setStock);
  }, []);

  const totalValue = stock.reduce((s, p) => s + p.mainQty * p.costPerUnit, 0);

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
              <th style={{ textAlign: "center", padding: "8px 12px" }}>คลังหลัก (ขวด)</th>
              <th style={{ textAlign: "center", padding: "8px 12px" }}>คลังหน้าร้าน (ขวด + ก.)</th>
              <th style={{ textAlign: "right", padding: "8px 12px" }}>ราคาต่อขวด (฿)</th>
              <th style={{ textAlign: "right", padding: "8px 12px" }}>มูลค่า (฿)</th>
              <th style={{ textAlign: "center", padding: "8px 12px" }}>สถานะ</th>
            </tr>
          </thead>
          <tbody>
            {stock.map(p => (
              <tr key={p.id} style={{ borderBottom: "1px solid #f5f5f5", background: p.isLow ? "#fff8f8" : "white" }}>
                <td style={{ padding: "8px 12px", fontWeight: 500 }}>{p.name}</td>
                <td style={{ padding: "8px 12px", textAlign: "center" }}>{(p.unitVolumeG).toLocaleString()}</td>
                <td style={{ padding: "8px 12px", textAlign: "center", fontWeight: 700 }}>{p.mainQty}</td>
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
