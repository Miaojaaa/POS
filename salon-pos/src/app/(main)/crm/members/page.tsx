"use client";

import { useEffect, useState } from "react";

type Customer = { id: string; name: string; phone: string; walletBalance: number; memberLevel: string };

export default function MembersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ 
    name: "", 
    phone: "", 
    memberLevel: "BASIC",
    birthdate: "",
    allergyHistory: ""
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  const fetchCustomers = () => {
    setLoading(true);
    fetch("/api/customers").then(r => r.json()).then(data => {
      setCustomers(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomer.name || !newCustomer.phone) return;

    setIsSaving(true);
    setError("");
    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newCustomer),
      });
      if (res.ok) {
        setIsModalOpen(false);
        setNewCustomer({ name: "", phone: "", memberLevel: "BASIC", birthdate: "", allergyHistory: "" });
        fetchCustomers();
      } else {
        const data = await res.json();
        setError(data.error || "ไม่สามารถเพิ่มสมาชิกได้ กรุณาลองใหม่อีกครั้ง");
      }
    } catch (error) {
      setError("เกิดข้อผิดพลาดในการเชื่อมต่อ");
    } finally {
      setIsSaving(false);
    }
  };

  const filtered = customers.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    c.phone.includes(search)
  );

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--olive)", margin: 0 }}>👥 จัดการสมาชิก</h1>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <input 
            className="input" 
            placeholder="ค้นหาชื่อ หรือ เบอร์โทร" 
            style={{ width: 240 }} 
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <button className="btn-primary" onClick={() => {
            setIsModalOpen(true);
            setError("");
          }}>+ เพิ่มสมาชิก</button>
        </div>
      </div>

      <div className="card">
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid var(--beige-dark)", color: "#666" }}>
              <th style={{ textAlign: "left", padding: "8px 12px" }}>ชื่อลูกค้า</th>
              <th style={{ textAlign: "left", padding: "8px 12px" }}>เบอร์โทร</th>
              <th style={{ textAlign: "center", padding: "8px 12px" }}>ระดับสมาชิก</th>
              <th style={{ textAlign: "right", padding: "8px 12px" }}>ยอดเงินคงเหลือ (฿)</th>
              <th style={{ textAlign: "center", padding: "8px 12px" }}>จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} style={{ padding: "2rem", textAlign: "center", color: "#888" }}>กำลังโหลด...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={5} style={{ padding: "2rem", textAlign: "center", color: "#888" }}>ไม่พบข้อมูลสมาชิก</td></tr>
            ) : (
              filtered.map(c => (
                <tr key={c.id} style={{ borderBottom: "1px solid #f5f5f5" }}>
                  <td style={{ padding: "8px 12px", fontWeight: 500 }}>{c.name}</td>
                  <td style={{ padding: "8px 12px" }}>{c.phone}</td>
                  <td style={{ padding: "8px 12px", textAlign: "center" }}>
                    <span className={`badge badge-${c.memberLevel.toLowerCase()}`}>{c.memberLevel}</span>
                  </td>
                  <td style={{ padding: "8px 12px", textAlign: "right" }}>{c.walletBalance.toLocaleString()}</td>
                  <td style={{ padding: "8px 12px", textAlign: "center" }}>
                    <button className="btn-secondary" style={{ padding: "2px 8px", fontSize: "0.75rem" }}>รายละเอียด</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2 style={{ marginTop: 0, marginBottom: "1rem" }}>➕ เพิ่มสมาชิกใหม่</h2>
            
            {error && (
              <div style={{ color: "var(--alert-red)", background: "#FFF0F0", padding: "0.75rem", borderRadius: "8px", marginBottom: "1rem", fontSize: "0.875rem" }}>
                ⚠️ {error}
              </div>
            )}

            <form onSubmit={handleAddMember}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
                <div>
                  <label className="label">ชื่อ-นามสกุล</label>
                  <input 
                    className="input" 
                    required 
                    value={newCustomer.name}
                    onChange={e => setNewCustomer({ ...newCustomer, name: e.target.value })}
                    autoFocus
                  />
                </div>
                <div>
                  <label className="label">เบอร์โทรศัพท์</label>
                  <input 
                    className="input" 
                    required 
                    value={newCustomer.phone}
                    onChange={e => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
                <div>
                  <label className="label">วันเกิด (ถ้ามี)</label>
                  <input 
                    className="input" 
                    type="date"
                    value={newCustomer.birthdate}
                    onChange={e => setNewCustomer({ ...newCustomer, birthdate: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">ระดับสมาชิก</label>
                  <select 
                    className="input"
                    value={newCustomer.memberLevel}
                    onChange={e => setNewCustomer({ ...newCustomer, memberLevel: e.target.value })}
                  >
                    <option value="BASIC">BASIC</option>
                    <option value="SILVER">SILVER</option>
                    <option value="GOLD">GOLD</option>
                    <option value="PLATINUM">PLATINUM</option>
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: "1.5rem" }}>
                <label className="label">ประวัติการแพ้ (ถ้ามี)</label>
                <textarea 
                  className="input" 
                  style={{ height: "80px", resize: "none" }}
                  value={newCustomer.allergyHistory}
                  onChange={e => setNewCustomer({ ...newCustomer, allergyHistory: e.target.value })}
                />
              </div>

              <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>ยกเลิก</button>
                <button type="submit" className="btn-primary" disabled={isSaving}>
                  {isSaving ? "กำลังบันทึก..." : "บันทึกสมาชิก"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
