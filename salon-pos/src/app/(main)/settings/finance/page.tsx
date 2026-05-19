"use client";

import { useEffect, useState } from "react";
import { DEFAULT_FINANCE, type CommissionMode, type FinanceConfig, type VatMode } from "@/lib/system-config";

const COMMISSION_OPTIONS: { value: CommissionMode; title: string; hint: string }[] = [
  { value: "POOL", title: "ค่าคอมรวม (Pool)", hint: "รวบรวมค่าคอมเป็นกองกลาง แล้วหารตามเปอร์เซ็นต์ของแต่ละบทบาท" },
  { value: "PER_HEAD", title: "ค่าคอมรายหัว", hint: "คำนวณค่าคอมตามจำนวนออร์เดอร์/ลูกค้าของพนักงานแต่ละคน" },
  { value: "NONE", title: "ไม่มีค่าคอม", hint: "พนักงานรับเฉพาะเงินเดือนพื้นฐาน" },
];

const VAT_OPTIONS: { value: VatMode; title: string; hint: string }[] = [
  { value: "EXCLUSIVE", title: "VAT คิดแยก (Exclusive)", hint: "ราคาสินค้ายังไม่รวม VAT — ระบบจะบวก 7% เพิ่มตอนคิดเงิน" },
  { value: "INCLUSIVE", title: "VAT รวมในราคา (Inclusive)", hint: "ราคาสินค้ารวม VAT แล้ว — ระบบจะแยก 7% ออกจากยอดเพื่อแสดงบนใบเสร็จ" },
];

export default function FinanceSettingsPage() {
  const [config, setConfig] = useState<FinanceConfig>(DEFAULT_FINANCE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/system-config")
      .then(r => r.json())
      .then((d: { finance: FinanceConfig }) => {
        if (d.finance) setConfig(d.finance);
      })
      .catch(() => setMsg({ kind: "err", text: "โหลดข้อมูลไม่สำเร็จ" }))
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/system-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ finance: config }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "บันทึกไม่สำเร็จ" }));
        setMsg({ kind: "err", text: data.error ?? "บันทึกไม่สำเร็จ" });
      } else {
        const data: { finance: FinanceConfig } = await res.json();
        if (data.finance) setConfig(data.finance);
        setMsg({ kind: "ok", text: "บันทึกสำเร็จ" });
        window.dispatchEvent(new Event("system-config-updated"));
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div style={{ padding: "1rem" }}>กำลังโหลด…</div>;

  return (
    <div style={{ maxWidth: 720 }}>
      <h1 style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--olive)", margin: 0, marginBottom: "1.25rem" }}>
        💰 การเงิน
      </h1>

      <div className="card" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        {/* Commission mode */}
        <section>
          <h2 style={{ fontSize: "1rem", fontWeight: 600, margin: "0 0 0.5rem" }}>รูปแบบค่าคอมมิชชั่น</h2>
          <p style={{ fontSize: "0.8rem", color: "#888", margin: "0 0 0.75rem" }}>
            ส่งผลต่อหน้า HR &amp; Payroll และการคำนวณเงินเดือน
          </p>
          <div style={{ display: "grid", gap: "0.5rem" }}>
            {COMMISSION_OPTIONS.map(opt => (
              <RadioCard
                key={opt.value}
                checked={config.commissionMode === opt.value}
                title={opt.title}
                hint={opt.hint}
                onChange={() => setConfig(c => ({ ...c, commissionMode: opt.value }))}
              />
            ))}
          </div>
        </section>

        {/* Position allowance */}
        <section>
          <h2 style={{ fontSize: "1rem", fontWeight: 600, margin: "0 0 0.5rem" }}>ค่าตำแหน่ง</h2>
          <p style={{ fontSize: "0.8rem", color: "#888", margin: "0 0 0.75rem" }}>
            เปิดเพื่อรวมค่าตำแหน่งเข้ากับเงินเดือนของพนักงาน (ตามอัตราที่ตั้งไว้ในข้อมูลพนักงาน)
          </p>
          <ToggleSwitch
            checked={config.positionAllowance}
            onChange={v => setConfig(c => ({ ...c, positionAllowance: v }))}
            label={config.positionAllowance ? "เปิดใช้ค่าตำแหน่ง" : "ไม่ใช้ค่าตำแหน่ง"}
          />
        </section>

        {/* VAT mode */}
        <section>
          <h2 style={{ fontSize: "1rem", fontWeight: 600, margin: "0 0 0.5rem" }}>การคิดภาษีมูลค่าเพิ่ม (VAT 7%)</h2>
          <p style={{ fontSize: "0.8rem", color: "#888", margin: "0 0 0.75rem" }}>
            กำหนดว่าราคาในระบบคิด VAT แล้วหรือยัง — มีผลกับใบเสร็จและการคำนวณยอดสุทธิ
          </p>
          <div style={{ display: "grid", gap: "0.5rem" }}>
            {VAT_OPTIONS.map(opt => (
              <RadioCard
                key={opt.value}
                checked={config.vatMode === opt.value}
                title={opt.title}
                hint={opt.hint}
                onChange={() => setConfig(c => ({ ...c, vatMode: opt.value }))}
              />
            ))}
          </div>
        </section>

        {msg && (
          <div style={{
            padding: "0.5rem 0.75rem", borderRadius: 8, fontSize: "0.85rem",
            background: msg.kind === "ok" ? "#D4EDDA" : "#F8D7DA",
            color: msg.kind === "ok" ? "#155724" : "#721c24",
          }}>{msg.text}</div>
        )}

        <div>
          <button className="btn-primary" onClick={save} disabled={saving}>
            {saving ? "กำลังบันทึก…" : "บันทึก"}
          </button>
        </div>
      </div>
    </div>
  );
}

function RadioCard({ checked, title, hint, onChange }: { checked: boolean; title: string; hint: string; onChange: () => void }) {
  return (
    <label style={{
      display: "flex", alignItems: "flex-start", gap: "0.75rem",
      padding: "0.75rem 1rem",
      border: `2px solid ${checked ? "var(--olive)" : "var(--beige-dark)"}`,
      borderRadius: 12, cursor: "pointer",
      background: checked ? "rgba(107,124,69,0.06)" : "white",
      transition: "border-color 0.15s, background 0.15s",
    }}>
      <input type="radio" checked={checked} onChange={onChange} style={{ marginTop: 3, accentColor: "var(--olive)" }} />
      <div>
        <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>{title}</div>
        <div style={{ fontSize: "0.75rem", color: "#888", marginTop: 2 }}>{hint}</div>
      </div>
    </label>
  );
}

function ToggleSwitch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label style={{ display: "inline-flex", alignItems: "center", gap: "0.75rem", cursor: "pointer" }}>
      <span style={{
        position: "relative", width: 44, height: 24, borderRadius: 999,
        background: checked ? "var(--olive)" : "#ccc", transition: "background 0.15s",
      }}>
        <span style={{
          position: "absolute", top: 2, left: checked ? 22 : 2,
          width: 20, height: 20, borderRadius: "50%", background: "white",
          transition: "left 0.15s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
        }} />
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        style={{ display: "none" }}
      />
      <span style={{ fontSize: "0.9rem" }}>{label}</span>
    </label>
  );
}
