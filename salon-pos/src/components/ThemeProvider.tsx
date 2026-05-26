"use client";

import { useEffect } from "react";
import { useBranding } from "@/context/BrandingContext";
import { mix } from "@/lib/branding-shared";

/**
 * Keeps the live CSS variables on `<html>` in sync with the branding context.
 * The *initial* values were already inlined by the server layout (see
 * `themeStyleBody` injected into `<head>`), so this effect only matters when
 * the user edits branding mid-session — the `branding-updated` event flows
 * through BrandingProvider and re-renders us with new theme values.
 */
export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { theme } = useBranding();

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--olive", theme.main);
    root.style.setProperty("--olive-light", theme.secondary);
    root.style.setProperty("--beige", theme.third);
    root.style.setProperty("--beige-dark", mix(theme.third, "black", 0.08));
  }, [theme.main, theme.secondary, theme.third]);

  return <>{children}</>;
}
