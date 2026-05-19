"use client";

import { useEffect, useRef, useState } from "react";

type Branding = { shopName: string; logoDataUrl: string | null };

const MAX_RAW_BYTES = 600_000;

export default function BrandingSettingsPage() {
  const [shopName, setShopName] = useState("");
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/branding")
      .then(r => r.json())
      .then((b: Branding) => {
        setShopName(b.shopName);
        setLogoDataUrl(b.logoDataUrl);
      })
      .catch(() => setMsg({ kind: "err", text: "โหลดข้อมูลไม่สำเร็จ" }))
      .finally(() => setLoading(false));
  }, []);

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setMsg({ kind: "err", text: "ไฟล์ต้องเป็นรูปภาพ" });
      return;
    }
    if (file.size > MAX_RAW_BYTES) {
      setMsg({ kind: "err", text: `ไฟล์ใหญ่เกินไป (จำกัด ${Math.round(MAX_RAW_BYTES/1024)} KB)` });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setLogoDataUrl(typeof reader.result === "string" ? reader.result : null);
      setMsg(null);
    };
    reader.onerror = () => setMsg({ kind: "err", text: "อ่านไฟล์ไม่สำเร็จ" });
    reader.readAsDataURL(file);
  }

  function removeLogo() {
    setLogoDataUrl(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function save() {
    if (!shopName.trim()) {
      setMsg({ kind: "err", text: "กรุณากรอกชื่อร้าน" });
      return;
    }
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/branding", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shopName: shopName.trim(), logoDataUrl }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "บันทึกไม่สำเร็จ" }));
        setMsg({ kind: "err", text: data.error ?? "บันทึกไม่สำเร็จ" });
      } else {
        const data: Branding = await res.json();
        setShopName(data.shopName);
        setLogoDataUrl(data.logoDataUrl);
        setMsg({ kind: "ok", text: "บันทึกสำเร็จ — ใบเสร็จและ Sidebar จะใช้ข้อมูลใหม่ทันที" });
        window.dispatchEvent(new Event("branding-updated"));
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div style={{ padding: "1rem" }}>กำลังโหลด…</div>;

  return (
    <div style={{ maxWidth: 640 }}>
      <h1 style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--olive)", margin: 0, marginBottom: "1.25rem" }}>
        🏷️ แบรนด์ร้าน
      </h1>

      <div className="card" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <div>
          <label className="label">ชื่อร้าน</label>
          <input
            className="input"
            value={shopName}
            onChange={e => setShopName(e.target.value)}
            placeholder="เช่น บริษัท ลานนาดีเซีย กรุ๊ป จำกัด"
          />
          <div style={{ fontSize: "0.75rem", color: "#888", marginTop: 4 }}>
            ชื่อนี้จะปรากฏใน Sidebar และที่หัวใบเสร็จทั้งแบบย่อและแบบเต็ม
          </div>
        </div>

        <div>
          <label className="label">โลโก้ร้าน</label>
          <div style={{
            display: "flex", alignItems: "center", gap: "1rem",
            padding: "1rem", border: "1px dashed var(--beige-dark)", borderRadius: 12, background: "#fafafa",
          }}>
            <div style={{
              width: 96, height: 96, borderRadius: 12, background: "white",
              border: "1px solid var(--beige-dark)",
              display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden",
            }}>
              {logoDataUrl
                ? <img src={logoDataUrl} alt="logo" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
                : <span style={{ fontSize: 32, color: "#bbb" }}>✂️</span>}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/svg+xml,image/webp"
                onChange={onPickFile}
                style={{ fontSize: "0.85rem" }}
              />
              {logoDataUrl && (
                <button type="button" className="btn-secondary" onClick={removeLogo} style={{ fontSize: "0.8rem", padding: "4px 12px", alignSelf: "flex-start" }}>
                  ลบโลโก้
                </button>
              )}
              <div style={{ fontSize: "0.7rem", color: "#888" }}>
                แนะนำ PNG / SVG สี่เหลี่ยมจัตุรัส ขนาดไม่เกิน {Math.round(MAX_RAW_BYTES/1024)} KB
              </div>
            </div>
          </div>
        </div>

        {msg && (
          <div style={{
            padding: "0.5rem 0.75rem", borderRadius: 8, fontSize: "0.85rem",
            background: msg.kind === "ok" ? "#D4EDDA" : "#F8D7DA",
            color: msg.kind === "ok" ? "#155724" : "#721c24",
          }}>
            {msg.text}
          </div>
        )}

        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button className="btn-primary" onClick={save} disabled={saving}>
            {saving ? "กำลังบันทึก…" : "บันทึก"}
          </button>
        </div>
      </div>
    </div>
  );
}
