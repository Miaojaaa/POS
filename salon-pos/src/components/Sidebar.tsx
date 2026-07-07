"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DEFAULT_SIDEBAR_CONFIG,
  MODULE_LABELS,
  mergeSidebarConfig,
  type SidebarModuleConfig,
  type SidebarModuleKey,
} from "@/lib/system-config";
import { OWNER_LOCKED_MODULES, useOwnerLock } from "@/context/OwnerLockContext";
import { useBranding } from "@/context/BrandingContext";
import { 
  ClipboardList, 
  LayoutDashboard, 
  Users, 
  Package, 
  BarChart2, 
  UserCircle, 
  Settings,
  Scissors,
  Lock,
  Unlock,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp
} from "lucide-react";

const MODULE_ICONS: Record<SidebarModuleKey, React.ElementType> = {
  POS: ClipboardList,
  DASHBOARD: LayoutDashboard,
  CRM: Users,
  ERP: Package,
  REPORTS: BarChart2,
  HR: UserCircle,
  SETTINGS: Settings,
};

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
      { href: "/settings/branding", label: "ข้อมูลร้าน" },
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
  const branding = useBranding();
  const [openMenus, setOpenMenus] = useState<string[]>(["POS"]);
  const [collapsed, setCollapsed] = useState(false);
  // shopName / logo come straight from the SSR-provided branding context,
  // so they're correct on the very first paint — no FOUC.
  const shopName = branding.shopName;
  const logoDataUrl = branding.logoDataUrl;
  const [sidebarConfig, setSidebarConfig] = useState<SidebarModuleConfig[]>(DEFAULT_SIDEBAR_CONFIG);

  // Owner lock
  const { isUnlocked, remainingSeconds, unlock, lock } = useOwnerLock();
  const [showPinModal, setShowPinModal] = useState(false);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
    } catch {}
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
    loadSystemConfig();
    const onSystem = () => loadSystemConfig();
    window.addEventListener("system-config-updated", onSystem);
    return () => {
      window.removeEventListener("system-config-updated", onSystem);
    };
  }, [loadSystemConfig]);

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

  // PIN verification for owner lock
  async function verifyOwnerPin() {
    setPinError("");
    const res = await fetch("/api/verify-pin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "OWNER", pin }),
    });

    if (res.ok) {
      setShowPinModal(false);
      setPin("");
      unlock();
    } else {
      setPinError("PIN ไม่ถูกต้อง");
    }
  }

  function handleLockedModuleClick(item: MenuItem) {
    if (isUnlocked) {
      // Already unlocked, behave normally
      toggle(item.key);
    } else {
      // Show PIN modal
      setShowPinModal(true);
    }
  }

  function handleLockedLinkClick(e: React.MouseEvent, href: string) {
    if (!isUnlocked) {
      e.preventDefault();
      setShowPinModal(true);
    }
  }

  // Format remaining time as mm:ss
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  const width = collapsed ? 64 : 220;

  // Find where owner-locked section starts
  const firstLockedIndex = menuItems.findIndex(item => OWNER_LOCKED_MODULES.has(item.key));

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
        {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
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
            : <Scissors size={collapsed ? 20 : 28} style={{ color: "var(--olive)" }} />}
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
        {menuItems.map((item, idx) => {
          const label = MODULE_LABELS[item.key];
          const Icon = MODULE_ICONS[item.key];
          const isLocked = OWNER_LOCKED_MODULES.has(item.key);
          const showLockedUI = isLocked && !isUnlocked;

          // Show separator before owner-locked section
          const showSeparator = idx === firstLockedIndex;

          return (
            <div key={item.key}>
              {/* Separator before owner-locked section */}
              {showSeparator && (
                <div style={{
                  margin: collapsed ? "0.5rem 0" : "0.5rem 0.5rem",
                  padding: collapsed ? "0" : "0",
                  borderTop: "1px solid rgba(255,255,255,0.15)",
                  position: "relative",
                }}>
                  {!collapsed && (
                    <div style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "0.5rem 0.5rem 0.25rem",
                    }}>
                      <span style={{
                        fontSize: "0.7rem",
                        color: isUnlocked ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.45)",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        fontWeight: 600,
                        display: "flex",
                        alignItems: "center",
                        gap: "0.35rem",
                      }}>
                        {isUnlocked ? <Unlock size={14} /> : <Lock size={14} />} Owner Only
                      </span>
                      {isUnlocked ? (
                        <button
                          onClick={lock}
                          style={{
                            fontSize: "0.65rem",
                            background: "rgba(255,255,255,0.15)",
                            border: "none",
                            color: "rgba(255,255,255,0.8)",
                            borderRadius: 4,
                            padding: "2px 6px",
                            cursor: "pointer",
                          }}
                          title="ล็อคตอนนี้"
                        >
                          ⏱ {formatTime(remainingSeconds)}
                        </button>
                      ) : (
                        <button
                          onClick={() => setShowPinModal(true)}
                          style={{
                            fontSize: "0.65rem",
                            background: "rgba(255,255,255,0.15)",
                            border: "none",
                            color: "rgba(255,255,255,0.8)",
                            borderRadius: 4,
                            padding: "2px 6px",
                            cursor: "pointer",
                          }}
                        >
                          ปลดล็อค
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Render menu item */}
              {!item.children ? (
                // Simple link item
                showLockedUI ? (
                  <button
                    onClick={() => setShowPinModal(true)}
                    title={collapsed ? label : undefined}
                    className="sidebar-item"
                    style={{
                      ...collapsed ? { justifyContent: "center", padding: "0.625rem 0", gap: 0 } : {},
                      width: "100%",
                      background: "none",
                      border: "none",
                      opacity: 0.45,
                      cursor: "pointer",
                    }}
                  >
                    <span><Icon size={20} /></span>
                    {!collapsed && <span>{label}</span>}
                    {!collapsed && <span style={{ marginLeft: "auto", fontSize: "0.75rem" }}>🔒</span>}
                  </button>
                ) : (
                  <Link
                    href={item.href!}
                    className={`sidebar-item ${pathname === item.href ? "active" : ""}`}
                    title={collapsed ? label : undefined}
                    style={collapsed ? { justifyContent: "center", padding: "0.625rem 0", gap: 0 } : undefined}
                  >
                    <span><Icon size={20} /></span>
                    {!collapsed && <span>{label}</span>}
                  </Link>
                )
              ) : (
                // Expandable menu
                (() => {
                  const isOpen = !collapsed && openMenus.includes(item.key);
                  const isChildActive = item.children.some(c => pathname.startsWith(c.href));
                  return (
                    <>
                      <button
                        onClick={() => showLockedUI ? setShowPinModal(true) : toggle(item.key)}
                        title={collapsed ? label : undefined}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: collapsed ? 0 : "0.75rem",
                          width: "100%",
                          padding: collapsed ? "0.625rem 0" : "0.625rem 1rem",
                          justifyContent: collapsed ? "center" : "flex-start",
                          background: !showLockedUI && isChildActive ? "rgba(255,255,255,0.15)" : "none",
                          border: "none",
                          color: showLockedUI ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.9)",
                          cursor: "pointer",
                          borderRadius: 8,
                          fontSize: "0.9rem",
                          textAlign: "left",
                        }}
                      >
                        <span><Icon size={20} /></span>
                        {!collapsed && <span style={{ flex: 1 }}>{label}</span>}
                        {!collapsed && (
                          showLockedUI
                            ? <Lock size={14} />
                            : (isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />)
                        )}
                      </button>
                      {isOpen && !showLockedUI && (
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
                    </>
                  );
                })()
              )}
            </div>
          );
        })}
      </nav>

      {/* Owner PIN Modal */}
      {showPinModal && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 9999,
        }}>
          <div style={{
            background: "white",
            borderRadius: 16,
            padding: "1.5rem",
            maxWidth: 340,
            width: "90%",
            boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
          }}>
            <div style={{ textAlign: "center", marginBottom: "1rem" }}>
              <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>🔒</div>
              <h3 style={{ margin: 0, color: "var(--olive)", fontSize: "1.1rem" }}>Owner Access</h3>
              <p style={{ fontSize: "0.8rem", color: "#888", marginTop: 4 }}>
                กรุณากรอก PIN ของ Owner เพื่อเข้าถึงเมนูนี้
                <br />
                (ปลดล็อค 5 นาที)
              </p>
            </div>
            <input
              type="password"
              className="input"
              placeholder="กรอก PIN"
              value={pin}
              onChange={e => setPin(e.target.value)}
              onKeyDown={e => e.key === "Enter" && verifyOwnerPin()}
              autoFocus
              style={{ textAlign: "center", fontSize: "1.2rem", letterSpacing: "0.3em" }}
            />
            {pinError && (
              <p style={{ color: "var(--alert-red)", fontSize: "0.75rem", marginTop: 6, textAlign: "center" }}>
                {pinError}
              </p>
            )}
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "1.25rem" }}>
              <button
                className="btn-primary"
                style={{ flex: 1 }}
                onClick={verifyOwnerPin}
                disabled={!pin}
              >
                ปลดล็อค
              </button>
              <button
                className="btn-secondary"
                style={{ flex: 1 }}
                onClick={() => { setShowPinModal(false); setPin(""); setPinError(""); }}
              >
                ยกเลิก
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
