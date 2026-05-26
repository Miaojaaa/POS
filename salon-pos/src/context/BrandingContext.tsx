"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { Branding } from "@/lib/branding-shared";

const BrandingCtx = createContext<Branding | null>(null);

/**
 * Holds the initial branding rendered by the server, then keeps itself in
 * sync with `branding-updated` events fired from the Branding settings page.
 * Consumers (Sidebar, ThemeProvider, etc.) read from this so they don't have
 * to do their own initial fetch — that fetch is what caused the FOUC.
 */
export function BrandingProvider({
  initial,
  children,
}: {
  initial: Branding;
  children: React.ReactNode;
}) {
  const [branding, setBranding] = useState<Branding>(initial);

  useEffect(() => {
    const refresh = () => {
      fetch("/api/branding")
        .then(r => (r.ok ? r.json() : null))
        .then((b: Branding | null) => { if (b) setBranding(b); })
        .catch(() => {});
    };
    window.addEventListener("branding-updated", refresh);
    return () => window.removeEventListener("branding-updated", refresh);
  }, []);

  return <BrandingCtx.Provider value={branding}>{children}</BrandingCtx.Provider>;
}

export function useBranding(): Branding {
  const v = useContext(BrandingCtx);
  if (!v) throw new Error("useBranding must be used inside <BrandingProvider>");
  return v;
}
