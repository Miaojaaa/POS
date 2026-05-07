"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

type Service = { id: string; name: string; price: number; duration: number; category: { name: string } };
type User = { id: string; name: string; role: string };
type Product = { id: string; name: string; unitVolumeMg: number; costPerUnit: number };
type CustomerDetail = {
  id: string; name: string; phone: string; walletBalance: number;
  allergyHistory?: string; memberLevel: string;
  tickets: { id: string; ticketDef: { name: string; type: string } }[];
  serviceHistory: {
    order: {
      createdAt: string;
      items: { service: { name: string } }[];
      technician: { name: string };
      chemicals: { product: { name: string }; amountMg: number }[];
    };
  }[];
};

type OrderItem = { serviceId: string; serviceName: string; originalPrice: number; price: number };
type OrderChem = { productId: string; productName: string; amountMg: number; costPerMg: number; totalCost: number };

export default function NewOrderPage() {
  const router = useRouter();
  const [services, setServices] = useState<Service[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  const [customerPhone, setCustomerPhone] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customerDetail, setCustomerDetail] = useState<CustomerDetail | null>(null);
  const [showMemberModal, setShowMemberModal] = useState(false);

  // Multiple technicians
  const [technicianIds, setTechnicianIds] = useState<string[]>([]);

  // Multiple assistants (dropdown)
  const [assistantIds, setAssistantIds] = useState<string[]>([]);

  const [notes, setNotes] = useState("");
  const [selectedItems, setSelectedItems] = useState<OrderItem[]>([]);
  const [selectedChems, setSelectedChems] = useState<OrderChem[]>([]);

  // Chemical search
  const [chemSearch, setChemSearch] = useState("");
  const [chemFocused, setChemFocused] = useState(false);

  const [saving, setSaving] = useState(false);

  // Alert modal
  const [alertMsg, setAlertMsg] = useState<string | null>(null);

  // PIN modal for price editing
  const [showPinModal, setShowPinModal] = useState(false);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [priceUnlocked, setPriceUnlocked] = useState(false);
  const [pendingPriceEdit, setPendingPriceEdit] = useState<{ serviceId: string; price: number } | null>(null);

  useEffect(() => {
    fetch("/api/services").then(r => r.json()).then(setServices);
    fetch("/api/users").then(r => r.json()).then(setUsers);
    fetch("/api/products").then(r => r.json()).then(setProducts);
  }, []);

  const lookupPhone = useCallback(async (phone: string) => {
    if (phone.length < 9) return;
    const res = await fetch(`/api/customers/${phone}`);
    const data = await res.json();
    if (data) {
      setCustomerDetail(data);
      setCustomerId(data.id);
      setCustomerName(data.name);
      setShowMemberModal(true);
    }
  }, []);

  const technicians = users.filter(u => ["TECHNICIAN", "OWNER", "MANAGER"].includes(u.role));
  const assistants = users.filter(u => ["ASSISTANT", "TECHNICIAN"].includes(u.role));
  const availableTechs = technicians.filter(u => !technicianIds.includes(u.id));
  const availableAssists = assistants.filter(u => !assistantIds.includes(u.id));

  function removeTechnician(id: string) {
    setTechnicianIds(prev => prev.filter(t => t !== id));
  }

  function removeAssistant(id: string) {
    setAssistantIds(prev => prev.filter(a => a !== id));
  }

  // Chemical search — only show products not yet added
  const filteredChemProducts = chemSearch.trim()
    ? products.filter(p =>
        p.name.toLowerCase().includes(chemSearch.toLowerCase()) &&
        !selectedChems.find(c => c.productId === p.id)
      )
    : [];
  const showChemDropdown = chemFocused && filteredChemProducts.length > 0;

  function addChemToList(prod: Product) {
    const costPerMg = prod.costPerUnit / prod.unitVolumeMg;
    setSelectedChems(prev => [...prev, { productId: prod.id, productName: prod.name, amountMg: 0, costPerMg, totalCost: 0 }]);
    setChemSearch("");
  }

  function updateChemAmount(productId: string, amountMg: number) {
    setSelectedChems(prev =>
      prev.map(c => c.productId === productId ? { ...c, amountMg, totalCost: c.costPerMg * amountMg } : c)
    );
  }

  function removeChem(productId: string) {
    setSelectedChems(prev => prev.filter(c => c.productId !== productId));
  }

  function addService(svc: Service) {
    if (selectedItems.find(i => i.serviceId === svc.id)) return;
    setSelectedItems(prev => [...prev, { serviceId: svc.id, serviceName: svc.name, originalPrice: svc.price, price: svc.price }]);
  }

  function removeService(serviceId: string) {
    setSelectedItems(prev => prev.filter(i => i.serviceId !== serviceId));
  }

  function requestPriceEdit(serviceId: string, newPrice: number) {
    if (priceUnlocked) { applyPriceEdit(serviceId, newPrice); }
    else { setPendingPriceEdit({ serviceId, price: newPrice }); setShowPinModal(true); }
  }

  function applyPriceEdit(serviceId: string, newPrice: number) {
    setSelectedItems(prev => prev.map(i => i.serviceId === serviceId ? { ...i, price: newPrice } : i));
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
      setPriceUnlocked(true);
      setShowPinModal(false);
      setPin("");
      if (pendingPriceEdit) {
        applyPriceEdit(pendingPriceEdit.serviceId, pendingPriceEdit.price);
        setPendingPriceEdit(null);
      }
    } else {
      setPinError("Manager PIN ไม่ถูกต้อง");
    }
  }

  async function handleSubmit() {
    if (technicianIds.length === 0) { setAlertMsg("กรุณาเลือกช่างผู้ดูแลอย่างน้อย 1 คน"); return; }
    if (selectedItems.length === 0) { setAlertMsg("กรุณาเลือกบริการอย่างน้อย 1 รายการ"); return; }
    if (!customerName.trim()) { setAlertMsg("กรุณากรอกชื่อลูกค้า"); return; }

    setSaving(true);
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerName, customerPhone, customerId,
        technicianId: technicianIds[0],
        assistantIds: [...technicianIds.slice(1), ...assistantIds],
        items: selectedItems.map(i => ({ serviceId: i.serviceId, price: i.price })),
        chemicals: selectedChems.filter(c => c.amountMg > 0),
        notes,
      }),
    });
    if (res.ok) { router.push("/pos/queue"); }
    else { setAlertMsg("เกิดข้อผิดพลาด กรุณาลองใหม่"); }
    setSaving(false);
  }

  const subtotal = selectedItems.reduce((s, i) => s + i.price, 0);
  const chemCost = selectedChems.reduce((s, c) => s + c.totalCost, 0);
  const servicesByCategory = services.reduce<Record<string, Service[]>>((acc, svc) => {
    const cat = svc.category.name;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(svc);
    return acc;
  }, {});

  const tagStyle = (primary: boolean): React.CSSProperties => ({
    display: "flex", alignItems: "center", gap: 4,
    background: primary ? "var(--olive)" : "var(--beige)",
    color: primary ? "white" : "var(--text-dark)",
    padding: "3px 10px", borderRadius: 20, fontSize: "0.8rem",
    border: `1px solid ${primary ? "var(--olive)" : "var(--beige-dark)"}`,
  });

  const addBtnStyle: React.CSSProperties = {
    padding: "0 14px", background: "var(--olive)", color: "white",
    border: "none", borderRadius: 8, cursor: "pointer",
    fontSize: "1.25rem", fontWeight: 700, lineHeight: 1,
    flexShrink: 0,
  };

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto" }}>
      <h1 style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--olive)", marginBottom: "1.5rem" }}>
        📋 รับออร์เดอร์ใหม่
      </h1>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
        {/* Left: Customer + Staff + Chemicals */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div className="card">
            <h3 style={{ margin: "0 0 1rem", fontSize: "1rem", color: "var(--olive)" }}>👤 ข้อมูลลูกค้า</h3>

            <div style={{ marginBottom: "0.75rem" }}>
              <label className="label">เบอร์โทรศัพท์</label>
              <input
                className="input"
                value={customerPhone}
                onChange={e => setCustomerPhone(e.target.value)}
                onBlur={() => lookupPhone(customerPhone)}
                placeholder="0891234567"
              />
            </div>
            <div style={{ marginBottom: "0.75rem" }}>
              <label className="label">ชื่อลูกค้า *</label>
              <input
                className="input"
                value={customerName}
                onChange={e => setCustomerName(e.target.value)}
                placeholder="ชื่อ-นามสกุล"
              />
              {customerId && <div style={{ fontSize: "0.75rem", color: "var(--success-green)", marginTop: 4 }}>✓ สมาชิก</div>}
            </div>

            {/* Technicians — multiple via dropdown + button */}
            <div style={{ marginBottom: "0.75rem" }}>
              <label className="label">ช่างผู้ดูแล * <span style={{ fontWeight: 400, color: "#888" }}>(เพิ่มได้หลายคน)</span></label>
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                <select
                  className="input"
                  style={{ flex: 1, marginBottom: 0 }}
                  value=""
                  onChange={e => {
                    const id = e.target.value;
                    if (id && !technicianIds.includes(id)) {
                      setTechnicianIds(prev => [...prev, id]);
                    }
                  }}
                >
                  <option value="">-- เลือกช่าง --</option>
                  {availableTechs.map(u => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>
              {technicianIds.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginTop: "0.5rem" }}>
                  {technicianIds.map((id, idx) => {
                    const u = users.find(u => u.id === id);
                    return (
                      <span key={id} style={tagStyle(idx === 0)}>
                        {idx === 0 && <span style={{ fontSize: "0.7rem", opacity: 0.75 }}>หลัก·</span>}
                        {u?.name ?? id}
                        <button
                          onClick={() => removeTechnician(id)}
                          style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", padding: 0, marginLeft: 2, fontSize: "1rem", lineHeight: 1 }}
                        >×</button>
                      </span>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Assistants — dropdown + button */}
            <div style={{ marginBottom: "0.75rem" }}>
              <label className="label">ผู้ช่วยช่าง <span style={{ fontWeight: 400, color: "#888" }}>(เพิ่มได้หลายคน)</span></label>
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                <select
                  className="input"
                  style={{ flex: 1, marginBottom: 0 }}
                  value=""
                  onChange={e => {
                    const id = e.target.value;
                    if (id && !assistantIds.includes(id)) {
                      setAssistantIds(prev => [...prev, id]);
                    }
                  }}
                >
                  <option value="">-- เลือกผู้ช่วย --</option>
                  {availableAssists.map(u => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>
              {assistantIds.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginTop: "0.5rem" }}>
                  {assistantIds.map(id => {
                    const u = users.find(u => u.id === id);
                    return (
                      <span key={id} style={tagStyle(false)}>
                        {u?.name ?? id}
                        <button
                          onClick={() => removeAssistant(id)}
                          style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", padding: 0, marginLeft: 2, fontSize: "1rem", lineHeight: 1 }}
                        >×</button>
                      </span>
                    );
                  })}
                </div>
              )}
            </div>

            <div>
              <label className="label">หมายเหตุ</label>
              <textarea className="input" rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="ข้อมูลเพิ่มเติม..." />
            </div>
          </div>

          {/* Chemical search card */}
          <div className="card">
            <h3 style={{ margin: "0 0 1rem", fontSize: "1rem", color: "var(--olive)" }}>🧪 เคมีที่ใช้ (ถาดสี)</h3>

            {/* Search input with dropdown */}
            <div style={{ position: "relative", marginBottom: "0.75rem" }}>
              <input
                className="input"
                style={{ marginBottom: 0, paddingLeft: "2rem" }}
                placeholder="🔍 ค้นหาชื่อเคมี..."
                value={chemSearch}
                onChange={e => setChemSearch(e.target.value)}
                onFocus={() => setChemFocused(true)}
                onBlur={() => setTimeout(() => setChemFocused(false), 150)}
                autoComplete="off"
              />
              {showChemDropdown && (
                <div style={{
                  position: "absolute", top: "calc(100% + 2px)", left: 0, right: 0,
                  background: "white", border: "1px solid var(--beige-dark)", borderRadius: 8,
                  zIndex: 20, boxShadow: "0 4px 16px rgba(0,0,0,0.12)", maxHeight: 220, overflowY: "auto",
                }}>
                  {filteredChemProducts.map(prod => (
                    <div
                      key={prod.id}
                      onMouseDown={() => addChemToList(prod)}
                      style={{
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                        padding: "9px 14px", cursor: "pointer", borderBottom: "1px solid #f0f0f0",
                        fontSize: "0.875rem",
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = "var(--beige)")}
                      onMouseLeave={e => (e.currentTarget.style.background = "white")}
                    >
                      <span>{prod.name}</span>
                      <span style={{ color: "var(--olive)", fontWeight: 700, fontSize: "0.85rem" }}>+ เพิ่ม</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Added chemicals list */}
            {selectedChems.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                {selectedChems.map(chem => (
                  <div key={chem.productId} style={{
                    display: "flex", alignItems: "center", gap: "0.5rem",
                    padding: "6px 10px", background: "var(--beige)", borderRadius: 8, fontSize: "0.875rem",
                  }}>
                    <span style={{ flex: 1 }}>{chem.productName}</span>
                    <input
                      type="number"
                      placeholder="มก."
                      style={{
                        width: 68, border: "1px solid var(--beige-dark)", borderRadius: 6,
                        padding: "3px 6px", fontSize: "0.85rem", textAlign: "center",
                      }}
                      value={chem.amountMg || ""}
                      onChange={e => updateChemAmount(chem.productId, parseInt(e.target.value) || 0)}
                    />
                    <span style={{ color: "#888", fontSize: "0.75rem", width: 58, textAlign: "right" }}>
                      ฿{chem.totalCost.toFixed(2)}
                    </span>
                    <button
                      onClick={() => removeChem(chem.productId)}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "#bbb", fontSize: "1rem", lineHeight: 1 }}
                    >×</button>
                  </div>
                ))}
                <div style={{ fontSize: "0.8rem", color: "#888", textAlign: "right", marginTop: 2 }}>
                  ต้นทุนเคมีรวม: ฿{chemCost.toFixed(2)}
                </div>
              </div>
            ) : (
              <p style={{ color: "#aaa", fontSize: "0.85rem", margin: 0 }}>ค้นหาและกด + เพื่อเพิ่มเคมีที่ใช้</p>
            )}
          </div>
        </div>

        {/* Right: Services + Summary */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div className="card">
            <h3 style={{ margin: "0 0 1rem", fontSize: "1rem", color: "var(--olive)" }}>💇 เลือกบริการ</h3>
            {Object.entries(servicesByCategory).map(([cat, svcs]) => (
              <div key={cat} style={{ marginBottom: "1rem" }}>
                <div style={{ fontWeight: 600, fontSize: "0.85rem", color: "#666", marginBottom: "0.5rem" }}>{cat}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                  {svcs.map(svc => {
                    const selected = selectedItems.find(i => i.serviceId === svc.id);
                    return (
                      <button
                        key={svc.id}
                        onClick={() => selected ? removeService(svc.id) : addService(svc)}
                        style={{
                          padding: "6px 12px", borderRadius: 8, border: "1px solid",
                          borderColor: selected ? "var(--olive)" : "var(--beige-dark)",
                          background: selected ? "var(--olive)" : "white",
                          color: selected ? "white" : "var(--text-dark)",
                          fontSize: "0.8rem", cursor: "pointer",
                        }}
                      >
                        {svc.name} (฿{svc.price.toLocaleString()})
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Order Summary with inline price edit */}
          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h3 style={{ margin: 0, fontSize: "1rem", color: "var(--olive)" }}>📄 สรุปออร์เดอร์</h3>
              {priceUnlocked ? (
                <span style={{ fontSize: "0.75rem", color: "var(--success-green)", fontWeight: 600 }}>🔓 แก้ราคาได้</span>
              ) : (
                <button
                  onClick={() => setShowPinModal(true)}
                  style={{ fontSize: "0.75rem", color: "#888", background: "none", border: "1px solid #ddd", borderRadius: 6, padding: "3px 8px", cursor: "pointer" }}
                >
                  🔐 ปลดล็อกแก้ราคา
                </button>
              )}
            </div>

            {selectedItems.length === 0 ? (
              <p style={{ color: "#aaa", fontSize: "0.875rem" }}>ยังไม่ได้เลือกบริการ</p>
            ) : (
              <>
                {selectedItems.map(item => (
                  <div key={item.serviceId} style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: 8 }}>
                    <span style={{ flex: 1, fontSize: "0.875rem" }}>{item.serviceName}</span>
                    {item.price !== item.originalPrice && (
                      <span style={{ fontSize: "0.75rem", color: "#aaa", textDecoration: "line-through" }}>
                        ฿{item.originalPrice.toLocaleString()}
                      </span>
                    )}
                    <input
                      type="number"
                      value={item.price}
                      onChange={e => {
                        const newPrice = Number(e.target.value);
                        if (newPrice !== item.originalPrice && !priceUnlocked) {
                          requestPriceEdit(item.serviceId, newPrice);
                        } else {
                          applyPriceEdit(item.serviceId, newPrice);
                        }
                      }}
                      onFocus={e => {
                        if (!priceUnlocked) { e.target.blur(); setShowPinModal(true); }
                      }}
                      style={{
                        width: 90,
                        border: `1px solid ${item.price !== item.originalPrice ? "var(--alert-red)" : "var(--beige-dark)"}`,
                        borderRadius: 6, padding: "3px 6px", fontSize: "0.875rem", fontWeight: 600,
                        color: item.price !== item.originalPrice ? "var(--alert-red)" : "var(--text-dark)",
                        textAlign: "right",
                        background: item.price !== item.originalPrice ? "#fff8f8" : "white",
                      }}
                    />
                    <button
                      onClick={() => removeService(item.serviceId)}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "#ccc", fontSize: "1rem" }}
                    >×</button>
                  </div>
                ))}

                {selectedChems.some(c => c.amountMg > 0) && (
                  <>
                    <div style={{ borderTop: "1px dashed #ddd", margin: "8px 0" }} />
                    <div style={{ fontSize: "0.8rem", color: "#888", marginBottom: 4 }}>ต้นทุนเคมี:</div>
                    {selectedChems.filter(c => c.amountMg > 0).map(c => (
                      <div key={c.productId} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", color: "#888" }}>
                        <span>{c.productName} ({c.amountMg}มก.)</span>
                        <span>฿{c.totalCost.toFixed(2)}</span>
                      </div>
                    ))}
                  </>
                )}

                <div style={{ borderTop: "2px solid var(--beige-dark)", marginTop: 8, paddingTop: 8, display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: "1rem" }}>
                  <span>รวม</span>
                  <span>฿{subtotal.toLocaleString()}</span>
                </div>
                {chemCost > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", color: "#888" }}>
                    <span>ต้นทุนเคมีรวม</span>
                    <span>฿{chemCost.toFixed(2)}</span>
                  </div>
                )}
              </>
            )}

            <button
              className="btn-primary"
              style={{ width: "100%", marginTop: "1rem" }}
              onClick={handleSubmit}
              disabled={saving}
            >
              {saving ? "กำลังบันทึก..." : "✓ ส่งเข้าคิว"}
            </button>
          </div>
        </div>
      </div>

      {/* Member Modal */}
      {showMemberModal && customerDetail && (
        <div className="modal-overlay" onClick={() => setShowMemberModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: "0 0 1rem", color: "var(--olive)" }}>👤 ข้อมูลสมาชิก</h3>
            <div style={{ marginBottom: "0.75rem" }}>
              <strong>{customerDetail.name}</strong>
              <span style={{ marginLeft: 8, fontSize: "0.8rem", background: "#eee", padding: "2px 8px", borderRadius: 12 }}>
                {customerDetail.memberLevel}
              </span>
            </div>
            <div style={{ marginBottom: "0.5rem" }}>
              💰 Wallet: <strong>฿{customerDetail.walletBalance.toLocaleString()}</strong>
            </div>
            {customerDetail.allergyHistory && (
              <div className="allergy-alert" style={{ marginBottom: "0.75rem" }}>
                ⚠️ ประวัติการแพ้: {customerDetail.allergyHistory}
              </div>
            )}
            {customerDetail.tickets.length > 0 && (
              <div style={{ marginBottom: "0.75rem" }}>
                <div style={{ fontWeight: 600, fontSize: "0.875rem", marginBottom: 4 }}>🎫 Ticket/Coupon ที่มี:</div>
                {customerDetail.tickets.map(t => (
                  <div key={t.id} style={{ fontSize: "0.85rem", background: "var(--beige)", padding: "4px 8px", borderRadius: 6, marginBottom: 4 }}>
                    {t.ticketDef.name}
                  </div>
                ))}
              </div>
            )}
            {customerDetail.serviceHistory.length > 0 && (
              <div>
                <div style={{ fontWeight: 600, fontSize: "0.875rem", marginBottom: 4 }}>📋 ประวัติบริการ 5 ครั้งล่าสุด:</div>
                {customerDetail.serviceHistory.map((h, i) => (
                  <div key={i} style={{ fontSize: "0.8rem", borderBottom: "1px solid #eee", paddingBottom: 6, marginBottom: 6 }}>
                    <div><strong>{new Date(h.order.createdAt).toLocaleDateString("th-TH")}</strong> · ช่าง {h.order.technician.name}</div>
                    <div style={{ color: "#555" }}>{h.order.items.map(it => it.service.name).join(", ")}</div>
                    {h.order.chemicals.length > 0 && (
                      <div style={{ color: "#888" }}>เคมี: {h.order.chemicals.map(c => `${c.product.name}(${c.amountMg}มก.)`).join(", ")}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
            <button className="btn-primary" style={{ width: "100%", marginTop: "0.75rem" }} onClick={() => setShowMemberModal(false)}>
              ✓ รับทราบ
            </button>
          </div>
        </div>
      )}

      {/* Alert Modal */}
      {alertMsg && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 360, textAlign: "center" }}>
            <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>⚠️</div>
            <p style={{ fontSize: "0.95rem", color: "var(--text-dark)", marginBottom: "1.25rem" }}>{alertMsg}</p>
            <button className="btn-primary" style={{ minWidth: 120 }} onClick={() => setAlertMsg(null)}>ตกลง</button>
          </div>
        </div>
      )}

      {/* Manager PIN Modal */}
      {showPinModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 340 }}>
            <h3 style={{ margin: "0 0 0.5rem", color: "var(--olive)" }}>🔐 Manager PIN</h3>
            <p style={{ fontSize: "0.875rem", color: "#666", marginBottom: "1rem" }}>
              กรอก Manager PIN เพื่อปลดล็อกการแก้ไขราคา
            </p>
            <input
              type="password"
              className="input"
              placeholder="PIN 4-6 หลัก"
              value={pin}
              onChange={e => setPin(e.target.value)}
              onKeyDown={e => e.key === "Enter" && verifyPin()}
              style={{ marginBottom: "0.5rem" }}
              autoFocus
            />
            {pinError && (
              <div style={{ color: "var(--alert-red)", fontSize: "0.875rem", marginBottom: "0.75rem" }}>{pinError}</div>
            )}
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button className="btn-primary" style={{ flex: 1 }} onClick={verifyPin}>ยืนยัน</button>
              <button
                className="btn-secondary"
                style={{ flex: 1 }}
                onClick={() => { setShowPinModal(false); setPin(""); setPinError(""); setPendingPriceEdit(null); }}
              >
                ยกเลิก
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
