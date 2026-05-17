"use client";

import { useState, useEffect } from "react";

type Customer = { id: string; name: string; phone: string; walletBalance: number };
type Transaction = { id: string; amount: number; type: string; note?: string; createdAt: string };

export default function WalletPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selected, setSelected] = useState<Customer | null>(null);
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [q, setQ] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [type, setType] = useState<"ADD" | "DEDUCT">("ADD");
  const [loading, setLoading] = useState(false);
  
  const [showPinModal, setShowPinModal] = useState(false);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");

  useEffect(() => {
    fetch("/api/customers").then(r => r.json()).then(data => {
      if (Array.isArray(data)) setCustomers(data);
    });
  }, []);

  async function selectCustomer(c: Customer) {
    setSelected(c);
    const res = await fetch(`/api/wallet?customerId=${c.id}`);
    const data = await res.json();
    if (Array.isArray(data)) setTxns(data);
    else setTxns([]);
  }

  async function handleWalletAction() {
    if (!selected || !amount) return;
    if (type === "ADD") {
      setShowPinModal(true);
      return;
    }
    await proceedWalletAction();
  }

  async function proceedWalletAction() {
    setLoading(true);
    const res = await fetch("/api/wallet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customerId: selected!.id, amount: Number(amount), type, note }),
    });
    const data = await res.json();
    if (res.ok) {
      setSelected({ ...selected!, walletBalance: data.walletBalance });
      setAmount("");
      setNote("");
      const txnRes = await fetch(`/api/wallet?customerId=${selected!.id}`);
      const txnData = await txnRes.json();
      if (Array.isArray(txnData)) setTxns(txnData);
    }
    setLoading(false);
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
      setShowPinModal(false);
      setPin("");
      await proceedWalletAction();
    } else {
      setPinError("PIN ไม่ถูกต้อง");
    }
  }

  const filtered = Array.isArray(customers) ? customers.filter(c => c.name.includes(q) || c.phone.includes(q)) : [];

  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--olive)", marginBottom: "1.5rem" }}>💰 Wallet สมาชิก</h1>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: "1rem" }}>
        <div>
          <input
            className="input"
            style={{ marginBottom: "0.75rem" }}
            placeholder="ค้นหาสมาชิก..."
            value={q}
            onChange={e => setQ(e.target.value)}
          />
          <div className="card" style={{ maxHeight: 500, overflowY: "auto" }}>
            {filtered.map(c => (
              <div
                key={c.id}
                onClick={() => selectCustomer(c)}
                style={{
                  padding: "0.75rem",
                  borderRadius: 8,
                  cursor: "pointer",
                  border: `2px solid ${selected?.id === c.id ? "var(--olive)" : "transparent"}`,
                  background: selected?.id === c.id ? "#f0f5e8" : "transparent",
                  marginBottom: "0.5rem",
                }}
              >
                <div style={{ fontWeight: 600 }}>{c.name}</div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", color: "#666" }}>
                  <span>{c.phone}</span>
                  <span style={{ fontWeight: 700, color: "var(--olive)" }}>฿{c.walletBalance.toLocaleString()}</span>
                </div>
              </div>
            ))}
            {filtered.length === 0 && <div style={{ textAlign: "center", padding: "2rem", color: "#aaa" }}>ไม่พบข้อมูล</div>}
          </div>
        </div>

        <div>
          {selected ? (
            <>
              <div className="card" style={{ marginBottom: "1rem" }}>
                <h3 style={{ margin: "0 0 1rem", fontSize: "1rem", color: "var(--olive)" }}>จัดการยอดเงิน: {selected.name}</h3>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
                  <div>
                    <label className="label">ประเภท</label>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <button 
                        className={type === "ADD" ? "btn-primary" : "btn-secondary"} 
                        style={{ flex: 1 }}
                        onClick={() => setType("ADD")}
                      >
                        เติมเงิน
                      </button>
                      <button 
                        className={type === "DEDUCT" ? "btn-danger" : "btn-secondary"} 
                        style={{ flex: 1, background: type === "DEDUCT" ? "#dc2626" : "", color: type === "DEDUCT" ? "white" : "" }}
                        onClick={() => setType("DEDUCT")}
                      >
                        ตัดเงิน
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="label">จำนวนเงิน (บาท)</label>
                    <input 
                      type="number" 
                      className="input" 
                      placeholder="0.00" 
                      value={amount} 
                      onChange={e => setAmount(e.target.value)} 
                    />
                  </div>
                </div>
                <div style={{ marginBottom: "1rem" }}>
                  <label className="label">หมายเหตุ</label>
                  <input className="input" placeholder="เช่น โปรโมชั่น, คืนเงิน..." value={note} onChange={e => setNote(e.target.value)} />
                </div>
                <button 
                  className="btn-primary" 
                  style={{ width: "100%" }} 
                  disabled={loading || !amount}
                  onClick={handleWalletAction}
                >
                  {loading ? "กำลังดำเนินการ..." : "ยืนยันทำรายการ"}
                </button>
              </div>

              <div className="card">
                <h3 style={{ margin: "0 0 1rem", fontSize: "1rem", color: "var(--olive)" }}>ประวัติการทำรายการ</h3>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid var(--beige-dark)", color: "#666" }}>
                      <th style={{ textAlign: "left", padding: "8px" }}>วันที่/เวลา</th>
                      <th style={{ textAlign: "center", padding: "8px" }}>ประเภท</th>
                      <th style={{ textAlign: "right", padding: "8px" }}>จำนวน</th>
                      <th style={{ textAlign: "left", padding: "8px" }}>หมายเหตุ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {txns.map(t => (
                      <tr key={t.id} style={{ borderBottom: "1px solid #f5f5f5" }}>
                        <td style={{ padding: "8px", fontSize: "0.8rem", color: "#666" }}>
                          {new Date(t.createdAt).toLocaleString("th-TH")}
                        </td>
                        <td style={{ padding: "8px", textAlign: "center" }}>
                          <span style={{ 
                            fontSize: "0.75rem", padding: "2px 6px", borderRadius: 4,
                            background: t.type === "ADD" ? "#dcfce7" : "#fee2e2",
                            color: t.type === "ADD" ? "#16a34a" : "#dc2626"
                          }}>
                            {t.type === "ADD" ? "เติมเงิน" : "ตัดเงิน"}
                          </span>
                        </td>
                        <td style={{ padding: "8px", textAlign: "right", fontWeight: 600, color: t.type === "ADD" ? "#16a34a" : "#dc2626" }}>
                          {t.type === "ADD" ? "+" : "-"}{t.amount.toLocaleString()}
                        </td>
                        <td style={{ padding: "8px", color: "#888", fontSize: "0.8rem" }}>{t.note || "-"}</td>
                      </tr>
                    ))}
                    {txns.length === 0 && (
                      <tr><td colSpan={4} style={{ textAlign: "center", padding: "2rem", color: "#aaa" }}>ไม่มีประวัติการทำรายการ</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="card" style={{ display: "flex", alignItems: "center", justifyContent: "center", color: "#aaa", minHeight: 300 }}>
              กรุณาเลือกสมาชิกเพื่อจัดการ Wallet
            </div>
          )}
        </div>
      </div>

      {showPinModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 320 }}>
            <h3 style={{ margin: "0 0 1rem", color: "var(--olive)" }}>ยืนยันสิทธิ์ Manager</h3>
            <p style={{ fontSize: "0.875rem", color: "#666", marginBottom: "1rem" }}>การเติมเงินเข้า Wallet ต้องใช้ Manager PIN ยืนยัน</p>
            <input 
              type="password" 
              className="input" 
              placeholder="กรอก PIN" 
              value={pin} 
              onChange={e => setPin(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && verifyPin()}
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
