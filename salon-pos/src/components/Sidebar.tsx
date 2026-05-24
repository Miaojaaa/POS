"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DEFAULT_SIDEBAR_CONFIG,
  MODULE_ICONS,
  MODULE_LABELS,
  mergeSidebarConfig,
  type SidebarModuleConfig,
  type SidebarModuleKey,
} from "@/lib/system-config";

type MenuChild = { href: string; label: string };
type MenuItem = {
  key: SidebarModuleKey;
  href?: string;
  children?: MenuChild[];
};

const MENU_DEFINITIONS: Record<SidebarModuleKey, MenuItem> = {
  POS: {
    key: "POS",
    children: [
      { href: "/pos/new", label: "รับออร์เดอร์ใหม่" },
      { href: "/pos/queue", label: "คิวลูกค้า" },
      { href: "/pos/history", label: "ประวัติ Transaction" },
    ],
  },
  DASHBOARD: { key: "DASHBOARD", href: "/dashboard" },
  CRM: {
    key: "CRM",
    children: [
      { href: "/crm/members", label: "สมาชิก" },
      { href: "/crm/tickets", label: "คูปอง / Ticket" },
      { href: "/crm/wallet", label: "Wallet" },
    ],
  },
  ERP: {
    key: "ERP",
    children: [
      { href: "/erp/main", label: "คลังหลัก" },
      { href: "/erp/sub", label: "คลังหน้าร้าน" },
      { href: "/erp/retail", label: "คลัง Retail" },
      { href: "/erp/transfers", label: "โอนสินค้า" },
      { href: "/erp/report", label: "รายงานสต็อก" },
    ],
  },
  REPORTS: {
    key: "REPORTS",
    children: [
      { href: "/reports/revenue", label: "รายได้ & ต้นทุน" },
      { href: "/reports/expenses", label: "ค่าใช้จ่าย" },
    ],
  },
  HR: {
    key: "HR",
    children: [
      { href: "/hr/staff", label: "พนักงาน" },
      { href: "/hr/kpi", label: "KPI" },
      { href: "/hr/payroll", label: "เงินเดือน & ค่าคอม" },
    ],
  },
  SETTINGS: {
    key: "SETTINGS",
    children: [
      { href: "/settings/branding", label: "แบรนด์ร้าน" },
      { href: "/settings/finance", label: "การเงิน" },
      { href: "/settings/features", label: "ฟีเจอร์ & Sidebar" },
      { href: "/settings/services", label: "บริการ" },
      { href: "/settings/products", label: "สินค้า/เคมี" },
    ],
  },
};

const COLLAPSE_KEY = "sidebar.collapsed";

export default function Sidebar() {
  const pathname = usePathname();
  const [openMenus, setOpenMenus] = useState<string[]>(["POS"]);
  const [collapsed, setCollapsed] = useState(false);
  const [shopName, setShopName] = useState("ร้านเสริมสวย");
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  const [sidebarConfig, setSidebarConfig] = useState<SidebarModuleConfig[]>(DEFAULT_SIDEBAR_CONFIG);

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

  const loadSystemConfig = useCallback(() => {
    fetch("/api/system-config")
      .then(r => r.ok ? r.json() : null)
      .then((d: { sidebar: SidebarModuleConfig[] } | null) => {
        if (d?.sidebar) setSidebarConfig(mergeSidebarConfig(d.sidebar));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadBranding();
    loadSystemConfig();
    const onBranding = () => loadBranding();
    const onSystem = () => loadSystemConfig();
    window.addEventListener("branding-updated", onBranding);
    window.addEventListener("system-config-updated", onSystem);
    return () => {
      window.removeEventListener("branding-updated", onBranding);
      window.removeEventListener("system-config-updated", onSystem);
    };
  }, [loadBranding, loadSystemConfig]);

  // Build the rendered menu list from saved config — order matches the user's preference, disabled
  // modules are filtered out, and only modules that have a definition are surfaced.
  const menuItems = useMemo<MenuItem[]>(
    () => sidebarConfig.filter(c => c.enabled).map(c => MENU_DEFINITIONS[c.key]).filter(Boolean),
    [sidebarConfig],
  );

  function toggle(label: string) {
    if (collapsed) {
      setCollapsed(false);
      try { localStorage.setItem(COLLAPSE_KEY, "0"); } catch {}
      setOpenMenus(prev => prev.includes(label) ? prev : [...prev, label]);
      return;
    }
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
          const label = MODULE_LABELS[item.key];
          const icon = MODULE_ICONS[item.key];
          if (!item.children) {
            const active = pathname === item.href;
            return (
              <Link
                key={item.key}
                href={item.href!}
                className={`sidebar-item ${active ? "active" : ""}`}
                title={collapsed ? label : undefined}
                style={collapsed ? { justifyContent: "center", padding: "0.625rem 0", gap: 0 } : undefined}
              >
                <span>{icon}</span>
                {!collapsed && <span>{label}</span>}
              </Link>
            );
          }
          const isOpen = !collapsed && openMenus.includes(item.key);
          const isChildActive = item.children.some(c => pathname.startsWith(c.href));
          return (
            <div key={item.key}>
              <button
                onClick={() => toggle(item.key)}
                title={collapsed ? label : undefined}
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
                  cursor: "pointer",
                  borderRadius: 8,
                  fontSize: "0.9rem",
                  textAlign: "left",
                }}
              >
                <span>{icon}</span>
                {!collapsed && <span style={{ flex: 1 }}>{label}</span>}
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
