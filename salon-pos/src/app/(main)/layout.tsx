import Sidebar from "@/components/Sidebar";
import { BranchProvider } from "@/context/BranchContext";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <BranchProvider>
      <div style={{ display: "flex", minHeight: "100vh" }}>
        <Sidebar />
        <main style={{ flex: 1, padding: "1.5rem", overflowY: "auto", background: "var(--beige)" }}>
          {children}
        </main>
      </div>
    </BranchProvider>
  );
}
