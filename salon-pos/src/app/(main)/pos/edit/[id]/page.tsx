"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { User, FlaskConical, ShoppingBag, Scissors, FileText, Lock, Edit3 } from "lucide-react";

type Service = { id: string; name: string; price: number; duration: number; category: { name: string } };
type User = { id: string; name: string; role: string };
type Product = { id: string; name: string; unitVolumeG: number; costPerUnit: number };

type OrderItem = { serviceId: string; serviceName: string; originalPrice: number; price: number };
type OrderChem = { productId: string; productName: string; amountG: number; costPerG: number; totalCost: number };
type RetailProduct = { id: string; name: string; price: number; stock: number };
type RetailLine = { retailProductId: string; name: string; price: number; quantity: number; maxStock: number };

type LoadedOrder = {
  id: string; status: string;
  customerName: string; customerPhone?: string; customerId?: string;
  notes?: string; technicianId: string;
  technician: { id: string; name: string };
  assistants: { user: { id: string; name: string } }[];
  items: { id: string; serviceId: string; price: number; service: { id: string; name: string; price: number; category: { name: string } } }[];
  chemicals: { id: string; productId: string; amountG: number; costPerG: number; totalCost: number; product: { id: string; name: string } }[];
  retailItems: { id: string; retailProductId: string; quantity: number; price: number; retailProduct: { id: string; name: string; stock: number } }[];
};

