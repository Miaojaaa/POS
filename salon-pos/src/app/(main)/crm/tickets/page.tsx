"use client";

import { useState, useEffect } from "react";

type Service = { id: string; name: string; price: number };
type TicketDef = {
  id: string;
  name: string;
  type: string;
  serviceId?: string | null;
  discountPct?: number | null;
  fixedValue?: number | null;
  service?: { name: string } | null;
};
type Customer = { id: string; name: string; phone: string };
type CustomerTicket = { id: string; isUsed: boolean; issuedAt: string; ticketDef: TicketDef };

export default function TicketsPage() {
  const [defs, setDefs] = useState<TicketDef[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selected, setSelected] = useState<Customer | null>(null);
  const [customerTickets, setCustomerTickets] = useState<CustomerTicket[]>([]);
  const [issueDefId, setIssueDefId] = useState("");
  const [qty, setQty] = useState(1);
  const [q, setQ] = useState("");

  // Create ticket def form
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<"FIXED" | "SERVICE">("FIXED");
  const [newFixedValue, setNewFixedValue] = useState<number | "">("");
  const [newServiceId, setNewServiceId] = useState("");
  const [newDiscountPct, setNewDiscountPct] = useState<number | "">(100);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetch("/api/tickets").then(r => r.json()).then(data => {
      if (Array.isArray(data)) setDefs(data);
    });
    fetch("/api/customers").then(r => r.json()).then(data => {
      if (Array.isArray(data)) setCustomers(data);
    });
    fetch("/api/services").then(r => r.json()).then(data => {
      if (Array.isArray(data)) setServices(data);
    });
  }, []);

  async function selectCustomer(c: Customer) {
    setSelected(c);
    const res = await fetch(`/api/tickets?customerId=${c.id}`);
    const data = await res.json();
    if (Array.isArray(data)) setCustomerTickets(data);
    else setCustomerTickets([]);
  }

  async function issueTicket() {
    if (!selected || !issueDefId) return;
    await fetch("/api/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customerId: selected.id, ticketDefId: issueDefId, quantity: qty }),
    });
    const res = await fetch(`/api/tickets?customerId=${selected.id}`);
    const data = await res.json();
    if (Array.isArray(data)) setCustomerTickets(data);
    alert(`✓ ออก Ticket ${qty} ใบ สำเร็จ`);
  }

  async function createDef() {
    if (!newName) return alert("กรุณากรอกชื่อคูปอง");
    if (newType === "FIXED" && !newFixedValue) return alert("กรุณากรอกจำนวนเงินส่วนลด");
    if (newType === "SERVICE" && !newServiceId) return alert("กรุณาเลือกบริการ");

    setCreating(true);
    const body: Record<string, unknown> = { name: newName, type: newType };
    if (newType === "FIXED") {
      body.fixedValue = Number(newFixedValue);
    } else {
      body.serviceId = newServiceId;
      body.discountPct = Number(newDiscountPct) || 100;
    }

    const res = await fetch("/api/ticket-defs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const def = await res.json();
      setDefs(prev => [...prev, def]);
      setNewName("");
      setNewFixedValue("");
      setNewServiceId("");
      setNewDiscountPct(100);
      setShowCreate(false);
    } else {
      alert("เกิดข้อผิดพลาด");
    }
    setCreating(false);
  }

  async function deleteDef(id: string, name: string) {
    if (!confirm(`ลบประเภทคูปอง "${name}" ใช่หรือไม่?`)) return;
    const res = await fetch(`/api/ticket-defs?id=${id}`, { method: "DELETE" });
    if (res.ok) {
      setDefs(prev => prev.filter(d => d.id !== id));
    } else {
      const data = await res.json();
      alert(data.error || "ไม่สามารถลบได้");
    }
  }

  function defLabel(d: TicketDef) {
    if (d.type === "FIXED") return `ลด ฿${(d.fixedValue || 0).toLocaleString()}`;
    const pct = d.discountPct || 100;
    return pct === 100 ? `${d.service?.name || ""} ฟรี` : `${d.service?.name || ""} ลด ${pct}%`;
  }

  const filtered = Array.isArray(customers) ? customers.filter(c => c.name.includes(q) || c.phone.includes(q)) : [];
  const active = Array.isArray(customerTickets) ? customerTickets.filter(t => !t.isUsed) : [];
  const used = Array.isArray(customerTickets) ? customerTickets.filter(t => t.isUsed) : [];

  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--olive)", marginBottom: "1.5rem" }}>🎫 คูปอง / Ticket</h1>

      {/* Manage ticket definitions */}
      <div className="card" style={{ marginBottom: "1rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0, fontSize: "1rem", color: "var(--olive)" }}>ประเภทคูปองทั้งหมด ({Array.isArray(defs) ? defs.length : 0})</h3>
          <button
            className={showCreate ? "btn-danger" : "btn-primary"}
            style={{ fontSize: "0.8rem", padding: "0.375rem 0.875rem" }}
            onClick={() => setShowCreate(!showCreate)}
          >
            {showCreate ? "ยกเลิก" : "+ คูปอง"}
          </button>
        </div>

        {/* Create form */}
        {showCreate && (
          <div style={{ marginTop: "1rem", padding: "1rem", background: "var(--beige)", borderRadius: 8 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "0.75rem" }}>
              <div>
                <label className="label">ชื่อคูปอง</label>
                <input
                  className="input"
                  placeholder="เช่น คูปองสปาผมฟรี"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                />
              </div>
              <div>
                <label className="label">ประเภท</label>
                <select className="input" value={newType} onChange={e => setNewType(e.target.value as "FIXED" | "SERVICE")}>
                  <option value="FIXED">Fixed Value (ลดเป็นบาท)</option>
                  <option value="SERVICE">Service (พ่วงบริการ)</option>
                </select>
              </div>
            </div>

            {newType === "FIXED" ? (
              <div>
                <label className="label">จำนวนเงินส่วนลด (บาท)</label>
                <input
                  type="number"
                  className="input"
                  placeholder="เช่น 200"
                  value={newFixedValue}
                  onChange={e => setNewFixedValue(e.target.value === "" ? "" : Number(e.target.value))}
                  style={{ maxWidth: 200 }}
                />
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div>
                  <label className="label">บริการที่ใช้ได้</label>
                  <select className="input" value={newServiceId} onChange={e => setNewServiceId(e.target.value)}>
                    <option value="">-- เลือกบริการ --</option>
                    {Array.isArray(services) && services.map(s => (
                      <option key={s.id} value={s.id}>{s.name} (฿{s.price.toLocaleString()})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">ส่วนลด (%)</label>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <input
                      type="number"
                      className="input"
                      min={1}
                      max={100}
                      value={newDiscountPct}
                      onChange={e => setNewDiscountPct(e.target.value === "" ? "" : Number(e.target.value))}
                    />
                    <span style={{ fontSize: "0.85rem", color: "#666", whiteSpace: "nowrap" }}>
                      {Number(newDiscountPct) === 100 ? "= ฟรี" : `= ลด ${newDiscountPct}%`}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <button
              className="btn-primary"
              style={{ marginTop: "1rem" }}
              onClick={createDef}
              disabled={creating}
            >
              {creating ? "กำลังบันทึก..." : "✓ สร้างคูปอง"}
            </button>
          </div>
        )}

        {/* Existing defs list */}
        {Array.isArray(defs) && defs.length > 0 && (
          <div style={{ marginTop: "1rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {defs.map(d => (
              <div
                key={d.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "0.5rem 0.75rem",
                  borderRadius: 8,
                  background: "white",
                  border: "1px solid var(--beige-dark)",
                }}
              >
                <div>
                  <span style={{ fontWeight: 600, fontSize: "0.875rem" }}>{d.name}</span>
                  <span
                    style={{
                      marginLeft: "0.5rem",
                      fontSize: "0.75rem",
                      padding: "0.1rem 0.4rem",
                      borderRadius: 4,
                      background: d.type === "FIXED" ? "#dbeafe" : "#dcfce7",
                      color: d.type === "FIXED" ? "#1d4ed8" : "#16a34a",
                    }}
                  >
                    {d.type === "FIXED" ? "Fixed" : "Service"}
                  </span>
                  <span style={{ marginLeft: "0.5rem", fontSize: "0.8rem", color: "#666" }}>{defLabel(d)}</span>
                </div>
                <button
                  onClick={() => deleteDef(d.id, d.name)}
                  style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer", fontSize: "0.8rem" }}
                >
                  ลบ
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Issue tickets to customers */}
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
                  <label className="label">ประเภทคูปอง</label>
                  <select className="input" value={issueDefId} onChange={e => setIssueDefId(e.target.value)}>
                    <option value="">-- เลือก --</option>
                    {Array.isArray(defs) && defs.map(d => (
                      <option key={d.id} value={d.id}>{d.name} — {defLabel(d)}</option>
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
                {active.length === 0 ? (
                  <p style={{ color: "#aaa", fontSize: "0.875rem" }}>ไม่มี</p>
                ) : active.map(t => (
                  <div key={t.id} style={{ padding: "0.5rem 0.75rem", background: "#f0f5e8", borderRadius: 8, marginBottom: "0.5rem", fontSize: "0.875rem" }}>
                    <div style={{ fontWeight: 600 }}>{t.ticketDef.name}</div>
                    <div style={{ fontSize: "0.775rem", color: "#666" }}>{defLabel(t.ticketDef)}</div>
                    <div style={{ color: "#888", fontSize: "0.75rem" }}>ออกเมื่อ {new Date(t.issuedAt).toLocaleDateString("th-TH")}</div>
                  </div>
                ))}

                {used.length > 0 && (
                  <>
                    <h3 style={{ margin: "1rem 0 0.75rem", fontSize: "0.9rem", color: "#888" }}>ใช้ไปแล้ว ({used.length})</h3>
                    {used.slice(0, 5).map(t => (
                      <div key={t.id} style={{ padding: "0.5rem 0.75rem", background: "#f5f5f5", borderRadius: 8, marginBottom: "0.5rem", fontSize: "0.8rem", color: "#888" }}>
                        <s>{t.ticketDef.name}</s>
                        <div style={{ fontSize: "0.75rem" }}>{defLabel(t.ticketDef)}</div>
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
