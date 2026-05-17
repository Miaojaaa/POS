"use client";

import { useEffect, useState } from "react";
import { useBranch } from "@/context/BranchContext";

type Branch = { id: string; name: string };
type Transfer = {
  id: string;
  status: string;
  note?: string;
  branchId: string;
  branch?: { name: string };
  createdAt: string;
  approvedAt?: string;
  createdBy: { name: string };
  approvedBy?: { name: string };
  items: { id: string; quantity: number; product: { name: string } }[];
};

type Product = { id: string; name: string; mainQty: number };

export default function TransfersPage() {
  const { branches, selectedBranchId, setSelectedBranchId } = useBranch();
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [targetBranchId, setTargetBranchId] = useState("main");
  const [items, setItems] = useState<{ productId: string; quantity: number }[]>([{ productId: "", quantity: 1 }]);
  const [note, setNote] = useState("");

  async function load() {
    try {
      const url = selectedBranchId === "all" ? "/api/transfers" : `/api/transfers?branchId=${selectedBranchId}`;
      const [tRes, pRes] = await Promise.all([
        fetch(url), 
        fetch("/api/stock"),
      ]);
      
      if (!tRes.ok || !pRes.ok) {
        console.error("Fetch failed");
        return;
      }

      const tData = await tRes.json();
      if (Array.isArray(tData)) setTransfers(tData);
      
      const stock = await pRes.json();
      if (Array.isArray(stock)) {
        setProducts(stock.map((s: { id: string; name: string; mainQty: number }) => ({ id: s.id, name: s.name, mainQty: s.mainQty })));
      }
    } catch (err) {
      console.error("Failed to load transfers page data:", err);
    }
  }

  useEffect(() => { load(); }, [selectedBranchId]);

  async function requestTransfer() {
    const validItems = items.filter(i => i.productId && i.quantity > 0);
    if (validItems.length === 0) { alert("กรุณาเลือกสินค้า"); return; }
    await fetch("/api/transfers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: validItems, note, branchId: targetBranchId }),
    });
    setShowForm(false);
    setItems([{ productId: "", quantity: 1 }]);
    setNote("");
    load();
  }

  async function updateStatus(id: string, action: "APPROVE" | "REJECT") {
    await fetch("/api/transfers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action }),
    });
    load();
  }

  const STATUS_LABEL: Record<string, string> = { PENDING: "รอการอนุมัติ", APPROVED: "อนุมัติแล้ว", REJECTED: "ปฏิเสธ" };
  const STATUS_COLOR: Record<string, string> = { PENDING: "#856404", APPROVED: "#155724", REJECTED: "#721c24" };
  const STATUS_BG: Record<string, string> = { PENDING: "#FFF3CD", APPROVED: "#D4EDDA", REJECTED: "#F8D7DA" };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--olive)", margin: 0 }}>🔄 โอนสินค้า Main → คลังหน้าร้าน</h1>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <select 
            className="input" 
            style={{ width: 160, marginBottom: 0 }}
            value={selectedBranchId}
            onChange={e => setSelectedBranchId(e.target.value)}
          >
            <option value="all">ทุกสาขา</option>
            {branches.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
          <button className="btn-primary" onClick={() => setShowForm(true)}>+ ขอโอนสินค้า</button>
        </div>
      </div>

      <div className="card">
        {transfers.length === 0 ? (
          <p style={{ color: "#aaa", textAlign: "center", padding: "2rem" }}>ไม่มีรายการโอน</p>
        ) : transfers.map(t => (
          <div key={t.id} style={{ borderBottom: "1px solid var(--beige-dark)", paddingBottom: "1rem", marginBottom: "1rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div>
                <span className="badge" style={{ background: STATUS_BG[t.status], color: STATUS_COLOR[t.status] }}>
                  {STATUS_LABEL[t.status]}
                </span>
                <span style={{ marginLeft: 8, fontSize: "0.85rem", color: "#666" }}>
                  ขอโดย {t.createdBy.name} · {new Date(t.createdAt).toLocaleDateString("th-TH")}
                </span>
                <span style={{ marginLeft: 8, fontSize: "0.85rem", color: "var(--olive)", fontWeight: 600 }}>
                  ปลายทาง: {t.branch?.name || t.branchId}
                </span>
                {t.approvedBy && (
                  <span style={{ marginLeft: 8, fontSize: "0.8rem", color: "#888" }}>
                    · อนุมัติโดย {t.approvedBy.name}
                  </span>
                )}
              </div>
              {t.status === "PENDING" && (
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button className="btn-primary" style={{ fontSize: "0.8rem", padding: "4px 12px" }} onClick={() => updateStatus(t.id, "APPROVE")}>
                    ✓ อนุมัติ
                  </button>
                  <button className="btn-danger" style={{ fontSize: "0.8rem", padding: "4px 12px" }} onClick={() => updateStatus(t.id, "REJECT")}>
                    ✗ ปฏิเสธ
                  </button>
                </div>
              )}
            </div>
            {t.note && <div style={{ fontSize: "0.85rem", color: "#666", marginBottom: 4 }}>📝 {t.note}</div>}
            {t.items.map(item => (
              <div key={item.id} style={{ fontSize: "0.85rem", color: "#555" }}>
                • {item.product.name} — {item.quantity} ขวด
              </div>
            ))}
          </div>
        ))}
      </div>

      {showForm && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 500 }}>
            <h3 style={{ margin: "0 0 1rem", color: "var(--olive)" }}>ขอโอนสินค้าจากคลังหลัก</h3>
            
            <div style={{ marginBottom: "1rem" }}>
              <label className="label">โอนไปสาขา</label>
              <select className="input" value={targetBranchId} onChange={e => setTargetBranchId(e.target.value)}>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>

            {items.map((item, i) => (
              <div key={i} style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
                <select
                  className="input"
                  style={{ flex: 1 }}
                  value={item.productId}
                  onChange={e => setItems(prev => prev.map((it, j) => j === i ? { ...it, productId: e.target.value } : it))}
                >
                  <option value="">-- เลือกสินค้า --</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name} (มี {p.mainQty} ขวด)</option>)}
                </select>
                <input
                  type="number"
                  min={1}
                  className="input"
                  style={{ width: 80 }}
                  value={item.quantity}
                  onChange={e => setItems(prev => prev.map((it, j) => j === i ? { ...it, quantity: Number(e.target.value) } : it))}
                />
                <button onClick={() => setItems(prev => prev.filter((_, j) => j !== i))} style={{ background: "none", border: "none", cursor: "pointer", color: "red" }}>×</button>
              </div>
            ))}
            <button className="btn-secondary" style={{ fontSize: "0.8rem", marginBottom: "0.75rem" }} onClick={() => setItems(prev => [...prev, { productId: "", quantity: 1 }])}>
              + เพิ่มสินค้า
            </button>
            <div style={{ marginBottom: "0.75rem" }}>
              <label className="label">หมายเหตุ</label>
              <input className="input" value={note} onChange={e => setNote(e.target.value)} />
            </div>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button className="btn-primary" style={{ flex: 1 }} onClick={requestTransfer}>ส่งคำขอ</button>
              <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setShowForm(false)}>ยกเลิก</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
