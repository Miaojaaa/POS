"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const menuItems = [
  { href: "/dashboard", label: "หน้าหลัก", icon: "🏠" },
  {
    label: "POS",
    icon: "📋",
    children: [
      { href: "/pos/new", label: "รับออร์เดอร์ใหม่" },
      { href: "/pos/queue", label: "คิวลูกค้า" },
    ],
  },
  {
    label: "CRM",
    icon: "👥",
    children: [
      { href: "/crm/members", label: "สมาชิก" },
      { href: "/crm/tickets", label: "คูปอง / Ticket" },
      { href: "/crm/wallet", label: "Wallet" },
    ],
  },
  {
    label: "สต็อก (ERP)",
    icon: "📦",
    children: [
      { href: "/erp/main", label: "คลังหลัก" },
      { href: "/erp/sub", label: "คลังหน้าร้าน" },
      { href: "/erp/transfers", label: "โอนสินค้า" },
      { href: "/erp/report", label: "รายงานสต็อก" },
    ],
  },
  {
    label: "รายงาน",
    icon: "📊",
    children: [
      { href: "/reports/revenue", label: "รายได้ & ต้นทุน" },
      { href: "/reports/profit", label: "กำไรจริง" },
      { href: "/reports/expenses", label: "ค่าใช้จ่าย" },
    ],
  },
  {
    label: "HR & Payroll",
    icon: "👤",
    children: [
      { href: "/hr/staff", label: "พนักงาน" },
      { href: "/hr/kpi", label: "KPI" },
      { href: "/hr/payroll", label: "เงินเดือน & ค่าคอม" },
    ],
  },
  {
    label: "ตั้งค่า",
    icon: "⚙️",
    children: [
      { href: "/settings/services", label: "บริการ" },
      { href: "/settings/users", label: "สิทธิ์ผู้ใช้" },
      { href: "/settings/products", label: "สินค้า/เคมี" },
      { href: "/settings/commission", label: "ค่าคอม Pool" },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [openMenus, setOpenMenus] = useState<string[]>(["POS"]);

  function toggle(label: string) {
    setOpenMenus(prev =>
      prev.includes(label) ? prev.filter(m => m !== label) : [...prev, label]
    );
  }

  return (
    <aside style={{
      width: 220,
      minHeight: "100vh",
      background: "var(--olive)",
      display: "flex",
      flexDirection: "column",
      padding: "1rem 0.75rem",
      flexShrink: 0,
    }}>
      <div style={{ textAlign: "center", padding: "0.5rem 0 1.25rem", borderBottom: "1px solid rgba(255,255,255,0.2)" }}>
        <div style={{ fontSize: 28, marginBottom: 4 }}>✂️</div>
        <div style={{ color: "white", fontWeight: 700, fontSize: "1rem" }}>ร้านเสริมสวย</div>
        <div style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.75rem", marginTop: 2 }}>
          ระบบบริหารจัดการร้าน
        </div>
      </div>

      <nav style={{ flex: 1, marginTop: "0.75rem", overflowY: "auto" }}>
        {menuItems.map(item => {
          if (!item.children) {
            return (
              <Link
                key={item.href}
                href={item.href!}
                className={`sidebar-item ${pathname === item.href ? "active" : ""}`}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          }
          const isOpen = openMenus.includes(item.label);
          const isChildActive = item.children.some(c => pathname.startsWith(c.href));
          return (
            <div key={item.label}>
              <button
                onClick={() => toggle(item.label)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  width: "100%",
                  padding: "0.625rem 1rem",
                  background: isChildActive ? "rgba(255,255,255,0.15)" : "none",
                  border: "none",
                  color: "rgba(255,255,255,0.9)",
                  cursor: "pointer",
                  borderRadius: 8,
                  fontSize: "0.9rem",
                  textAlign: "left",
                }}
              >
                <span>{item.icon}</span>
                <span style={{ flex: 1 }}>{item.label}</span>
                <span style={{ fontSize: "0.75rem" }}>{isOpen ? "▾" : "▸"}</span>
              </button>
              {isOpen && (
                <div style={{ paddingLeft: "1.5rem" }}>
                  {item.children.map(child => (
                    <Link
                      key={child.href}
                      href={child.href}
                      className={`sidebar-item ${pathname === child.href ? "active" : ""}`}
                      style={{ fontSize: "0.85rem" }}
                    >
                      <span>·</span>
                      <span>{child.label}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
