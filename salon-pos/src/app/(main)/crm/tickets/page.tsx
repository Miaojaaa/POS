"use client";

import { useState, useEffect } from "react";

type TicketDef = { id: string; name: string; type: string; service?: { name: string }; discountPct?: number };
type Customer = { id: string; name: string; phone: string };
type CustomerTicket = { id: string; isUsed: boolean; issuedAt: string; ticketDef: TicketDef };

export default function TicketsPage() {
  const [defs, setDefs] = useState<TicketDef[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selected, setSelected] = useState<Customer | null>(null);
  const [customerTickets, setCustomerTickets] = useState<CustomerTicket[]>([]);
  const [issueDefId, setIssueDefId] = useState("");
  const [qty, setQty] = useState(1);
  const [q, setQ] = useState("");

  useEffect(() => {
    fetch("/api/tickets").then(r => r.json()).then(setDefs);
    fetch("/api/customers").then(r => r.json()).then(setCustomers);
  }, []);

  async function selectCustomer(c: Customer) {
    setSelected(c);
    const res = await fetch(`/api/tickets?customerId=${c.id}`);
    setCustomerTickets(await res.json());
  }

  async function issueTicket() {
    if (!selected || !issueDefId) return;
    await fetch("/api/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customerId: selected.id, ticketDefId: issueDefId, quantity: qty }),
    });
    const res = await fetch(`/api/tickets?customerId=${selected.id}`);
    setCustomerTickets(await res.json());
    alert(`✓ ออก Ticket ${qty} ใบ สำเร็จ`);
  }

  const filtered = customers.filter(c => c.name.includes(q) || c.phone.includes(q));
  const active = customerTickets.filter(t => !t.isUsed);
  const used = customerTickets.filter(t => t.isUsed);

  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--olive)", marginBottom: "1.5rem" }}>🎫 คูปอง / Ticket</h1>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: "1rem" }}>
        <div>
          <input className="input" style={{ marginBottom: "0.75rem" }} placeholder="ค้นหาสมาชิก..." value={q} onChange={e => setQ(e.target.value)} />
          <div className="card" style={{ maxHeight: 500, overflowY: "auto" }}>
            {filtered.map(c => (
              <div
                key={c.id}
                onClick={() => selectCustomer(c)}
                style={{
                  padding: "0.625rem",
                  borderRadius: 8,
                  cursor: "pointer",
                  border: `2px solid ${selected?.id === c.id ? "var(--olive)" : "transparent"}`,
                  background: selected?.id === c.id ? "#f0f5e8" : "transparent",
                  marginBottom: "0.25rem",
                }}
              >
                <div style={{ fontWeight: 500 }}>{c.name}</div>
                <div style={{ fontSize: "0.8rem", color: "#888" }}>{c.phone}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {selected ? (
            <>
              <div className="card">
                <h3 style={{ margin: "0 0 1rem", color: "var(--olive)" }}>ออก Ticket ให้ {selected.name}</h3>
                <div style={{ marginBottom: "0.75rem" }}>
                  <label className="label">ประเภท Ticket</label>
                  <select className="input" value={issueDefId} onChange={e => setIssueDefId(e.target.value)}>
                    <option value="">-- เลือก --</option>
                    {defs.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
                <div style={{ marginBottom: "0.75rem" }}>
                  <label className="label">จำนวน</label>
                  <input type="number" className="input" min={1} value={qty} onChange={e => setQty(Number(e.target.value))} />
                </div>
                <button className="btn-primary" style={{ width: "100%" }} onClick={issueTicket}>
                  🎫 ออก Ticket
                </button>
              </div>

              <div className="card">
                <h3 style={{ margin: "0 0 0.75rem", fontSize: "1rem", color: "var(--olive)" }}>
                  Ticket ที่ยังไม่ได้ใช้ ({active.length})
                </h3>
                {active.length === 0 ? <p style={{ color: "#aaa", fontSize: "0.875rem" }}>ไม่มี</p> : active.map(t => (
                  <div key={t.id} style={{ padding: "0.5rem", background: "#f0f5e8", borderRadius: 8, marginBottom: "0.5rem", fontSize: "0.875rem" }}>
                    <strong>{t.ticketDef.name}</strong>
                    <div style={{ color: "#888", fontSize: "0.8rem" }}>ออกเมื่อ {new Date(t.issuedAt).toLocaleDateString("th-TH")}</div>
                  </div>
                ))}

                {used.length > 0 && (
                  <>
                    <h3 style={{ margin: "1rem 0 0.75rem", fontSize: "0.9rem", color: "#888" }}>ใช้ไปแล้ว ({used.length})</h3>
                    {used.slice(0, 5).map(t => (
                      <div key={t.id} style={{ padding: "0.5rem", background: "#f5f5f5", borderRadius: 8, marginBottom: "0.5rem", fontSize: "0.8rem", color: "#888" }}>
                        <s>{t.ticketDef.name}</s>
                      </div>
                    ))}
                  </>
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
    </div>
  );
}
