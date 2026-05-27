"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useBranch } from "@/context/BranchContext";

type Branch = { id: string; name: string };

export default function BranchSelector({ branches, currentBranchId }: { branches: Branch[], currentBranchId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { selectedBranchId, setSelectedBranchId } = useBranch();

  // If the global context disagrees with the URL (e.g. user switched branch on
  // a POS page and just landed here), align the URL to the context so the
  // server-rendered page re-fetches for the right branch.
  useEffect(() => {
    if (selectedBranchId === currentBranchId) return;
    const params = new URLSearchParams(searchParams.toString());
    if (selectedBranchId === "all") params.delete("branchId");
    else params.set("branchId", selectedBranchId);
    router.replace(`?${params.toString()}`);
  }, [selectedBranchId, currentBranchId, router, searchParams]);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
      <label style={{ fontSize: "0.85rem", color: "#666" }}>สาขา:</label>
      <select
        className="input"
        style={{ width: 160, marginBottom: 0, padding: "4px 8px" }}
        value={currentBranchId}
        onChange={(e) => {
          const val = e.target.value;
          setSelectedBranchId(val);
          const params = new URLSearchParams(searchParams.toString());
          if (val === "all") params.delete("branchId");
          else params.set("branchId", val);
          router.push(`?${params.toString()}`);
        }}
      >
        <option value="all">ทุกสาขา</option>
        {branches.map(b => (
          <option key={b.id} value={b.id}>{b.name}</option>
        ))}
      </select>
    </div>
  );
}
