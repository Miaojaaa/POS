"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type CustomerTicket = {
  id: string;
  isUsed: boolean;
  ticketDef: {
    id: string;
    name: string;
    type: string;
    serviceId?: string | null;
    discountPct?: number | null;
    fixedValue?: number | null;
    service?: { name: string } | null;
  };
};

type Order = {
  id: string;
  customerName: string;
  customerId?: string;
  customer?: { walletBalance: number; name: string };
  subtotal: number;
  total: number;
  discountAmount: number;
  status: string;
  items: { id: string; serviceId: string; service: { id: string; name: string }; price: number }[];
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
  const [approvedById, setApprovedById] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  const [customerTickets, setCustomerTickets] = useState<CustomerTicket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<CustomerTicket | null>(null);

  useEffect(() => {
    fetch("/api/orders?status=DONE").then(r => r.json()).then(data => {
      if (Array.isArray(data)) setOrders(data);
      else setOrders([]);
    });
  }, []);

  useEffect(() => {
    if (orderId && Array.isArray(orders) && orders.length > 0) {
      const o = orders.find(o => o.id === orderId);
      if (o) selectOrder(o);
    }
  }, [orderId, orders]);

  async function selectOrder(order: Order) {
    setSelectedOrder(order);
    setDiscountAmount(0);
    setDiscountPct(0);
    setApprovedById(null);
    setSelectedTicket(null);
    setCustomerTickets([]);

    const base = order.subtotal;
    const v = Math.round(base * 0.07);
    setPayments([{ method: "TRANSFER", amount: base + v }]);

    if (order.customerId) {
      const res = await fetch(`/api/tickets?customerId=${order.customerId}`);
      const all = await res.json();
      if (Array.isArray(all)) {
        setCustomerTickets(all.filter(t => !t.isUsed));
      }
    }
  }

  function getTicketDiscount(ticket: CustomerTicket | null, order: Order | null): number {
    if (!ticket || !order) return 0;
    const def = ticket.ticketDef;
    if (def.type === "FIXED") return def.fixedValue || 0;
    if (def.type === "SERVICE" && def.serviceId) {
      const item = order.items.find(i => i.serviceId === def.serviceId);
      return item ? item.price * ((def.discountPct ?? 100) / 100) : 0;
    }
    return 0;
  }

  const ticketDiscount = getTicketDiscount(selectedTicket, selectedOrder);

  const applicableTickets = customerTickets.filter(t => {
    if (t.ticketDef.type === "FIXED") return true;
    if (t.ticketDef.type === "SERVICE" && t.ticketDef.serviceId) {
      return selectedOrder?.items.some(i => i.serviceId === t.ticketDef.serviceId);
    }
    return false;
  });

  const subtotal = selectedOrder ? selectedOrder.subtotal : 0;
  const vat = Math.round(subtotal * 0.07);
  const totalWithVat = subtotal + vat;
  const finalDiscount = Math.max(discountAmount, (totalWithVat * discountPct) / 100) + ticketDiscount;
  const grandTotal = Math.max(0, totalWithVat - finalDiscount);
  const totalPaid = payments.reduce((s, p) => s + p.amount, 0);
  const remaining = grandTotal - totalPaid;

  async function verifyPin() {
    setPinError("");
    const res = await fetch("/api/verify-pin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "MANAGER", pin }),
    });
    const data = await res.json();
    if (data.ok) {
      setApprovedById(data.userId);
      setShowPinModal(false);
      setPin("");
    } else {
      setPinError("PIN ไม่ถูกต้อง");
    }
  }

  async function handleCheckout() {
    if (!selectedOrder) return;
    if (remaining !== 0) {
      alert("ยอดชำระไม่ตรงกับยอดรวม");
      return;
    }
    if (finalDiscount > 0 && !approvedById) {
      alert("ต้องมี Manager PIN อนุมัติส่วนลด");
      setShowPinModal(true);
      return;
    }

    setProcessing(true);
    try {
      const res = await fetch(`/api/orders/${selectedOrder.id}/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payments,
          discountAmount: finalDiscount,
          approvedById,
          ticketId: selectedTicket?.id,
        }),
      });
      if (res.ok) {
        alert("เช็คเอาท์สำเร็จ");
        router.push("/pos/queue");
      } else {
        const data = await res.json();
        alert(data.error || "เกิดข้อผิดพลาด");
      }
    } catch {
      alert("การเชื่อมต่อล้มเหลว");
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--olive)", marginBottom: "1.5rem" }}>💳 เช็คเอาท์ / ชำระเงิน</h1>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: "1.5rem" }}>
        {/* Left: Pending Orders */}
        <div>
          <h3 style={{ fontSize: "1rem", color: "var(--olive)", marginBottom: "1rem" }}>ออร์เดอร์รอชำระเงิน ({orders.length})</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {orders.map(o => (
              <div
                key={o.id}
                className="card"
                onClick={() => selectOrder(o)}
                style={{
                  cursor: "pointer",
                  border: `2px solid ${selectedOrder?.id === o.id ? "var(--olive)" : "transparent"}`,
                  background: selectedOrder?.id === o.id ? "#f0f5e8" : "white",
                  padding: "1rem",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                  <span style={{ fontWeight: 700 }}>{o.customerName}</span>
                  <span style={{ color: "var(--olive)", fontWeight: 700 }}>฿{o.subtotal.toLocaleString()}</span>
                </div>
                <div style={{ fontSize: "0.8rem", color: "#666" }}>
                  ช่าง: {o.technician.name} · {o.items.length} รายการ
                </div>
              </div>
            ))}
            {orders.length === 0 && (
              <div style={{ textAlign: "center", padding: "3rem", color: "#aaa" }}>ไม่มีออร์เดอร์รอชำระ</div>
            )}
          </div>
        </div>

        {/* Right: Payment Form */}
        {selectedOrder ? (
          <div className="card" style={{ padding: "1.5rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", borderBottom: "1px solid #eee", paddingBottom: "1rem" }}>
              <h2 style={{ margin: 0, fontSize: "1.25rem" }}>{selectedOrder.customerName}</h2>
              <span style={{ fontSize: "0.875rem", color: "#666" }}>Order ID: {selectedOrder.id.slice(-6).toUpperCase()}</span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem" }}>
              {/* Summary */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                  <span>ค่าบริการ/สินค้า</span>
                  <span>฿{subtotal.toLocaleString()}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                  <span>VAT 7%</span>
                  <span>฿{vat.toLocaleString()}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, marginTop: "1rem", paddingTop: "0.5rem", borderTop: "1px solid #eee" }}>
                  <span>ยอดรวมทั้งสิ้น</span>
                  <span>฿{totalWithVat.toLocaleString()}</span>
                </div>

                {/* Tickets */}
                {applicableTickets.length > 0 && (
                  <div style={{ marginTop: "1.5rem", padding: "1rem", background: "#f0f5e8", borderRadius: 8 }}>
                    <div style={{ fontSize: "0.875rem", fontWeight: 600, marginBottom: "0.5rem" }}>เลือกคูปอง/Ticket</div>
                    <select
                      className="input"
                      value={selectedTicket?.id || ""}
                      onChange={e => {
                        const t = applicableTickets.find(x => x.id === e.target.value);
                        setSelectedTicket(t || null);
                      }}
                    >
                      <option value="">-- ไม่ใช้คูปอง --</option>
                      {applicableTickets.map(t => (
                        <option key={t.id} value={t.id}>{t.ticketDef.name}</option>
                      ))}
                    </select>
                    {ticketDiscount > 0 && (
                      <div style={{ marginTop: "0.5rem", fontSize: "0.8rem", color: "var(--olive)", fontWeight: 600 }}>
                        ลดเพิ่ม ฿{ticketDiscount.toLocaleString()}
                      </div>
                    )}
                  </div>
                )}

                {/* Direct Discount */}
                <div style={{ marginTop: "1.5rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.875rem", marginBottom: "0.5rem" }}>
                    <span>ส่วนลดเพิ่มเติม</span>
                    {approvedById ? (
                      <span style={{ color: "var(--success-green)", fontSize: "0.75rem" }}>✓ อนุมัติแล้ว</span>
                    ) : (
                      <button style={{ background: "none", border: "none", color: "var(--olive)", fontSize: "0.75rem", cursor: "pointer", textDecoration: "underline" }} onClick={() => setShowPinModal(true)}>
                        Manager PIN
                      </button>
                    )}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                    <div style={{ position: "relative" }}>
                      <input type="number" className="input" placeholder="0" value={discountAmount || ""} onChange={e => { setDiscountAmount(Number(e.target.value)); setDiscountPct(0); }} />
                      <span style={{ position: "absolute", right: 10, top: 10, color: "#999", fontSize: "0.8rem" }}>฿</span>
                    </div>
                    <div style={{ position: "relative" }}>
                      <input type="number" className="input" placeholder="0" value={discountPct || ""} onChange={e => { setDiscountPct(Number(e.target.value)); setDiscountAmount(0); }} />
                      <span style={{ position: "absolute", right: 10, top: 10, color: "#999", fontSize: "0.8rem" }}>%</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Payments */}
              <div>
                <div style={{ fontWeight: 600, marginBottom: "1rem" }}>ช่องทางการชำระเงิน</div>
                {payments.map((p, idx) => (
                  <div key={idx} style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
                    <select
                      className="input"
                      style={{ flex: 1 }}
                      value={p.method}
                      onChange={e => {
                        const next = [...payments];
                        next[idx].method = e.target.value;
                        setPayments(next);
                      }}
                    >
                      <option value="TRANSFER">โอนเงิน</option>
                      <option value="CASH">เงินสด</option>
                      <option value="CREDIT">บัตรเครดิต</option>
                      <option value="WALLET">Wallet</option>
                    </select>
                    <input
                      type="number"
                      className="input"
                      style={{ flex: 1 }}
                      value={p.amount || ""}
                      onChange={e => {
                        const next = [...payments];
                        next[idx].amount = Number(e.target.value);
                        setPayments(next);
                      }}
                    />
                    {payments.length > 1 && (
                      <button onClick={() => setPayments(prev => prev.filter((_, i) => i !== idx))} style={{ background: "none", border: "none", color: "#ccc", cursor: "pointer" }}>×</button>
                    )}
                  </div>
                ))}
                <button
                  onClick={() => setPayments([...payments, { method: "CASH", amount: 0 }])}
                  style={{ background: "none", border: "none", color: "var(--olive)", fontSize: "0.8rem", cursor: "pointer", padding: "0.5rem 0" }}
                >
                  + เพิ่มช่องทางชำระเงิน
                </button>

                <div style={{ marginTop: "2rem", padding: "1.25rem", background: "var(--olive)", color: "white", borderRadius: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.9rem", opacity: 0.9, marginBottom: "0.25rem" }}>ยอดสุทธิ</div>
                  <div style={{ fontSize: "2rem", fontWeight: 800 }}>฿{grandTotal.toLocaleString()}</div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", marginTop: "1rem", borderTop: "1px solid rgba(255,255,255,0.2)", paddingTop: "0.5rem" }}>
                    <span>ชำระแล้ว: ฿{totalPaid.toLocaleString()}</span>
                    <span style={{ color: remaining === 0 ? "#86efac" : "#fca5a5", fontWeight: 700 }}>
                      {remaining > 0 ? `ขาดอีก: ฿${remaining.toLocaleString()}` : remaining < 0 ? `ทอน: ฿${Math.abs(remaining).toLocaleString()}` : "✓ ยอดครบถ้วน"}
                    </span>
                  </div>
                </div>

                <button
                  className="btn-primary"
                  style={{ width: "100%", marginTop: "1rem", height: "3.5rem", fontSize: "1.1rem" }}
                  disabled={processing || remaining !== 0}
                  onClick={handleCheckout}
                >
                  {processing ? "กำลังดำเนินการ..." : "ยืนยันการชำระเงิน"}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="card" style={{ display: "flex", alignItems: "center", justifyContent: "center", color: "#aaa", minHeight: 400 }}>
            กรุณาเลือกออร์เดอร์ทางด้านซ้ายเพื่อทำรายการ
          </div>
        )}
      </div>

      {showPinModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 320 }}>
            <h3 style={{ margin: "0 0 1rem", color: "var(--olive)" }}>ยืนยันสิทธิ์ Manager</h3>
            <p style={{ fontSize: "0.875rem", color: "#666", marginBottom: "1rem" }}>การใช้ส่วนลดต้องให้ Manager ป้อน PIN ยืนยัน</p>
            <input
              type="password"
              className="input"
              placeholder="กรอก PIN"
              value={pin}
              onChange={e => setPin(e.target.value)}
              onKeyDown={e => e.key === "Enter" && verifyPin()}
              autoFocus
            />
            {pinError && <p style={{ color: "var(--alert-red)", fontSize: "0.75rem", marginTop: 4 }}>{pinError}</p>}
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "1.25rem" }}>
              <button className="btn-primary" style={{ flex: 1 }} onClick={verifyPin}>ยืนยัน</button>
              <button className="btn-secondary" style={{ flex: 1 }} onClick={() => { setShowPinModal(false); setPin(""); setPinError(""); }}>ยกเลิก</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <CheckoutContent />
    </Suspense>
  );
}
