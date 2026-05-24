"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import { BranchProvider } from "@/context/BranchContext";
import { OwnerLockProvider, useOwnerLock, OWNER_LOCKED_ROUTES } from "@/context/OwnerLockContext";

function RouteGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isUnlocked } = useOwnerLock();

  const isRestricted = OWNER_LOCKED_ROUTES.some(prefix => pathname.startsWith(prefix));

  useEffect(() => {
    if (isRestricted && !isUnlocked) {
      router.replace("/pos/new");
    }
  }, [isRestricted, isUnlocked, router, pathname]);

  // While redirecting, show nothing for restricted pages
  if (isRestricted && !isUnlocked) {
    return (
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        color: "#999",
        fontSize: "0.9rem",
      }}>
        🔒 กรุณาปลดล็อค Owner PIN จาก Sidebar เพื่อเข้าถึงหน้านี้
      </div>
    );
  }

  return <>{children}</>;
}

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <BranchProvider>
      <OwnerLockProvider>
        <div style={{ display: "flex", minHeight: "100vh" }}>
          <Sidebar />
          <main style={{ flex: 1, padding: "1.5rem", overflowY: "auto", background: "var(--beige)" }}>
            <RouteGuard>{children}</RouteGuard>
          </main>
        </div>
      </OwnerLockProvider>
    </BranchProvider>
  );
}
