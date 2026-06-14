"use client";

import { useState } from "react";
import { openCustomerDisplay } from "@/lib/customer-display";

// Header button that opens the customer-facing display window. On a multi-monitor
// PC with the Window Management API it lands on the second screen automatically;
// otherwise it opens as a normal popup the staff can drag over once.
export default function CustomerDisplayButton({ style }: { style?: React.CSSProperties }) {
  const [hint, setHint] = useState<string | null>(null);

  async function handleClick() {
    const { placed } = await openCustomerDisplay();
    if (!placed) {
      setHint("ลากหน้าต่างไปจอที่ 2 แล้วกดเต็มจอได้เลย");
      setTimeout(() => setHint(null), 6000);
    }
  }

  return (
    <div style={{ position: "relative", display: "inline-flex" }}>
      <button
        type="button"
        className="btn-secondary"
        onClick={handleClick}
        title="เปิดหน้าจอแสดงผลสำหรับลูกค้า (จอที่ 2)"
        style={style}
      >
        🖥️ เปิดจอลูกค้า
      </button>
      {hint && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 50,
          background: "var(--text-dark)", color: "white", fontSize: "0.75rem",
          padding: "6px 10px", borderRadius: 8, whiteSpace: "nowrap",
          boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
        }}>
          {hint}
        </div>
      )}
    </div>
  );
}