export default function EditOrderPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const orderId = params.id;

  const [services, setServices] = useState<Service[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [retailProducts, setRetailProducts] = useState<RetailProduct[]>([]);

  const [customerPhone, setCustomerPhone] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerId, setCustomerId] = useState<string | null>(null);

  const [technicianIds, setTechnicianIds] = useState<string[]>([]);
  const [assistantIds, setAssistantIds] = useState<string[]>([]);

  const [notes, setNotes] = useState("");
  const [selectedItems, setSelectedItems] = useState<OrderItem[]>([]);
  const [selectedChems, setSelectedChems] = useState<OrderChem[]>([]);
  const [selectedRetail, setSelectedRetail] = useState<RetailLine[]>([]);

  const [retailSearch, setRetailSearch] = useState("");
  const [retailFocused, setRetailFocused] = useState(false);
  const [chemSearch, setChemSearch] = useState("");
  const [chemFocused, setChemFocused] = useState(false);

  const [saving, setSaving] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [alertMsg, setAlertMsg] = useState<string | null>(null);
  const [initialSnapshot, setInitialSnapshot] = useState<string>(""); // JSON of loaded state for dirty-check

  const [showPinModal, setShowPinModal] = useState(false);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [priceUnlocked, setPriceUnlocked] = useState(false);
  const [pendingPriceEdit, setPendingPriceEdit] = useState<{ serviceId: string; price: number } | null>(null);

  // Load all reference data + the existing order
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [svcRes, userRes, prodRes, retailRes, orderRes] = await Promise.all([
          fetch("/api/services"),
          fetch("/api/users"),
          fetch("/api/products"),
          fetch("/api/retail-products"),
          fetch(`/api/orders/${orderId}`),
        ]);
        if (cancelled) return;
        const [svcData, userData, prodData, retailData, orderData] = await Promise.all([
          svcRes.json(), userRes.json(), prodRes.json(), retailRes.json(), orderRes.json(),
        ]);
        if (cancelled) return;

        setServices(svcData);
        setUsers(userData);
        setProducts(prodData);
        setRetailProducts(retailData);

        const o: LoadedOrder = orderData;
        if (!o || !o.id) {
          setAlertMsg("ไม่พบออร์เดอร์");
          setLoadingData(false);
          return;
        }

        setCustomerName(o.customerName);
        setCustomerPhone(o.customerPhone ?? "");
        setCustomerId(o.customerId ?? null);
        setNotes(o.notes ?? "");
        setTechnicianIds([o.technicianId]);
        setAssistantIds(o.assistants.map(a => a.user.id));

        setSelectedItems(o.items.map(it => ({
          serviceId: it.serviceId,
          serviceName: it.service.name,
          originalPrice: it.service.price,
          price: it.price,
        })));

        setSelectedChems(o.chemicals.map(c => ({
          productId: c.productId,
          productName: c.product.name,
          amountG: c.amountG,
          costPerG: c.costPerG,
          totalCost: c.totalCost,
        })));

        const loadedRetail = o.retailItems.map(r => ({
          retailProductId: r.retailProductId,
          name: r.retailProduct.name,
          price: r.price,
          quantity: r.quantity,
          // current stock + this order's qty (since stock was decremented at order creation)
          maxStock: r.retailProduct.stock + r.quantity,
        }));
        setSelectedRetail(loadedRetail);

        setInitialSnapshot(JSON.stringify({
          customerName: o.customerName,
          customerPhone: o.customerPhone ?? "",
          customerId: o.customerId ?? null,
          notes: o.notes ?? "",
          technicianIds: [o.technicianId],
          assistantIds: o.assistants.map(a => a.user.id),
          items: o.items.map(it => ({ serviceId: it.serviceId, price: it.price })),
          chems: o.chemicals.map(c => ({ productId: c.productId, amountG: c.amountG, totalCost: c.totalCost })),
          retail: loadedRetail.map(r => ({ retailProductId: r.retailProductId, price: r.price, quantity: r.quantity })),
        }));

        setLoadingData(false);
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setAlertMsg("โหลดข้อมูลล้มเหลว");
          setLoadingData(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [orderId]);

  const lookupPhone = useCallback(async (phone: string) => {
    if (phone.length < 9) return;
    try {
      const res = await fetch(`/api/customers/${phone}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data) {
        setCustomerId(data.id);
        setCustomerName(data.name);
      }
    } catch {}
  }, []);

  const technicians = users.filter(u => u.role.split(",").some(r => ["TECHNICIAN", "OWNER", "MANAGER"].includes(r)));
  const assistants = users.filter(u => u.role.split(",").some(r => ["ASSISTANT", "TECHNICIAN"].includes(r)));
  const availableTechs = technicians.filter(u => !technicianIds.includes(u.id) && !assistantIds.includes(u.id));
  const availableAssists = assistants.filter(u => !assistantIds.includes(u.id) && !technicianIds.includes(u.id));

  function removeTechnician(id: string) { setTechnicianIds(prev => prev.filter(t => t !== id)); }
  function removeAssistant(id: string) { setAssistantIds(prev => prev.filter(a => a !== id)); }

  const filteredChemProducts = chemSearch.trim()
    ? products.filter(p => p.name.toLowerCase().includes(chemSearch.toLowerCase()) && !selectedChems.find(c => c.productId === p.id))
    : [];
  const showChemDropdown = chemFocused && filteredChemProducts.length > 0;

  function addChemToList(prod: Product) {
    const costPerG = prod.costPerUnit / prod.unitVolumeG;
    setSelectedChems(prev => [...prev, { productId: prod.id, productName: prod.name, amountG: 0, costPerG, totalCost: 0 }]);
    setChemSearch("");
  }
  function updateChemAmount(productId: string, amountG: number) {
    setSelectedChems(prev => prev.map(c => c.productId === productId ? { ...c, amountG, totalCost: c.costPerG * amountG } : c));
  }
  function removeChem(productId: string) { setSelectedChems(prev => prev.filter(c => c.productId !== productId)); }

  const filteredRetailProducts = retailSearch.trim()
    ? retailProducts.filter(p => p.name.toLowerCase().includes(retailSearch.toLowerCase()) && !selectedRetail.find(r => r.retailProductId === p.id))
    : [];
  const showRetailDropdown = retailFocused && filteredRetailProducts.length > 0;

  function addRetail(p: RetailProduct) {
    if (p.stock <= 0) return;
    setSelectedRetail(prev => [...prev, { retailProductId: p.id, name: p.name, price: p.price, quantity: 1, maxStock: p.stock }]);
    setRetailSearch("");
  }
  function updateRetailQty(id: string, qty: number) {
    setSelectedRetail(prev => prev.map(r => {
      if (r.retailProductId !== id) return r;
      const q = Math.max(1, Math.min(r.maxStock, qty));
      return { ...r, quantity: q };
    }));
  }
  function removeRetail(id: string) { setSelectedRetail(prev => prev.filter(r => r.retailProductId !== id)); }

  function addService(svc: Service) {
    if (selectedItems.find(i => i.serviceId === svc.id)) return;
    setSelectedItems(prev => [...prev, { serviceId: svc.id, serviceName: svc.name, originalPrice: svc.price, price: svc.price }]);
  }
  function removeService(serviceId: string) { setSelectedItems(prev => prev.filter(i => i.serviceId !== serviceId)); }

  function requestPriceEdit(serviceId: string, newPrice: number) {
    if (priceUnlocked) applyPriceEdit(serviceId, newPrice);
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
    const res = await fetch(`/api/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerName, customerPhone, customerId,
        technicianId: technicianIds[0],
        assistantIds: [...technicianIds.slice(1), ...assistantIds],
        items: selectedItems.map(i => ({ serviceId: i.serviceId, price: i.price })),
        chemicals: selectedChems.filter(c => c.amountG > 0),
        retailItems: selectedRetail.map(r => ({ retailProductId: r.retailProductId, quantity: r.quantity, price: r.price })),
        notes,
      }),
    });
    if (res.ok) router.push("/pos/queue");
    else setAlertMsg("เกิดข้อผิดพลาด กรุณาลองใหม่");
    setSaving(false);
  }

  const subtotal = selectedItems.reduce((s, i) => s + i.price, 0);
  const retailSubtotal = selectedRetail.reduce((s, r) => s + r.price * r.quantity, 0);
  const chemCost = selectedChems.reduce((s, c) => s + c.totalCost, 0);
  const grandTotal = subtotal + retailSubtotal;
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

  if (loadingData) {
    return <div style={{ padding: "2rem", textAlign: "center" }}>กำลังโหลดข้อมูลออร์เดอร์...</div>;
  }

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto" }}>
      <h1 style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "1.4rem", fontWeight: 700, color: "var(--olive)", marginBottom: "1.5rem" }}>
        <Edit3 size={24} /> แก้ไขออร์เดอร์ #{orderId}
      </h1>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div className="card">
            <h3 style={{ display: "flex", alignItems: "center", gap: "0.5rem", margin: "0 0 1rem", fontSize: "1rem", color: "var(--olive)" }}>
              <User size={18} /> ข้อมูลลูกค้า
            </h3>
            <div style={{ marginBottom: "0.75rem" }}>
              <label className="label">เบอร์โทรศัพท์</label>
              <input className="input" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} onBlur={() => lookupPhone(customerPhone)} placeholder="0891234567" />
            </div>
            <div style={{ marginBottom: "0.75rem" }}>
              <label className="label">ชื่อลูกค้า *</label>
              <input className="input" value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="ชื่อ-นามสกุล" />
              {customerId && <div style={{ fontSize: "0.75rem", color: "var(--success-green)", marginTop: 4 }}>✓ สมาชิก</div>}
            </div>

            <div style={{ marginBottom: "0.75rem" }}>
              <label className="label">ช่างผู้ดูแล * <span style={{ fontWeight: 400, color: "#888" }}>(เพิ่มได้หลายคน)</span></label>
              <select className="input" style={{ marginBottom: 0 }} value="" onChange={e => {
                const id = e.target.value;
                if (id && !technicianIds.includes(id)) setTechnicianIds(prev => [...prev, id]);
              }}>
                <option value="">-- เลือกช่าง --</option>
                {availableTechs.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
              {technicianIds.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginTop: "0.5rem" }}>
                  {technicianIds.map(id => {
                    const u = users.find(u => u.id === id);
                    return (
                      <span key={id} style={tagStyle(true)}>
                        {u?.name ?? id}
                        <button onClick={() => removeTechnician(id)} style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", padding: 0, marginLeft: 2, fontSize: "1rem", lineHeight: 1 }}>×</button>
                      </span>
                    );
                  })}
                </div>
              )}
            </div>

            <div style={{ marginBottom: "0.75rem" }}>
              <label className="label">ผู้ช่วยช่าง</label>
              <select className="input" style={{ marginBottom: 0 }} value="" onChange={e => {
                const id = e.target.value;
                if (id && !assistantIds.includes(id)) setAssistantIds(prev => [...prev, id]);
              }}>
                <option value="">-- เลือกผู้ช่วย --</option>
                {availableAssists.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
              {assistantIds.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginTop: "0.5rem" }}>
                  {assistantIds.map(id => {
                    const u = users.find(u => u.id === id);
                    return (
                      <span key={id} style={tagStyle(false)}>
                        {u?.name ?? id}
                        <button onClick={() => removeAssistant(id)} style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", padding: 0, marginLeft: 2, fontSize: "1rem", lineHeight: 1 }}>×</button>
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

          {/* Chemicals */}
          <div className="card">
            <h3 style={{ display: "flex", alignItems: "center", gap: "0.5rem", margin: "0 0 1rem", fontSize: "1rem", color: "var(--olive)" }}>
              <FlaskConical size={18} /> เคมีที่ใช้
            </h3>
            <div style={{ position: "relative", marginBottom: "0.75rem" }}>
              <input className="input" style={{ marginBottom: 0, paddingLeft: "2rem" }} placeholder="🔍 ค้นหาชื่อเคมี..."
                value={chemSearch} onChange={e => setChemSearch(e.target.value)}
                onFocus={() => setChemFocused(true)} onBlur={() => setTimeout(() => setChemFocused(false), 150)} autoComplete="off" />
              {showChemDropdown && (
                <div style={{ position: "absolute", top: "calc(100% + 2px)", left: 0, right: 0, background: "white", border: "1px solid var(--beige-dark)", borderRadius: 8, zIndex: 20, boxShadow: "0 4px 16px rgba(0,0,0,0.12)", maxHeight: 220, overflowY: "auto" }}>
                  {filteredChemProducts.map(prod => (
                    <div key={prod.id} onMouseDown={() => addChemToList(prod)}
                      style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 14px", cursor: "pointer", borderBottom: "1px solid #f0f0f0", fontSize: "0.875rem" }}
                      onMouseEnter={e => (e.currentTarget.style.background = "var(--beige)")}
                      onMouseLeave={e => (e.currentTarget.style.background = "white")}>
                      <span>{prod.name}</span>
                      <span style={{ color: "var(--olive)", fontWeight: 700, fontSize: "0.85rem" }}>+ เพิ่ม</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {selectedChems.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                {selectedChems.map(chem => (
                  <div key={chem.productId} style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "6px 10px", background: "var(--beige)", borderRadius: 8, fontSize: "0.875rem" }}>
                    <span style={{ flex: 1 }}>{chem.productName}</span>
                    <input type="number" placeholder="กรัม"
                      style={{ width: 68, border: "1px solid var(--beige-dark)", borderRadius: 6, padding: "3px 6px", fontSize: "0.85rem", textAlign: "center" }}
                      value={chem.amountG || ""} onChange={e => updateChemAmount(chem.productId, parseInt(e.target.value) || 0)} />
                    <span style={{ color: "#888", fontSize: "0.75rem", width: 58, textAlign: "right" }}>฿{chem.totalCost.toFixed(2)}</span>
                    <button onClick={() => removeChem(chem.productId)} style={{ background: "none", border: "none", cursor: "pointer", color: "#bbb", fontSize: "1rem", lineHeight: 1 }}>×</button>
                  </div>
                ))}
                <div style={{ fontSize: "0.8rem", color: "#888", textAlign: "right", marginTop: 2 }}>ต้นทุนเคมีรวม: ฿{chemCost.toFixed(2)}</div>
              </div>
            ) : <p style={{ color: "#aaa", fontSize: "0.85rem", margin: 0 }}>ค้นหาและกด + เพื่อเพิ่มเคมี</p>}
          </div>

          {/* Retail */}
          <div className="card">
            <h3 style={{ display: "flex", alignItems: "center", gap: "0.5rem", margin: "0 0 1rem", fontSize: "1rem", color: "var(--olive)" }}>
              <ShoppingBag size={18} /> สินค้า Retail
            </h3>
            <div style={{ position: "relative", marginBottom: "0.75rem" }}>
              <input className="input" style={{ marginBottom: 0, paddingLeft: "2rem" }} placeholder="🔍 ค้นหาสินค้า retail..."
                value={retailSearch} onChange={e => setRetailSearch(e.target.value)}
                onFocus={() => setRetailFocused(true)} onBlur={() => setTimeout(() => setRetailFocused(false), 150)} autoComplete="off" />
              {showRetailDropdown && (
                <div style={{ position: "absolute", top: "calc(100% + 2px)", left: 0, right: 0, background: "white", border: "1px solid var(--beige-dark)", borderRadius: 8, zIndex: 20, boxShadow: "0 4px 16px rgba(0,0,0,0.12)", maxHeight: 220, overflowY: "auto" }}>
                  {filteredRetailProducts.map(prod => (
                    <div key={prod.id} onMouseDown={() => prod.stock > 0 && addRetail(prod)}
                      style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 14px", cursor: prod.stock > 0 ? "pointer" : "not-allowed", borderBottom: "1px solid #f0f0f0", fontSize: "0.875rem", opacity: prod.stock > 0 ? 1 : 0.4 }}
                      onMouseEnter={e => { if (prod.stock > 0) e.currentTarget.style.background = "var(--beige)"; }}
                      onMouseLeave={e => (e.currentTarget.style.background = "white")}>
                      <span>{prod.name}</span>
                      <span style={{ fontSize: "0.8rem", color: "#666" }}>฿{prod.price.toLocaleString()} · เหลือ {prod.stock}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {selectedRetail.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                {selectedRetail.map(r => (
                  <div key={r.retailProductId} style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "6px 10px", background: "var(--beige)", borderRadius: 8, fontSize: "0.875rem" }}>
                    <span style={{ flex: 1 }}>{r.name}</span>
                    <input type="number" min={1} max={r.maxStock} value={r.quantity}
                      onChange={e => updateRetailQty(r.retailProductId, parseInt(e.target.value) || 1)}
                      style={{ width: 56, border: "1px solid var(--beige-dark)", borderRadius: 6, padding: "3px 6px", fontSize: "0.85rem", textAlign: "center" }} />
                    <span style={{ minWidth: 64, textAlign: "right", fontWeight: 600 }}>฿{(r.price * r.quantity).toLocaleString()}</span>
                    <button onClick={() => removeRetail(r.retailProductId)} style={{ background: "none", border: "none", cursor: "pointer", color: "#bbb", fontSize: "1rem", lineHeight: 1 }}>×</button>
                  </div>
                ))}
                <div style={{ fontSize: "0.85rem", color: "var(--olive)", textAlign: "right", marginTop: 2, fontWeight: 600 }}>รวมสินค้า: ฿{retailSubtotal.toLocaleString()}</div>
              </div>
            ) : <p style={{ color: "#aaa", fontSize: "0.85rem", margin: 0 }}>ค้นหาสินค้าและกดเพื่อเพิ่ม (ไม่บังคับ)</p>}
          </div>
        </div>

        {/* Right column */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div className="card">
            <h3 style={{ display: "flex", alignItems: "center", gap: "0.5rem", margin: "0 0 1rem", fontSize: "1rem", color: "var(--olive)" }}>
              <Scissors size={18} /> เลือกบริการ
            </h3>
            {Object.entries(servicesByCategory).map(([cat, svcs]) => (
              <div key={cat} style={{ marginBottom: "1rem" }}>
                <div style={{ fontWeight: 600, fontSize: "0.85rem", color: "#666", marginBottom: "0.5rem" }}>{cat}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                  {svcs.map(svc => {
                    const selected = selectedItems.find(i => i.serviceId === svc.id);
                    return (
                      <button key={svc.id} onClick={() => selected ? removeService(svc.id) : addService(svc)}
                        style={{
                          padding: "6px 12px", borderRadius: 8, border: "1px solid",
                          borderColor: selected ? "var(--olive)" : "var(--beige-dark)",
                          background: selected ? "var(--olive)" : "white",
                          color: selected ? "white" : "var(--text-dark)",
                          fontSize: "0.8rem", cursor: "pointer",
                        }}>
                        {svc.name} (฿{svc.price.toLocaleString()})
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h3 style={{ display: "flex", alignItems: "center", gap: "0.5rem", margin: 0, fontSize: "1rem", color: "var(--olive)" }}>
                <FileText size={18} /> สรุปออร์เดอร์
              </h3>
              {priceUnlocked ? (
                <span style={{ fontSize: "0.75rem", color: "var(--success-green)", fontWeight: 600 }}>🔓 แก้ราคาได้</span>
              ) : (
                <button onClick={() => setShowPinModal(true)} style={{ fontSize: "0.75rem", color: "#888", background: "none", border: "1px solid #ddd", borderRadius: 6, padding: "3px 8px", cursor: "pointer" }}>
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
                      <span style={{ fontSize: "0.75rem", color: "#aaa", textDecoration: "line-through" }}>฿{item.originalPrice.toLocaleString()}</span>
                    )}
                    <input type="number" value={item.price}
                      onChange={e => {
                        const newPrice = Number(e.target.value);
                        if (newPrice !== item.originalPrice && !priceUnlocked) requestPriceEdit(item.serviceId, newPrice);
                        else applyPriceEdit(item.serviceId, newPrice);
                      }}
                      onFocus={e => { if (!priceUnlocked) { e.target.blur(); setShowPinModal(true); } }}
                      style={{
                        width: 90,
                        border: `1px solid ${item.price !== item.originalPrice ? "var(--alert-red)" : "var(--beige-dark)"}`,
                        borderRadius: 6, padding: "3px 6px", fontSize: "0.875rem", fontWeight: 600,
                        color: item.price !== item.originalPrice ? "var(--alert-red)" : "var(--text-dark)",
                        textAlign: "right",
                        background: item.price !== item.originalPrice ? "#fff8f8" : "white",
                      }} />
                    <button onClick={() => removeService(item.serviceId)} style={{ background: "none", border: "none", cursor: "pointer", color: "#ccc", fontSize: "1rem" }}>×</button>
                  </div>
                ))}

                {selectedRetail.length > 0 && (
                  <>
                    <div style={{ borderTop: "1px dashed #ddd", margin: "8px 0" }} />
                    <div style={{ fontSize: "0.8rem", color: "#666", marginBottom: 4 }}>🛍️ สินค้า Retail:</div>
                    {selectedRetail.map(r => (
                      <div key={r.retailProductId} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", marginBottom: 2 }}>
                        <span>{r.name} × {r.quantity}</span>
                        <span>฿{(r.price * r.quantity).toLocaleString()}</span>
                      </div>
                    ))}
                  </>
                )}

                <div style={{ borderTop: "2px solid var(--beige-dark)", marginTop: 8, paddingTop: 8, display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: "1rem" }}>
                  <span>รวม</span>
                  <span>฿{grandTotal.toLocaleString()}</span>
                </div>
                {chemCost > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", color: "#888" }}>
                    <span>ต้นทุนเคมีรวม</span>
                    <span>฿{chemCost.toFixed(2)}</span>
                  </div>
                )}
              </>
            )}

            <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
              <button className="btn-secondary" style={{ flex: 1 }} onClick={() => router.push("/pos/queue")}>
                ยกเลิก
              </button>
              {(() => {
                const currentSnapshot = JSON.stringify({
                  customerName,
                  customerPhone,
                  customerId,
                  notes,
                  technicianIds,
                  assistantIds,
                  items: selectedItems.map(it => ({ serviceId: it.serviceId, price: it.price })),
                  chems: selectedChems.map(c => ({ productId: c.productId, amountG: c.amountG, totalCost: c.totalCost })),
                  retail: selectedRetail.map(r => ({ retailProductId: r.retailProductId, price: r.price, quantity: r.quantity })),
                });
                const dirty = initialSnapshot !== "" && currentSnapshot !== initialSnapshot;
                return (
                  <button className="btn-primary" style={{ flex: 2 }} onClick={handleSubmit} disabled={saving || !dirty}>
                    {saving ? "กำลังบันทึก..." : "✓ บันทึกการแก้ไข"}
                  </button>
                );
              })()}
            </div>
          </div>
        </div>
      </div>

      {alertMsg && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 360, textAlign: "center" }}>
            <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>⚠️</div>
            <p style={{ fontSize: "0.95rem", color: "var(--text-dark)", marginBottom: "1.25rem" }}>{alertMsg}</p>
            <button className="btn-primary" style={{ minWidth: 120 }} onClick={() => setAlertMsg(null)}>ตกลง</button>
          </div>
        </div>
      )}

      {showPinModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 340 }}>
            <h3 style={{ display: "flex", alignItems: "center", gap: "0.5rem", margin: "0 0 0.5rem", color: "var(--olive)" }}>
              <Lock size={18} /> Manager PIN
            </h3>
            <p style={{ fontSize: "0.875rem", color: "#666", marginBottom: "1rem" }}>กรอก Manager PIN เพื่อปลดล็อกการแก้ไขราคา</p>
            <input type="password" className="input" placeholder="PIN 4-6 หลัก" value={pin}
              onChange={e => setPin(e.target.value)}
              onKeyDown={e => e.key === "Enter" && verifyPin()}
              style={{ marginBottom: "0.5rem" }} autoFocus />
            {pinError && <div style={{ color: "var(--alert-red)", fontSize: "0.875rem", marginBottom: "0.75rem" }}>{pinError}</div>}
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button className="btn-primary" style={{ flex: 1 }} onClick={verifyPin}>ยืนยัน</button>
              <button className="btn-secondary" style={{ flex: 1 }} onClick={() => { setShowPinModal(false); setPin(""); setPinError(""); setPendingPriceEdit(null); }}>ยกเลิก</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
