"use client";

import { useState } from "react";
import { exportDailyXlsx, type OrderForExport } from "@/lib/excel";

export default function DailyExportButton() {
  const [exporting, setExporting] = useState(false);

  async function handleClick() {
    setExporting(true);
    try {
      const today = new Date();
      const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
      const end = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999).toISOString();

      const res = await fetch(`/api/orders?status=PAID&startDate=${start}&endDate=${end}`);
      if (!res.ok) {
        alert(`ดึงข้อมูลไม่สำเร็จ (HTTP ${res.status})`);
        return;
      }
      const orders: OrderForExport[] = await res.json();
      if (!Array.isArray(orders)) {
        alert("รูปแบบข้อมูลผิดพลาด");
        return;
      }
      if (orders.length === 0) {
        alert("ยังไม่มีออร์เดอร์ที่จ่ายแล้วในวันนี้");
        return;
      }
      await exportDailyXlsx(orders, today);
    } catch (err) {
      console.error("Daily export error:", err);
      alert(`ส่งออกไม่สำเร็จ — ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setExporting(false);
    }
  }

  return (
    <button
      className="btn-primary"
      onClick={handleClick}
      disabled={exporting}
      style={{ background: "#16a34a" }}
    >
      {exporting ? "กำลังส่งออก..." : "📥 Export รายวัน"}
    </button>
  );
}
