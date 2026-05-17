"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

type Branch = { id: string; name: string };

interface BranchContextValue {
  branches: Branch[];
  selectedBranchId: string;
  setSelectedBranchId: (id: string) => void;
}

const BranchContext = createContext<BranchContextValue>({
  branches: [],
  selectedBranchId: "main",
  setSelectedBranchId: () => {},
});

export function BranchProvider({ children }: { children: ReactNode }) {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchIdRaw] = useState<string>("main");
  const [loaded, setLoaded] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("global_selected_branch");
    if (saved) setSelectedBranchIdRaw(saved);
    setLoaded(true);
  }, []);

  // Fetch branches once
  useEffect(() => {
    fetch("/api/branches")
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setBranches(data); })
      .catch(console.error);
  }, []);

  function setSelectedBranchId(id: string) {
    setSelectedBranchIdRaw(id);
    localStorage.setItem("global_selected_branch", id);
  }

  if (!loaded) return null; // avoid hydration mismatch

  return (
    <BranchContext.Provider value={{ branches, selectedBranchId, setSelectedBranchId }}>
      {children}
    </BranchContext.Provider>
  );
}

export function useBranch() {
  return useContext(BranchContext);
}
