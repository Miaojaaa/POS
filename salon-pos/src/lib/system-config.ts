// Centralizes the keys used for system-wide configuration stored in `SystemConfig`,
// plus the catalogue of toggleable sidebar modules. Both the API and the
// settings UI import from here so they can't drift out of sync.

export type CommissionMode = "POOL" | "PER_HEAD" | "NONE";
export type VatMode = "EXCLUSIVE" | "INCLUSIVE";

export type FinanceConfig = {
  commissionMode: CommissionMode;
  positionAllowance: boolean;
  vatMode: VatMode;
};

export const DEFAULT_FINANCE: FinanceConfig = {
  commissionMode: "POOL",
  positionAllowance: true,
  vatMode: "EXCLUSIVE",
};

// Top-level sidebar modules the user can toggle / reorder. Sub-pages stay grouped under their module
// and are not individually controllable from settings (to keep the UX simple).
export type SidebarModuleKey = "POS" | "DASHBOARD" | "CRM" | "ERP" | "REPORTS" | "HR" | "SETTINGS";

export type SidebarModuleConfig = { key: SidebarModuleKey; enabled: boolean };

// Default order matches the existing layout. New modules added later default to enabled at the end.
export const DEFAULT_SIDEBAR_ORDER: SidebarModuleKey[] = [
  "POS",
  "DASHBOARD",
  "CRM",
  "ERP",
  "REPORTS",
  "HR",
  "SETTINGS",
];

export const DEFAULT_SIDEBAR_CONFIG: SidebarModuleConfig[] =
  DEFAULT_SIDEBAR_ORDER.map(key => ({ key, enabled: true }));

// Settings cannot be disabled — otherwise the user can't recover access to this page.
export const NON_HIDEABLE_MODULES = new Set<SidebarModuleKey>(["SETTINGS"]);

export const MODULE_LABELS: Record<SidebarModuleKey, string> = {
  POS: "POS",
  DASHBOARD: "ภาพรวมรายวัน",
  CRM: "CRM",
  ERP: "สต็อก (ERP)",
  REPORTS: "รายงาน",
  HR: "HR & Payroll",
  SETTINGS: "ตั้งค่า",
};

export const MODULE_ICONS: Record<SidebarModuleKey, string> = {
  POS: "📋",
  DASHBOARD: "🏠",
  CRM: "👥",
  ERP: "📦",
  REPORTS: "📊",
  HR: "👤",
  SETTINGS: "⚙️",
};

// Merges saved sidebar config with the canonical module list. Missing modules
// (added in a later release) get appended enabled-by-default; SETTINGS is forced enabled.
export function mergeSidebarConfig(saved: SidebarModuleConfig[] | null | undefined): SidebarModuleConfig[] {
  const result: SidebarModuleConfig[] = [];
  const seen = new Set<SidebarModuleKey>();
  if (Array.isArray(saved)) {
    for (const s of saved) {
      if (!(s.key in MODULE_LABELS)) continue;
      if (seen.has(s.key)) continue;
      const enabled = NON_HIDEABLE_MODULES.has(s.key) ? true : Boolean(s.enabled);
      result.push({ key: s.key, enabled });
      seen.add(s.key);
    }
  }
  for (const key of DEFAULT_SIDEBAR_ORDER) {
    if (!seen.has(key)) result.push({ key, enabled: true });
  }
  return result;
}
