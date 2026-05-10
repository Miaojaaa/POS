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
    fetch("/api/customers").then(r => r.json()).then(setCustomers);
  }, []);

  async function selectCustomer(c: Customer) {
    setSelected(c);
    const res = await fetch(`/api/wallet?customerId=${c.id}`);
    setTxns(await res.json());
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
      setTxns(await txnRes.json());
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

  const filtered = customers.filter(c => c.name.includes(q) || c.phone.includes(q));

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
                  marginBottom: "0.25rem",
                }}
              >
                <div style={{ fontWeight: 500 }}>{c.name}</div>
                <div style={{ fontSize: "0.8rem", color: "#888" }}>{c.phone}</div>
                <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--olive)" }}>฿{c.walletBalance.toLocaleString()}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {selected ? (
            <>
              <div className="card">
                <h3 style={{ margin: "0 0 0.5rem", color: "var(--olive)" }}>{selected.name}</h3>
                <div style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "1rem" }}>
                  💰 ฿{selected.walletBalance.toLocaleString()}
                </div>

                <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem" }}>
                  <button
                    onClick={() => setType("ADD")}
                    style={{
                      flex: 1, padding: "0.5rem", border: "2px solid",
                      borderColor: type === "ADD" ? "var(--olive)" : "var(--beige-dark)",
                      background: type === "ADD" ? "var(--olive)" : "white",
                      color: type === "ADD" ? "white" : "var(--text-dark)",
                      borderRadius: 8, cursor: "pointer",
                    }}
                  >
                    + เติมเงิน
                  </button>
                  <button
                    onClick={() => setType("DEDUCT")}
                    style={{
                      flex: 1, padding: "0.5rem", border: "2px solid",
                      borderColor: type === "DEDUCT" ? "var(--alert-red)" : "var(--beige-dark)",
                      background: type === "DEDUCT" ? "var(--alert-red)" : "white",
                      color: type === "DEDUCT" ? "white" : "var(--text-dark)",
                      borderRadius: 8, cursor: "pointer",
                    }}
                  >
                    - หักเงิน
                  </button>
                </div>

                <div style={{ marginBottom: "0.75rem" }}>
                  <label className="label">จำนวนเงิน (บาท)</label>
                  <input
                    type="number"
                    className="input"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div style={{ marginBottom: "0.75rem" }}>
                  <label className="label">หมายเหตุ</label>
                  <input
                    className="input"
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    placeholder="เช่น ซื้อ Course สปา"
                  />
                </div>
                <button className="btn-primary" style={{ width: "100%" }} onClick={handleWalletAction} disabled={loading}>
                  {loading ? "กำลังบันทึก..." : type === "ADD" ? "✓ เติมเงิน" : "✓ หักเงิน"}
                </button>
              </div>

              <div className="card">
                <h3 style={{ margin: "0 0 1rem", fontSize: "1rem", color: "var(--olive)" }}>ประวัติ Wallet</h3>
                {txns.length === 0 ? (
                  <p style={{ color: "#aaa" }}>ยังไม่มีรายการ</p>
                ) : (
                  txns.map(t => (
                    <div key={t.id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #f5f5f5", fontSize: "0.875rem" }}>
                      <div>
                        <span style={{ color: t.amount > 0 ? "var(--success-green)" : "var(--alert-red)", fontWeight: 700 }}>
                          {t.amount > 0 ? "+" : ""}฿{t.amount.toLocaleString()}
                        </span>
                        {t.note && <span style={{ color: "#888", marginLeft: 8 }}>{t.note}</span>}
                      </div>
                      <span style={{ color: "#aaa" }}>{new Date(t.createdAt).toLocaleDateString("th-TH")}</span>
                    </div>
                  ))
                )}
              </div>
            </>
          ) : (
            <div className="card" style={{ display: "flex", alignItems: "center", justifyContent: "center", color: "#aaa", minHeight: 200 }}>
              กรุณาเลือกสมาชิก
            </div>
          )}
        </div>
      </div>

      {/* PIN Modal */}
      {showPinModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 350 }}>
            <h3 style={{ margin: "0 0 1rem", color: "var(--olive)" }}>🔐 ยืนยัน Manager PIN</h3>
            <p style={{ fontSize: "0.875rem", color: "#666" }}>กรุณากรอก Manager PIN เพื่ออนุมัติการเติมเงิน</p>
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
              <button className="btn-secondary" style={{ flex: 1 }} onClick={() => { setShowPinModal(false); setPin(""); setPinError(""); }}>
                ยกเลิก
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
