"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type Order = {
  id: string;
  customerName: string;
  customerId?: string;
  customer?: { walletBalance: number; name: string };
  subtotal: number;
  total: number;
  discountAmount: number;
  status: string;
  items: { id: string; service: { name: string }; price: number }[];
  chemicals: { product: { name: string }; amountG: number; totalCost: number }[];
  technician: { name: string };
};

type Payment = { method: string; amount: number };

function CheckoutContent() {
  const router = useRouter();
  const params = useSearchParams();
  const orderId = params.get("orderId");

  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [discountPct, setDiscountPct] = useState(0);
  const [payments, setPayments] = useState<Payment[]>([{ method: "TRANSFER", amount: 0 }]);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [pendingApproval, setPendingApproval] = useState(false);
  const [approvedById, setApprovedById] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetch("/api/orders?status=DONE").then(r => r.json()).then(setOrders);
  }, []);

  useEffect(() => {
    if (orderId && orders.length > 0) {
      const o = orders.find(o => o.id === orderId);
      if (o) selectOrder(o);
    }
  }, [orderId, orders]);

  function selectOrder(order: Order) {
    setSelectedOrder(order);
    setPayments([{ method: "TRANSFER", amount: order.subtotal + Math.round(order.subtotal * 0.07) }]);
    setDiscountAmount(0);
    setDiscountPct(0);
  }

  const baseTotal = selectedOrder ? Math.max(0, selectedOrder.subtotal - discountAmount) : 0;
  const hasCreditCard = payments.some(p => p.method === "CREDIT_CARD");
  const serviceCharge = hasCreditCard ? Math.round(baseTotal * 0.03) : 0;
  const vat = Math.round((baseTotal + serviceCharge) * 0.07);
  
  const finalTotal = baseTotal + serviceCharge + vat;
  const totalPaid = payments.reduce((s, p) => s + p.amount, 0);
  const change = totalPaid - finalTotal;

  function handleDiscountChange(val: number, type: "amount" | "pct") {
    if (!selectedOrder) return;
    let newDiscount = 0;
    if (type === "amount") {
      newDiscount = val;
      setDiscountAmount(val);
      setDiscountPct(selectedOrder.subtotal > 0 ? (val / selectedOrder.subtotal) * 100 : 0);
    } else {
      newDiscount = (selectedOrder.subtotal * val) / 100;
      setDiscountPct(val);
      setDiscountAmount(newDiscount);
    }

    setPayments(prev => {
      if (prev.length === 1) {
        const base = Math.max(0, selectedOrder.subtotal - newDiscount);
        const hasCC = prev[0].method === "CREDIT_CARD";
        const sc = hasCC ? Math.round(base * 0.03) : 0;
        const v = Math.round((base + sc) * 0.07);
        return [{ ...prev[0], amount: base + sc + v }];
      }
      return prev;
    });

    if (val > 0 && !approvedById) {
      setPendingApproval(true);
      setShowPinModal(true);
    }
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
      setApprovedById("manager");
      setShowPinModal(false);
      setPendingApproval(false);
      setPin("");
    } else {
      setPinError("PIN ไม่ถูกต้อง");
    }
  }

  async function handleCheckout() {
    if (!selectedOrder) return;
    if (Math.abs(totalPaid - finalTotal) > 0.01 && change < 0) {
      alert("ยอดชำระไม่ครบ");
      return;
    }
    setProcessing(true);
    const res = await fetch(`/api/orders/${selectedOrder.id}/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        payments: payments.filter(p => p.amount > 0),
        discountAmount,
        discountPct,
        approvedById,
        serviceCharge,
        vat,
      }),
    });
    if (res.ok) {
      alert(`✓ ชำระเงินสำเร็จ!\nยอดรวม ฿${finalTotal.toLocaleString()}\nเงินทอน ฿${Math.max(0, change).toLocaleString()}`);
      router.push("/pos/queue");
    } else {
      alert("เกิดข้อผิดพลาด");
    }
    setProcessing(false);
  }

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <h1 style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--olive)", marginBottom: "1.5rem" }}>💳 ชำระเงิน</h1>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: "1rem" }}>
        {/* Order list */}
        <div className="card">
          <h3 style={{ margin: "0 0 1rem", fontSize: "1rem", color: "var(--olive)" }}>เลือกออร์เดอร์ที่รอชำระ</h3>
          {orders.length === 0 ? (
            <p style={{ color: "#aaa" }}>ไม่มีออร์เดอร์รอชำระ</p>
          ) : (
            orders.map(o => (
              <div
                key={o.id}
                onClick={() => selectOrder(o)}
                style={{
                  padding: "0.75rem",
                  borderRadius: 8,
                  border: `2px solid ${selectedOrder?.id === o.id ? "var(--olive)" : "var(--beige-dark)"}`,
                  background: selectedOrder?.id === o.id ? "#f0f5e8" : "white",
                  cursor: "pointer",
                  marginBottom: "0.5rem",
                }}
              >
                <div style={{ fontWeight: 600 }}>{o.customerName}</div>
                <div style={{ fontSize: "0.85rem", color: "#666" }}>{o.items.map(i => i.service.name).join(", ")}</div>
                <div style={{ fontWeight: 700, color: "var(--olive)" }}>฿{o.subtotal.toLocaleString()}</div>
              </div>
            ))
          )}
        </div>

        {/* Checkout panel */}
        {selectedOrder ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div className="card">
              <h3 style={{ margin: "0 0 1rem", fontSize: "1rem", color: "var(--olive)" }}>รายการบริการ</h3>
              {selectedOrder.items.map((item, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.875rem", marginBottom: 4 }}>
                  <span>{item.service.name}</span>
                  <span>฿{item.price.toLocaleString()}</span>
                </div>
              ))}
              <div style={{ borderTop: "1px solid var(--beige-dark)", paddingTop: 8, marginTop: 8, display: "flex", justifyContent: "space-between", fontWeight: 700 }}>
                <span>รวม</span>
                <span>฿{selectedOrder.subtotal.toLocaleString()}</span>
              </div>

              {/* Discount */}
              <div style={{ marginTop: "1rem" }}>
                <label className="label">ส่วนลด {approvedById ? "✓ (อนุมัติแล้ว)" : ""}</label>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <input
                    type="number"
                    className="input"
                    style={{ flex: 1 }}
                    placeholder="จำนวนเงิน"
                    value={discountAmount || ""}
                    onChange={e => handleDiscountChange(Number(e.target.value), "amount")}
                  />
                  <input
                    type="number"
                    className="input"
                    style={{ width: 80 }}
                    placeholder="%"
                    max={100}
                    value={discountPct ? discountPct.toFixed(1) : ""}
                    onChange={e => handleDiscountChange(Number(e.target.value), "pct")}
                  />
                </div>
              </div>

              {hasCreditCard && (
                <div style={{ marginTop: "0.5rem", display: "flex", justifyContent: "space-between", fontSize: "0.875rem" }}>
                  <span>Service Charge (3%)</span>
                  <span>฿{serviceCharge.toLocaleString()}</span>
                </div>
              )}
              <div style={{ marginTop: "0.25rem", display: "flex", justifyContent: "space-between", fontSize: "0.875rem" }}>
                <span>VAT (7%)</span>
                <span>฿{vat.toLocaleString()}</span>
              </div>
              <div style={{ marginTop: "0.75rem", display: "flex", justifyContent: "space-between", fontSize: "1.1rem", fontWeight: 700, color: "var(--olive)" }}>
                <span>ยอดสุทธิ</span>
                <span>฿{finalTotal.toLocaleString()}</span>
              </div>
            </div>

            {/* Payment methods */}
            <div className="card">
              <h3 style={{ margin: "0 0 1rem", fontSize: "1rem", color: "var(--olive)" }}>วิธีชำระเงิน</h3>

              {selectedOrder.customer && (
                <div style={{ background: "var(--beige)", padding: "0.5rem", borderRadius: 8, marginBottom: "0.75rem", fontSize: "0.875rem" }}>
                  💰 Wallet: ฿{selectedOrder.customer.walletBalance.toLocaleString()}
                </div>
              )}

              {payments.map((pay, i) => (
                <div key={i} style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
                  <select
                    className="input"
                    style={{ flex: 1 }}
                    value={pay.method}
                    onChange={e => {
                      const newMethod = e.target.value;
                      setPayments(prev => {
                        const newPayments = prev.map((p, j) => j === i ? { ...p, method: newMethod } : p);
                        if (newPayments.length === 1) {
                          const hasCC = newMethod === "CREDIT_CARD";
                          const sc = hasCC ? Math.round(baseTotal * 0.03) : 0;
                          const v = Math.round((baseTotal + sc) * 0.07);
                          newPayments[0].amount = baseTotal + sc + v;
                        }
                        return newPayments;
                      });
                    }}
                  >
                    <option value="CASH">เงินสด</option>
                    <option value="TRANSFER">โอนเงิน (QR)</option>
                    <option value="CREDIT_CARD">บัตรเครดิต</option>
                    <option value="WALLET">Wallet</option>
                  </select>
                  <input
                    type="number"
                    className="input"
                    style={{ width: 120 }}
                    value={pay.amount || ""}
                    onChange={e => setPayments(prev => prev.map((p, j) => j === i ? { ...p, amount: Number(e.target.value) } : p))}
                  />
                  {payments.length > 1 && (
                    <button onClick={() => setPayments(prev => prev.filter((_, j) => j !== i))} style={{ background: "none", border: "none", cursor: "pointer", color: "red" }}>×</button>
                  )}
                </div>
              ))}

              <button className="btn-secondary" style={{ fontSize: "0.8rem" }} onClick={() => setPayments(prev => [...prev, { method: "TRANSFER", amount: 0 }])}>
                + เพิ่มช่องทาง
              </button>

              <div style={{ marginTop: "0.75rem", display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: "0.875rem" }}>รวมยอดชำระ</span>
                <span style={{ fontWeight: 700 }}>฿{totalPaid.toLocaleString()}</span>
              </div>
              {change > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", color: "var(--success-green)", fontWeight: 700 }}>
                  <span>เงินทอน</span>
                  <span>฿{change.toLocaleString()}</span>
                </div>
              )}
              {change < 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", color: "var(--alert-red)", fontWeight: 700 }}>
                  <span>ยังขาดอีก</span>
                  <span>฿{(-change).toLocaleString()}</span>
                </div>
              )}
            </div>

            <button
              className="btn-primary"
              style={{ padding: "0.875rem", fontSize: "1rem" }}
              onClick={handleCheckout}
              disabled={processing}
            >
              {processing ? "กำลังบันทึก..." : "✓ ยืนยันการชำระเงิน"}
            </button>
          </div>
        ) : (
          <div className="card" style={{ display: "flex", alignItems: "center", justifyContent: "center", color: "#aaa" }}>
            กรุณาเลือกออร์เดอร์
          </div>
        )}
      </div>

      {/* PIN Modal */}
      {showPinModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 350 }}>
            <h3 style={{ margin: "0 0 1rem", color: "var(--olive)" }}>🔐 ยืนยัน Manager PIN</h3>
            <p style={{ fontSize: "0.875rem", color: "#666" }}>กรุณากรอก Manager PIN เพื่ออนุมัติส่วนลด</p>
            <input
              type="password"
              className="input"
              style={{ marginBottom: "1rem" }}
              placeholder="PIN 4-6 หลัก"
              value={pin}
              onChange={e => setPin(e.target.value)}
              onKeyDown={e => e.key === "Enter" && verifyPin()}
            />
            {pinError && <div style={{ color: "var(--alert-red)", fontSize: "0.875rem", marginBottom: "0.5rem" }}>{pinError}</div>}
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button className="btn-primary" style={{ flex: 1 }} onClick={verifyPin}>ยืนยัน</button>
              <button className="btn-secondary" style={{ flex: 1 }} onClick={() => { setShowPinModal(false); setDiscountAmount(0); setDiscountPct(0); }}>
                ยกเลิก
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div>กำลังโหลด...</div>}>
      <CheckoutContent />
    </Suspense>
  );
}
