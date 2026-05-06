"use client";

import { useEffect, useState } from "react";

type Pool = { id: string; name: string; role: string; percentage: number; isActive: boolean };

const ROLES: Record<string, string> = { OWNER: "เจ้าของ", MANAGER: "ผู้จัดการ", CASHIER: "แคชเชียร์", TECHNICIAN: "ช่าง", ASSISTANT: "ผู้ช่วย" };

export default function CommissionPage() {
  const [pools, setPools] = useState<Pool[]>([]);

  useEffect(() => {
    fetch("/api/commission").then(r => r.json()).then(setPools);
  }, []);

  async function updatePool(id: string, percentage: number) {
    await fetch("/api/commission", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, percentage }),
    });
    fetch("/api/commission").then(r => r.json()).then(setPools);
  }

  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--olive)", marginBottom: "1.5rem" }}>💰 ตั้งค่า Commission Pool</h1>
      <div className="card">
        <p style={{ fontSize: "0.875rem", color: "#666", marginBottom: "1rem" }}>
          ค่าคอมมิชชั่นคำนวณจาก Revenue หลังหักต้นทุนเคมี
        </p>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid var(--beige-dark)", color: "#666" }}>
              <th style={{ textAlign: "left", padding: "8px 12px" }}>แผนก</th>
              <th style={{ textAlign: "center", padding: "8px 12px" }}>% ของ Revenue Pool</th>
              <th style={{ padding: "8px 12px" }}></th>
            </tr>
          </thead>
          <tbody>
            {pools.map(p => (
              <tr key={p.id} style={{ borderBottom: "1px solid #f5f5f5" }}>
                <td style={{ padding: "8px 12px" }}>
                  <strong>{p.name}</strong>
                  <div style={{ fontSize: "0.8rem", color: "#888" }}>{ROLES[p.role]}</div>
                </td>
                <td style={{ padding: "8px 12px", textAlign: "center" }}>
                  <input
                    type="number"
                    className="input"
                    style={{ width: 80, textAlign: "center" }}
                    defaultValue={p.percentage}
                    onBlur={e => updatePool(p.id, Number(e.target.value))}
                  />
                  <span style={{ marginLeft: 4 }}>%</span>
                </td>
                <td style={{ padding: "8px 12px", fontSize: "0.8rem", color: "#888" }}>
                  ตัวอย่าง: Revenue 1,000,000 บาท → Pool = ฿{(10000 * p.percentage).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {pools.length === 0 && <p style={{ color: "#aaa", textAlign: "center", padding: "2rem" }}>ไม่พบข้อมูล</p>}
      </div>
    </div>
  );
}
