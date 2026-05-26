"use client";

import { useEffect, useState } from "react";

type Props = {
  open: boolean;
  userName: string;
  pin: string;
  onClose: () => void;
};

/**
 * One-time PIN reveal. Forces the operator to type the PIN back before
 * the modal closes — that "acknowledgement keystroke" is the only proof
 * the number was actually read, since the PIN is not stored anywhere
 * after this modal disappears.
 */
export default function PinRevealModal({ open, userName, pin, onClose }: Props) {
  const [typed, setTyped] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setTyped("");
      setError("");
    }
  }, [open]);

  if (!open) return null;

  function confirm() {
    if (typed !== pin) {
      setError("ตัวเลขไม่ตรงกับ PIN ที่แสดงด้านบน");
      return;
    }
    onClose();
  }

  return (
    <div className="modal-overlay" style={{ zIndex: 1200 }}>
      <div className="modal" style={{ maxWidth: 420, textAlign: "center" }}>
        <h3 style={{ margin: "0 0 0.5rem", color: "var(--olive)" }}>🔐 PIN ของ {userName}</h3>
        <p style={{ fontSize: "0.85rem", color: "#666", marginBottom: "1rem" }}>
          จดรหัสนี้ไว้ให้ดี — ระบบจะแสดงเพียงครั้งเดียว
          เมื่อปิดหน้านี้แล้วจะไม่สามารถดูซ้ำได้
        </p>

        <div style={{
          background: "var(--beige)",
          border: "2px dashed var(--olive)",
          borderRadius: 12,
          padding: "1.25rem",
          margin: "0 0 1.25rem",
          fontSize: "2.4rem",
          fontWeight: 700,
          letterSpacing: "0.4rem",
          color: "var(--olive)",
          fontFamily: "monospace",
        }}>
          {pin}
        </div>

        <label className="label" style={{ textAlign: "left" }}>
          พิมพ์ PIN ข้างบนอีกครั้งเพื่อยืนยันว่าจดแล้ว
        </label>
        <input
          type="text"
          inputMode="numeric"
          className="input"
          autoFocus
          value={typed}
          onChange={e => { setTyped(e.target.value); setError(""); }}
          onKeyDown={e => { if (e.key === "Enter") confirm(); }}
          placeholder="พิมพ์ตัวเลขที่แสดง"
          style={{ textAlign: "center", letterSpacing: "0.2rem", fontSize: "1.1rem" }}
        />
        {error && (
          <div style={{ color: "var(--alert-red)", fontSize: "0.85rem", marginTop: "0.5rem" }}>
            {error}
          </div>
        )}

        <button
          className="btn-primary"
          style={{ width: "100%", marginTop: "1rem" }}
          onClick={confirm}
          disabled={typed.length === 0}
        >
          ยืนยันและปิด
        </button>
      </div>
    </div>
  );
}
