// Pure, side-effect-free branding utilities safe to import from client code.
// The server-only counterpart (`branding.ts`) reads from Prisma and must NOT
// be imported by any "use client" file — doing so pulls better-sqlite3 into
// the browser bundle and fails the build with `Can't resolve 'fs'`.

export const DEFAULT_THEME = {
  main: "#6B7C45",
  secondary: "#8FA65A",
  third: "#F5F0E8",
} as const;

export type Branding = {
  shopName: string;
  logoDataUrl: string | null;
  theme: { main: string; secondary: string; third: string };
};

function clamp(n: number) { return Math.max(0, Math.min(255, Math.round(n))); }

/** Mix toward white/black — used to derive --beige-dark from --beige. */
export function mix(hex: string, target: "white" | "black", ratio: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const r = parseInt(m[1].slice(0, 2), 16);
  const g = parseInt(m[1].slice(2, 4), 16);
  const b = parseInt(m[1].slice(4, 6), 16);
  const t = target === "white" ? 255 : 0;
  const nr = clamp(r + (t - r) * ratio);
  const ng = clamp(g + (t - g) * ratio);
  const nb = clamp(b + (t - b) * ratio);
  return `#${nr.toString(16).padStart(2, "0")}${ng.toString(16).padStart(2, "0")}${nb.toString(16).padStart(2, "0")}`;
}

/** Render an inline `<style>` body that sets the live CSS variables. */
export function themeStyleBody(theme: Branding["theme"]): string {
  return `:root{--olive:${theme.main};--olive-light:${theme.secondary};--beige:${theme.third};--beige-dark:${mix(theme.third, "black", 0.08)};}`;
}
