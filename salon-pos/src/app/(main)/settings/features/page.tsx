"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_SIDEBAR_CONFIG,
  MODULE_ICONS,
  MODULE_LABELS,
  NON_HIDEABLE_MODULES,
  mergeSidebarConfig,
  type SidebarModuleConfig,
} from "@/lib/system-config";

export default function FeaturesSettingsPage() {
  const [items, setItems] = useState<SidebarModuleConfig[]>(DEFAULT_SIDEBAR_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/system-config")
      .then(r => r.json())
      .then((d: { sidebar: SidebarModuleConfig[] }) => {
        if (d.sidebar) setItems(mergeSidebarConfig(d.sidebar));
      })
      .catch(() => setMsg({ kind: "err", text: "โหลดข้อมูลไม่สำเร็จ" }))
      .finally(() => setLoading(false));
  }, []);

  function move(idx: number, dir: -1 | 1) {
    const next = idx + dir;
    if (next < 0 || next >= items.length) return;
    setItems(prev => {
      const copy = [...prev];
      [copy[idx], copy[next]] = [copy[next], copy[idx]];
      return copy;
    });
  }

  function toggle(idx: number) {
    setItems(prev => prev.map((m, i) =>
      i === idx && !NON_HIDEABLE_MODULES.has(m.key) ? { ...m, enabled: !m.enabled } : m
    ));
  }

  function reset() {
    setItems(DEFAULT_SIDEBAR_CONFIG);
  }

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/system-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sidebar: items }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "บันทึกไม่สำเร็จ" }));
        setMsg({ kind: "err", text: data.error ?? "บันทึกไม่สำเร็จ" });
      } else {
        const data: { sidebar: SidebarModuleConfig[] } = await res.json();
        if (data.sidebar) setItems(mergeSidebarConfig(data.sidebar));
        setMsg({ kind: "ok", text: "บันทึกสำเร็จ — Sidebar อัพเดตทันที" });
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
        🧩 ฟีเจอร์ &amp; การจัดวาง Sidebar
      </h1>

      <div className="card" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
            <div>
              <h2 style={{ fontSize: "1rem", fontWeight: 600, margin: 0 }}>โมดูลที่จะแสดงใน Sidebar</h2>
              <p style={{ fontSize: "0.8rem", color: "#888", margin: "2px 0 0" }}>
                ปิด/เปิดโมดูล และจัดลำดับด้วยปุ่ม ↑ ↓ — “ตั้งค่า” ปิดไม่ได้
              </p>
            </div>
            <button type="button" className="btn-secondary" onClick={reset} style={{ fontSize: "0.75rem", padding: "4px 12px" }}>
              คืนค่าเริ่มต้น
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
            {items.map((item, idx) => {
              const locked = NON_HIDEABLE_MODULES.has(item.key);
              return (
                <div key={item.key} style={{
                  display: "flex", alignItems: "center", gap: "0.75rem",
                  padding: "0.6rem 0.75rem",
                  border: "1px solid var(--beige-dark)", borderRadius: 10,
                  background: item.enabled ? "white" : "#f8f8f8",
                  opacity: item.enabled ? 1 : 0.65,
                }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <button
                      type="button" onClick={() => move(idx, -1)} disabled={idx === 0}
                      style={arrowBtnStyle(idx === 0)}
                      aria-label="ขึ้น"
                    >↑</button>
                    <button
                      type="button" onClick={() => move(idx, 1)} disabled={idx === items.length - 1}
                      style={arrowBtnStyle(idx === items.length - 1)}
                      aria-label="ลง"
                    >↓</button>
                  </div>
                  <span style={{ fontSize: "1.2rem", width: 26, textAlign: "center" }}>{MODULE_ICONS[item.key]}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>{MODULE_LABELS[item.key]}</div>
                    {locked && (
                      <div style={{ fontSize: "0.7rem", color: "#999" }}>โมดูลพื้นฐาน — ปิดไม่ได้</div>
                    )}
                  </div>
                  <Toggle disabled={locked} checked={item.enabled} onChange={() => toggle(idx)} />
                </div>
              );
            })}
          </div>
        </div>

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

function arrowBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    width: 26, height: 22, borderRadius: 4,
    border: "1px solid var(--beige-dark)",
    background: disabled ? "#f0f0f0" : "white",
    color: disabled ? "#bbb" : "#333",
    cursor: disabled ? "not-allowed" : "pointer",
    fontSize: "0.75rem", lineHeight: "20px",
    padding: 0,
  };
}

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <label style={{ cursor: disabled ? "not-allowed" : "pointer", display: "inline-flex", alignItems: "center" }}>
      <input
        type="checkbox" checked={checked} disabled={disabled}
        onChange={() => !disabled && onChange()}
        style={{ display: "none" }}
      />
      <span style={{
        position: "relative", width: 40, height: 22, borderRadius: 999,
        background: checked ? "var(--olive)" : "#ccc",
        opacity: disabled ? 0.5 : 1,
        transition: "background 0.15s",
      }}>
        <span style={{
          position: "absolute", top: 2, left: checked ? 20 : 2,
          width: 18, height: 18, borderRadius: "50%", background: "white",
          transition: "left 0.15s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
        }} />
      </span>
    </label>
  );
}
