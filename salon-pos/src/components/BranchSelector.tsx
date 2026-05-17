"use client";

import { useRouter, useSearchParams } from "next/navigation";

type Branch = { id: string; name: string };

export default function BranchSelector({ branches, currentBranchId }: { branches: Branch[], currentBranchId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
      <label style={{ fontSize: "0.85rem", color: "#666" }}>สาขา:</label>
      <select 
        className="input" 
        style={{ width: 160, marginBottom: 0, padding: "4px 8px" }}
        value={currentBranchId}
        onChange={(e) => {
          const params = new URLSearchParams(searchParams.toString());
          if (e.target.value === "all") params.delete("branchId");
          else params.set("branchId", e.target.value);
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
