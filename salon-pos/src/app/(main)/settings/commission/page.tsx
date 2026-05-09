"use client";

import { useEffect, useState } from "react";

type Pool = { id: string; name: string; role: string; percentage: number; isActive: boolean };

const ROLES: Record<string, string> = { OWNER: "เจ้าของ", MANAGER: "ผู้จัดการ", CASHIER: "แคชเชียร์", TECHNICIAN: "ช่าง", ASSISTANT: "ผู้ช่วย" };

export default function CommissionPage() {
  const [pools, setPools] = useState<Pool[]>([]);
  const [unlocked, setUnlocked] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [pendingEdit, setPendingEdit] = useState<{ id: string; percentage: number } | null>(null);

  useEffect(() => {
    fetch("/api/commission").then(r => r.json()).then(setPools);
  }, []);

  async function verifyPin() {
    setPinError("");
    const res = await fetch("/api/verify-pin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "OWNER", pin }),
    });
    const data = await res.json();
    if (data.ok) {
      setUnlocked(true);
      setShowPinModal(false);
      setPin("");
      if (pendingEdit) {
        await persistPool(pendingEdit.id, pendingEdit.percentage);
        setPendingEdit(null);
      }
    } else {
      setPinError("Owner PIN ไม่ถูกต้อง");
    }
  }

  async function persistPool(id: string, percentage: number) {
    await fetch("/api/commission", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, percentage }),
    });
    fetch("/api/commission").then(r => r.json()).then(setPools);
  }

  function handleBlur(id: string, percentage: number) {
    if (unlocked) {
      persistPool(id, percentage);
    } else {
      setPendingEdit({ id, percentage });
      setShowPinModal(true);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--olive)", margin: 0 }}>💰 ตั้งค่า Commission Pool</h1>
        {unlocked ? (
          <span style={{ fontSize: "0.8rem", color: "var(--success-green, #2d6a4f)", fontWeight: 600 }}>🔓 ปลดล็อกแล้ว (Owner)</span>
        ) : (
          <button
            onClick={() => setShowPinModal(true)}
            style={{ fontSize: "0.8rem", color: "#666", background: "none", border: "1px solid #ddd", borderRadius: 6, padding: "4px 10px", cursor: "pointer" }}
          >
            🔐 ปลดล็อก (Owner PIN)
          </button>
        )}
      </div>
      <div className="card">
        <p style={{ fontSize: "0.875rem", color: "#666", marginBottom: "1rem" }}>
          ค่าคอมมิชชั่นคำนวณจาก Revenue หลังหักต้นทุนเคมี — <strong>การแก้ไขต้องใช้ Owner PIN เท่านั้น</strong>
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
                    style={{
                      width: 80,
                      textAlign: "center",
                      background: unlocked ? "white" : "#f5f5f5",
                      cursor: unlocked ? "text" : "pointer",
                    }}
                    defaultValue={p.percentage}
                    readOnly={!unlocked}
                    onClick={() => { if (!unlocked) setShowPinModal(true); }}
                    onBlur={e => handleBlur(p.id, Number(e.target.value))}
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

      {showPinModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 340 }}>
            <h3 style={{ margin: "0 0 0.5rem", color: "var(--olive)" }}>🔐 Owner PIN</h3>
            <p style={{ fontSize: "0.875rem", color: "#666", marginBottom: "1rem" }}>
              การแก้ไขค่าคอมต้องใช้ Owner PIN เท่านั้น
            </p>
            <input
              type="password"
              className="input"
              placeholder="Owner PIN 4-6 หลัก"
              value={pin}
              onChange={e => setPin(e.target.value)}
              onKeyDown={e => e.key === "Enter" && verifyPin()}
              autoFocus
            />
            {pinError && <div style={{ color: "var(--alert-red)", fontSize: "0.875rem", marginTop: "0.5rem" }}>{pinError}</div>}
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
              <button className="btn-primary" style={{ flex: 1 }} onClick={verifyPin}>ยืนยัน</button>
              <button className="btn-secondary" style={{ flex: 1 }} onClick={() => { setShowPinModal(false); setPin(""); setPinError(""); setPendingEdit(null); }}>
                ยกเลิก
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
