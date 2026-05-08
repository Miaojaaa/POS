"use client";

import { useEffect, useState } from "react";

type Customer = { id: string; name: string; phone: string; walletBalance: number; memberLevel: string };

export default function MembersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/customers").then(r => r.json()).then(data => {
      setCustomers(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

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
    </div>
  );
}
