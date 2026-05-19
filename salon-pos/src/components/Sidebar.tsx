"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

const menuItems = [
  {
    label: "POS",
    icon: "📋",
    children: [
      { href: "/pos/new", label: "รับออร์เดอร์ใหม่" },
      { href: "/pos/queue", label: "คิวลูกค้า" },
      { href: "/pos/history", label: "ประวัติ Transaction" },
    ],
  },
  { href: "/dashboard", label: "ภาพรวมรายวัน", icon: "🏠" },
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
      { href: "/erp/retail", label: "คลัง Retail" },
      { href: "/erp/transfers", label: "โอนสินค้า" },
      { href: "/erp/report", label: "รายงานสต็อก" },
    ],
  },
  {
    label: "รายงาน",
    icon: "📊",
    children: [
      { href: "/reports/revenue", label: "รายได้ & ต้นทุน" },
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
      { href: "/settings/branding", label: "แบรนด์ร้าน" },
      { href: "/settings/services", label: "บริการ" },
      { href: "/settings/products", label: "สินค้า/เคมี" },
      { href: "/settings/commission", label: "ค่าคอม Pool" },
    ],
  },
];

const COLLAPSE_KEY = "sidebar.collapsed";

export default function Sidebar() {
  const pathname = usePathname();
  const [openMenus, setOpenMenus] = useState<string[]>(["POS"]);
  const [collapsed, setCollapsed] = useState(false);
  const [shopName, setShopName] = useState("ร้านเสริมสวย");
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
    } catch {}
  }, []);

  const loadBranding = useCallback(() => {
    fetch("/api/branding")
      .then(r => r.ok ? r.json() : null)
      .then((b: { shopName: string; logoDataUrl: string | null } | null) => {
        if (!b) return;
        if (b.shopName) setShopName(b.shopName);
        setLogoDataUrl(b.logoDataUrl);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadBranding();
    const handler = () => loadBranding();
    window.addEventListener("branding-updated", handler);
    return () => window.removeEventListener("branding-updated", handler);
  }, [loadBranding]);

  function toggle(label: string) {
    if (collapsed) return;
    setOpenMenus(prev =>
      prev.includes(label) ? prev.filter(m => m !== label) : [...prev, label]
    );
  }

  function toggleCollapse() {
    setCollapsed(prev => {
      const next = !prev;
      try { localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0"); } catch {}
      return next;
    });
  }

  const width = collapsed ? 64 : 220;

  return (
    <aside style={{
      width,
      minHeight: "100vh",
      background: "var(--olive)",
      display: "flex",
      flexDirection: "column",
      padding: collapsed ? "0.75rem 0.4rem" : "1rem 0.75rem",
      flexShrink: 0,
      transition: "width 0.2s ease, padding 0.2s ease",
      position: "relative",
    }}>
      <button
        type="button"
        onClick={toggleCollapse}
        title={collapsed ? "ขยาย Sidebar" : "ย่อ Sidebar"}
        style={{
          position: "absolute",
          top: 12,
          right: -12,
          width: 24,
          height: 24,
          borderRadius: "50%",
          border: "1px solid rgba(0,0,0,0.1)",
          background: "white",
          color: "var(--olive)",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 12,
          boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
          zIndex: 2,
        }}
      >
        {collapsed ? "›" : "‹"}
      </button>

      <div style={{
        textAlign: "center",
        padding: collapsed ? "0.25rem 0 0.75rem" : "0.5rem 0 1.25rem",
        borderBottom: "1px solid rgba(255,255,255,0.2)",
      }}>
        <div style={{
          width: collapsed ? 36 : 56,
          height: collapsed ? 36 : 56,
          margin: "0 auto",
          marginBottom: collapsed ? 0 : 6,
          borderRadius: 12,
          background: "white",
          display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden",
        }}>
          {logoDataUrl
            ? <img src={logoDataUrl} alt="logo" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
            : <span style={{ fontSize: collapsed ? 20 : 28 }}>✂️</span>}
        </div>
        {!collapsed && (
          <>
            <div style={{ color: "white", fontWeight: 700, fontSize: "0.95rem", lineHeight: 1.2 }}>{shopName}</div>
            <div style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.75rem", marginTop: 2 }}>
              ระบบบริหารจัดการร้าน
            </div>
          </>
        )}
      </div>

      <nav style={{ flex: 1, marginTop: "0.75rem", overflowY: "auto", overflowX: "hidden" }}>
        {menuItems.map(item => {
          if (!item.children) {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href!}
                className={`sidebar-item ${active ? "active" : ""}`}
                title={collapsed ? item.label : undefined}
                style={collapsed ? { justifyContent: "center", padding: "0.625rem 0", gap: 0 } : undefined}
              >
                <span>{item.icon}</span>
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          }
          const isOpen = !collapsed && openMenus.includes(item.label);
          const isChildActive = item.children.some(c => pathname.startsWith(c.href));
          return (
            <div key={item.label}>
              <button
                onClick={() => toggle(item.label)}
                title={collapsed ? item.label : undefined}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: collapsed ? 0 : "0.75rem",
                  width: "100%",
                  padding: collapsed ? "0.625rem 0" : "0.625rem 1rem",
                  justifyContent: collapsed ? "center" : "flex-start",
                  background: isChildActive ? "rgba(255,255,255,0.15)" : "none",
                  border: "none",
                  color: "rgba(255,255,255,0.9)",
                  cursor: collapsed ? "default" : "pointer",
                  borderRadius: 8,
                  fontSize: "0.9rem",
                  textAlign: "left",
                }}
              >
                <span>{item.icon}</span>
                {!collapsed && <span style={{ flex: 1 }}>{item.label}</span>}
                {!collapsed && <span style={{ fontSize: "0.75rem" }}>{isOpen ? "▾" : "▸"}</span>}
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
