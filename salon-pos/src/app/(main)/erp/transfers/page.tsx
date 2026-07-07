"use client";

import { useEffect, useState } from "react";
import { useBranch } from "@/context/BranchContext";
import { ArrowRightLeft, Send } from "lucide-react";
import SearchInput from "@/components/SearchInput";
import PinVerifyModal, { PinVerifyResult } from "@/components/PinVerifyModal";

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
  const [items, setItems] = useState<{ productId: string; productName: string; quantity: number }[]>([{ productId: "", productName: "", quantity: 1 }]);
  const [note, setNote] = useState("");

  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [pinContext, setPinContext] = useState<
    | { type: "REQUEST" }
    | { type: "APPROVE"; transferId: string }
    | null
  >(null);

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

  function openRequestPin() {
    const validItems = items.filter(i => i.productId && i.quantity > 0);
    if (validItems.length === 0) { alert("กรุณาเลือกสินค้า"); return; }

    const overflowing = validItems.filter(i => {
      const stock = products.find(p => p.id === i.productId)?.mainQty ?? 0;
      return i.quantity > stock;
    });
    if (overflowing.length > 0) {
      const names = overflowing.map(i => i.productName).join(", ");
      alert(`จำนวนที่ขอเกินคลังหลัก: ${names}`);
      return;
    }

    setPinContext({ type: "REQUEST" });
    setPinModalOpen(true);
  }

  function openApprovePin(transferId: string) {
    setPinContext({ type: "APPROVE", transferId });
    setPinModalOpen(true);
  }

  async function handlePinSuccess(result: PinVerifyResult) {
    if (!pinContext) return;
    setPinModalOpen(false);

    if (pinContext.type === "REQUEST") {
      const validItems = items
        .filter(i => i.productId && i.quantity > 0)
        .map(i => ({ productId: i.productId, quantity: i.quantity }));
      const res = await fetch("/api/transfers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: validItems,
          note,
          branchId: targetBranchId,
          createdById: result.userId,
        }),
      });
      if (!res.ok) {
        alert("ส่งคำขอไม่สำเร็จ");
        return;
      }
      setShowForm(false);
      setItems([{ productId: "", productName: "", quantity: 1 }]);
      setNote("");
      load();
    } else if (pinContext.type === "APPROVE") {
      const res = await fetch("/api/transfers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: pinContext.transferId, action: "APPROVE", approvedById: result.userId }),
      });
      if (!res.ok) alert("อนุมัติไม่สำเร็จ");
      load();
    }

    setPinContext(null);
  }

  async function rejectTransfer(id: string) {
    await fetch("/api/transfers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action: "REJECT" }),
    });
    load();
  }

  const STATUS_LABEL: Record<string, string> = { PENDING: "รอการอนุมัติ", APPROVED: "อนุมัติแล้ว", REJECTED: "ปฏิเสธ" };
  const STATUS_COLOR: Record<string, string> = { PENDING: "#856404", APPROVED: "#155724", REJECTED: "#721c24" };
  const STATUS_BG: Record<string, string> = { PENDING: "#FFF3CD", APPROVED: "#D4EDDA", REJECTED: "#F8D7DA" };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <h1 style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "1.4rem", fontWeight: 700, color: "var(--olive)", margin: 0 }}>
          <ArrowRightLeft size={24} /> โอนสินค้า Main → คลังหน้าร้าน
        </h1>
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
                  <button className="btn-primary" style={{ fontSize: "0.8rem", padding: "4px 12px" }} onClick={() => openApprovePin(t.id)}>
                    ✓ อนุมัติ
                  </button>
                  <button className="btn-danger" style={{ fontSize: "0.8rem", padding: "4px 12px" }} onClick={() => rejectTransfer(t.id)}>
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
          <div className="modal" style={{ maxWidth: 540 }}>
            <h3 style={{ display: "flex", alignItems: "center", gap: "0.5rem", margin: "0 0 1rem", color: "var(--olive)" }}>
              <Send size={18} /> ขอโอนสินค้าจากคลังหลัก
            </h3>

            <div style={{ marginBottom: "1rem" }}>
              <label className="label">โอนไปสาขา</label>
              <select className="input" value={targetBranchId} onChange={e => setTargetBranchId(e.target.value)}>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>

            {items.map((item, i) => {
              const picked = products.find(p => p.id === item.productId);
              const maxQty = picked?.mainQty ?? 0;
              const overLimit = !!picked && item.quantity > maxQty;
              return (
                <div key={i} style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem", alignItems: "flex-start" }}>
                  <div style={{ flex: 1 }}>
                    <SearchInput
                      items={products.map(p => ({
                        id: p.id,
                        label: p.name,
                        sublabel: `เหลือ ${p.mainQty} ขวด`,
                        disabled: p.mainQty <= 0,
                      }))}
                      value={item.productName}
                      onChange={(text) => setItems(prev => prev.map((it, j) => j === i ? { ...it, productName: text, productId: "" } : it))}
                      onSelect={(sel) => setItems(prev => prev.map((it, j) => {
                        if (j !== i) return it;
                        const target = products.find(p => p.id === sel.id);
                        const cap = target?.mainQty ?? 0;
                        return { ...it, productId: sel.id, productName: sel.label, quantity: Math.min(Math.max(1, it.quantity), Math.max(1, cap)) };
                      }))}
                      placeholder="🔍 ค้นหาสินค้า..."
                    />
                    {picked && (
                      <div style={{ fontSize: "0.75rem", color: "#666", marginTop: 4, paddingLeft: 4 }}>
                        คงเหลือในคลังหลัก: <strong style={{ color: maxQty > 0 ? "var(--olive)" : "var(--alert-red)" }}>{maxQty} ขวด</strong>
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 90 }}>
                    <input
                      type="number"
                      min={1}
                      max={picked ? maxQty : undefined}
                      className="input"
                      style={{
                        width: 80,
                        marginBottom: 0,
                        borderColor: overLimit ? "var(--alert-red)" : undefined,
                      }}
                      value={item.quantity}
                      onChange={e => {
                        const raw = Number(e.target.value);
                        const clamped = picked ? Math.min(Math.max(1, raw || 1), Math.max(1, maxQty)) : Math.max(1, raw || 1);
                        setItems(prev => prev.map((it, j) => j === i ? { ...it, quantity: clamped } : it));
                      }}
                      disabled={!!picked && maxQty <= 0}
                    />
                    {picked && (
                      <div style={{ fontSize: "0.7rem", color: "#888", marginTop: 2 }}>
                        / {maxQty}
                      </div>
                    )}
                  </div>
                  <button onClick={() => setItems(prev => prev.filter((_, j) => j !== i))} style={{ background: "none", border: "none", cursor: "pointer", color: "red", padding: "0.5rem" }}>×</button>
                </div>
              );
            })}
            <button className="btn-secondary" style={{ fontSize: "0.8rem", marginBottom: "0.75rem" }} onClick={() => setItems(prev => [...prev, { productId: "", productName: "", quantity: 1 }])}>
              + เพิ่มสินค้า
            </button>
            <div style={{ marginBottom: "0.75rem" }}>
              <label className="label">หมายเหตุ</label>
              <input className="input" value={note} onChange={e => setNote(e.target.value)} />
            </div>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button className="btn-primary" style={{ flex: 1 }} onClick={openRequestPin}>ส่งคำขอ (ยืนยัน PIN)</button>
              <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setShowForm(false)}>ยกเลิก</button>
            </div>
          </div>
        </div>
      )}

      <PinVerifyModal
        open={pinModalOpen}
        title={pinContext?.type === "APPROVE" ? "ยืนยัน PIN ผู้อนุมัติ" : "ยืนยัน PIN ผู้ขอโอน"}
        description={pinContext?.type === "APPROVE"
          ? "กรอก PIN ของผู้อนุมัติ (Manager หรือ Owner)"
          : "กรอก PIN ของผู้ขอโอน (Manager หรือ Owner)"
        }
        requiredRole="MANAGER"
        onSuccess={handlePinSuccess}
        onClose={() => { setPinModalOpen(false); setPinContext(null); }}
      />
    </div>
  );
}
