"use client";

import { useEffect, useState } from "react";

export type PinVerifyResult = {
  userId: string;
  userName: string;
  role: "MANAGER" | "OWNER";
};

type Props = {
  open: boolean;
  title?: string;
  description?: string;
  requiredRole?: "MANAGER" | "OWNER";
  onSuccess: (result: PinVerifyResult) => void;
  onClose: () => void;
};

export default function PinVerifyModal({
  open,
  title = "ยืนยันรหัส PIN",
  description = "กรอก PIN ของผู้มีสิทธิ์ (Manager หรือ Owner) เพื่อระบุตัวตน",
  requiredRole = "MANAGER",
  onSuccess,
  onClose,
}: Props) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setPin("");
      setError("");
      setSubmitting(false);
    }
  }, [open]);

  if (!open) return null;

  async function verify() {
    if (pin.length < 4 || pin.length > 8) {
      setError("PIN ต้องมีความยาว 4-8 หลัก");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/verify-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: requiredRole, pin }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "PIN ไม่ถูกต้อง");
        setSubmitting(false);
        return;
      }
      onSuccess({
        userId: data.userId,
        userName: data.userName,
        role: data.usedRole,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 360 }}>
        <h3 style={{ margin: "0 0 0.5rem", color: "var(--olive)" }}>{title}</h3>
        <p style={{ fontSize: "0.85rem", color: "#666", marginBottom: "1rem" }}>{description}</p>
        <input
          type="password"
          inputMode="numeric"
          className="input"
          placeholder="PIN 4-8 หลัก"
          value={pin}
          autoFocus
          onChange={e => { setPin(e.target.value); setError(""); }}
          onKeyDown={e => { if (e.key === "Enter") verify(); }}
          disabled={submitting}
        />
        {error && (
          <div style={{ color: "var(--alert-red)", fontSize: "0.85rem", marginTop: "0.5rem" }}>
            {error}
          </div>
        )}
        <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
          <button className="btn-primary" style={{ flex: 1 }} onClick={verify} disabled={submitting}>
            {submitting ? "กำลังตรวจสอบ..." : "ยืนยัน"}
          </button>
          <button className="btn-secondary" style={{ flex: 1 }} onClick={onClose} disabled={submitting}>
            ยกเลิก
          </button>
        </div>
      </div>
    </div>
  );
}
