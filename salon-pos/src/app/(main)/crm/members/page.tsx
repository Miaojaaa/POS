"use client";

import { useEffect, useState } from "react";

type Customer = { 
  id: string; 
  name: string; 
  phone: string; 
  walletBalance: number; 
  memberLevel: string;
  birthdate?: string;
  allergyHistory?: string;
};

export default function MembersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ 
    name: "", 
    phone: "", 
    memberLevel: "BASIC",
    birthdate: "",
    allergyHistory: ""
  });
  const [initialData, setInitialData] = useState<typeof formData | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  const fetchCustomers = () => {
    setLoading(true);
    fetch("/api/customers").then(r => r.json()).then(data => {
      if (Array.isArray(data)) setCustomers(data);
      else setCustomers([]);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const openAddModal = () => {
    setEditingId(null);
    const emptyData = { name: "", phone: "", memberLevel: "BASIC", birthdate: "", allergyHistory: "" };
    setFormData(emptyData);
    setInitialData(null);
    setError("");
    setIsModalOpen(true);
  };

  const openEditModal = (c: Customer) => {
    setEditingId(c.id);
    const data = { 
      name: c.name, 
      phone: c.phone, 
      memberLevel: c.memberLevel,
      birthdate: c.birthdate || "",
      allergyHistory: c.allergyHistory || ""
    };
    setFormData(data);
    setInitialData(data);
    setError("");
    setIsModalOpen(true);
  };

  const isChanged = editingId
    ? JSON.stringify(formData) !== JSON.stringify(initialData)
    : !!(formData.name && formData.phone);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.phone) return;

    setIsSaving(true);
    setError("");
    try {
      const method = editingId ? "PUT" : "POST";
      const body = editingId ? { id: editingId, ...formData } : formData;
      
      const res = await fetch("/api/customers", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setIsModalOpen(false);
        fetchCustomers();
      } else {
        const data = await res.json();
        setError(data.error || `ไม่สามารถ${editingId ? 'แก้ไข' : 'เพิ่ม'}สมาชิกได้ กรุณาลองใหม่อีกครั้ง`);
      }
    } catch (error) {
      setError("เกิดข้อผิดพลาดในการเชื่อมต่อ");
    } finally {
      setIsSaving(false);
    }
  };

  const filtered = Array.isArray(customers) ? customers.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    c.phone.includes(search)
  ) : [];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--olive)", margin: 0 }}>👥 สมาชิก / ลูกค้า</h1>
        <button className="btn-primary" onClick={openAddModal}>+ เพิ่มสมาชิก</button>
      </div>

      <div className="card">
        <div style={{ marginBottom: "1.25rem" }}>
          <input 
            className="input" 
            placeholder="🔍 ค้นหาด้วยชื่อ หรือ เบอร์โทรศัพท์..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid var(--beige-dark)", color: "#666" }}>
              <th style={{ textAlign: "left", padding: "10px 12px" }}>ชื่อ</th>
              <th style={{ textAlign: "left", padding: "10px 12px" }}>เบอร์โทร</th>
              <th style={{ textAlign: "center", padding: "10px 12px" }}>ระดับสมาชิก</th>
              <th style={{ textAlign: "right", padding: "10px 12px" }}>ยอดคงเหลือใน Wallet</th>
              <th style={{ textAlign: "center", padding: "10px 12px", width: 80 }}>จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} style={{ textAlign: "center", padding: "3rem", color: "#888" }}>กำลังโหลดข้อมูล...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={5} style={{ textAlign: "center", padding: "3rem", color: "#aaa" }}>ไม่พบข้อมูลสมาชิก</td></tr>
            ) : filtered.map(c => (
              <tr key={c.id} style={{ borderBottom: "1px solid #f5f5f5" }}>
                <td style={{ padding: "10px 12px", fontWeight: 500 }}>{c.name}</td>
                <td style={{ padding: "10px 12px", color: "#666" }}>{c.phone}</td>
                <td style={{ padding: "10px 12px", textAlign: "center" }}>
                  <span style={{ 
                    fontSize: "0.75rem", padding: "2px 8px", borderRadius: 10,
                    background: c.memberLevel === "GOLD" ? "#fef3c7" : c.memberLevel === "SILVER" ? "#f3f4f6" : "#f1f5f9",
                    color: c.memberLevel === "GOLD" ? "#92400e" : c.memberLevel === "SILVER" ? "#4b5563" : "#64748b",
                    fontWeight: 600
                  }}>
                    {c.memberLevel}
                  </span>
                </td>
                <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 600, color: "var(--olive)" }}>
                  ฿{c.walletBalance.toLocaleString()}
                </td>
                <td style={{ padding: "10px 12px", textAlign: "center" }}>
                  <button className="btn-secondary" style={{ padding: "4px 8px", fontSize: "0.75rem" }} onClick={() => openEditModal(c)}>แก้ไข</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 400 }}>
            <h3 style={{ margin: "0 0 1.25rem", color: "var(--olive)" }}>{editingId ? "แก้ไขข้อมูลสมาชิก" : "เพิ่มสมาชิกใหม่"}</h3>
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <div>
                <label className="label">ชื่อลูกค้า</label>
                <input 
                  className="input" 
                  value={formData.name} 
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="ชื่อ-นามสกุล"
                  required
                />
              </div>
              <div>
                <label className="label">เบอร์โทรศัพท์</label>
                <input 
                  className="input" 
                  value={formData.phone} 
                  onChange={e => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="08x-xxx-xxxx"
                  required
                />
              </div>
              <div>
                <label className="label">วันเกิด (วว/ดด/ปปปป)</label>
                <input 
                  className="input" 
                  value={formData.birthdate} 
                  onChange={e => setFormData({ ...formData, birthdate: e.target.value })}
                  placeholder="เช่น 01/01/2530"
                />
              </div>
              <div>
                <label className="label">ประวัติการแพ้</label>
                <textarea 
                  className="input" 
                  style={{ minHeight: 60, padding: "8px" }}
                  value={formData.allergyHistory} 
                  onChange={e => setFormData({ ...formData, allergyHistory: e.target.value })}
                  placeholder="เช่น แพ้สีแบรนด์ X, หนังศีรษะบาง..."
                />
              </div>
              <div>
                <label className="label">ระดับสมาชิก</label>
                <select 
                  className="input" 
                  value={formData.memberLevel} 
                  onChange={e => setFormData({ ...formData, memberLevel: e.target.value })}
                >
                  <option value="BASIC">BASIC</option>
                  <option value="SILVER">SILVER</option>
                  <option value="GOLD">GOLD</option>
                </select>
              </div>

              {error && <p style={{ color: "var(--alert-red)", fontSize: "0.8rem", margin: 0 }}>{error}</p>}

              <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}>
                <button 
                  type="submit" 
                  className="btn-primary" 
                  style={{ flex: 1 }} 
                  disabled={isSaving || !isChanged}
                >
                  {isSaving ? "กำลังบันทึก..." : "บันทึก"}
                </button>
                <button 
                  type="button" 
                  className="btn-secondary" 
                  style={{ flex: 1 }} 
                  onClick={() => setIsModalOpen(false)}
                >
                  ยกเลิก
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
