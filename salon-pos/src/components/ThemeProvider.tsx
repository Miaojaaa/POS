"use client";

import { useEffect } from "react";

// Defaults must match globals.css so the UI looks correct before the API responds.
const DEFAULTS = { main: "#6B7C45", secondary: "#8FA65A", third: "#F5F0E8" };

function clamp(n: number) { return Math.max(0, Math.min(255, Math.round(n))); }

// Lighten/darken a hex color by mixing toward white/black — used to derive
// --olive-light hover and --beige-dark border tones from the user's pair so the
// derived shades stay visually consistent with the chosen base.
function mix(hex: string, target: "white" | "black", ratio: number): string {
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

function applyTheme(theme: { main: string; secondary: string; third: string }) {
  const root = document.documentElement;
  root.style.setProperty("--olive", theme.main);
  root.style.setProperty("--olive-light", theme.secondary);
  root.style.setProperty("--beige", theme.third);
  root.style.setProperty("--beige-dark", mix(theme.third, "black", 0.08));
}

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    let cancelled = false;

    const load = () => {
      fetch("/api/branding")
        .then(r => r.ok ? r.json() : null)
        .then((b: { theme?: { main: string; secondary: string; third: string } } | null) => {
          if (cancelled) return;
          applyTheme(b?.theme ?? DEFAULTS);
        })
        .catch(() => {});
    };

    load();
    const handler = () => load();
    window.addEventListener("branding-updated", handler);
    return () => {
      cancelled = true;
      window.removeEventListener("branding-updated", handler);
    };
  }, []);

  return <>{children}</>;
}
