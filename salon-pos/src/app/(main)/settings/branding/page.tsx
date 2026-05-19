"use client";

import { useEffect, useRef, useState } from "react";

type Theme = { main: string; secondary: string; third: string };
type Branding = { shopName: string; logoDataUrl: string | null; address: string; taxId: string; theme: Theme };

const DEFAULT_THEME: Theme = { main: "#6B7C45", secondary: "#8FA65A", third: "#F5F0E8" };

// Anything bigger than this gets canvas-resized client-side. Final upload cap is enforced server-side.
const COMPRESS_THRESHOLD_BYTES = 1_000_000;
const MAX_DIMENSION = 512;
const MAX_UPLOAD_BYTES = 1_500_000;

async function readFileAsDataUrl(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

// Resize large logos in-browser before upload so the user doesn't have to. We
// preserve aspect ratio, cap the longest edge at MAX_DIMENSION, and fall back
// to JPEG at decreasing quality if PNG is still too big. SVGs are passed through.
async function compressImage(file: File): Promise<string> {
  if (file.type === "image/svg+xml") return readFileAsDataUrl(file);

  const dataUrl = await readFileAsDataUrl(file);
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("โหลดรูปไม่สำเร็จ"));
    el.src = dataUrl;
  });

  const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas ไม่พร้อมใช้งาน");
  ctx.drawImage(img, 0, 0, w, h);

  // Try PNG first (lossless, good for logos with transparency); fall back to JPEG with decreasing quality.
  let out = canvas.toDataURL("image/png");
  if (out.length <= MAX_UPLOAD_BYTES) return out;
  for (const q of [0.9, 0.8, 0.7, 0.6, 0.5]) {
    out = canvas.toDataURL("image/jpeg", q);
    if (out.length <= MAX_UPLOAD_BYTES) return out;
  }
  return out;
}

export default function BrandingSettingsPage() {
  const [shopName, setShopName] = useState("");
  const [address, setAddress] = useState("");
  const [taxId, setTaxId] = useState("");
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  const [theme, setTheme] = useState<Theme>(DEFAULT_THEME);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/branding")
      .then(r => r.json())
      .then((b: Branding) => {
        setShopName(b.shopName);
        setAddress(b.address);
        setTaxId(b.taxId);
        setLogoDataUrl(b.logoDataUrl);
        if (b.theme) setTheme(b.theme);
      })
      .catch(() => setMsg({ kind: "err", text: "โหลดข้อมูลไม่สำเร็จ" }))
      .finally(() => setLoading(false));
  }, []);

  function pickFile() {
    fileRef.current?.click();
  }

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-uploading the same file
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setMsg({ kind: "err", text: "ไฟล์ต้องเป็นรูปภาพ" });
      return;
    }
    setProcessing(true);
    setMsg(null);
    try {
      let dataUrl: string;
      if (file.size > COMPRESS_THRESHOLD_BYTES) {
        dataUrl = await compressImage(file);
        setMsg({ kind: "ok", text: `ย่อขนาดรูปแล้ว (${(file.size / 1024 / 1024).toFixed(1)}MB → ${(dataUrl.length / 1024).toFixed(0)}KB)` });
      } else {
        dataUrl = await readFileAsDataUrl(file);
      }
      if (dataUrl.length > MAX_UPLOAD_BYTES) {
        setMsg({ kind: "err", text: "ไฟล์ยังใหญ่เกินไปหลังย่อ — กรุณาใช้รูปอื่น" });
        return;
      }
      setLogoDataUrl(dataUrl);
    } catch (err) {
      setMsg({ kind: "err", text: err instanceof Error ? err.message : "อ่านไฟล์ไม่สำเร็จ" });
    } finally {
      setProcessing(false);
    }
  }

  function removeLogo() {
    setLogoDataUrl(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  function resetTheme() {
    setTheme(DEFAULT_THEME);
  }

  async function save() {
    if (!shopName.trim()) { setMsg({ kind: "err", text: "กรุณากรอกชื่อร้าน" }); return; }
    if (!address.trim()) { setMsg({ kind: "err", text: "กรุณากรอกที่อยู่" }); return; }
    const trimmedTaxId = taxId.trim();
    if (!trimmedTaxId) { setMsg({ kind: "err", text: "กรุณากรอกเลขผู้เสียภาษี" }); return; }
    if (!/^\d{13}$/.test(trimmedTaxId)) {
      setMsg({ kind: "err", text: "เลขผู้เสียภาษีต้องเป็นตัวเลข 13 หลัก" });
      return;
    }
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/branding", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shopName: shopName.trim(),
          address: address.trim(),
          taxId: trimmedTaxId,
          logoDataUrl,
          theme,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "บันทึกไม่สำเร็จ" }));
        setMsg({ kind: "err", text: data.error ?? "บันทึกไม่สำเร็จ" });
      } else {
        const data: Branding = await res.json();
        setShopName(data.shopName);
        setAddress(data.address);
        setTaxId(data.taxId);
        setLogoDataUrl(data.logoDataUrl);
        if (data.theme) setTheme(data.theme);
        setMsg({ kind: "ok", text: "บันทึกสำเร็จ — ใบเสร็จ, Sidebar และธีมจะอัพเดตทันที" });
        window.dispatchEvent(new Event("branding-updated"));
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div style={{ padding: "1rem" }}>กำลังโหลด…</div>;

  return (
    <div style={{ maxWidth: 720 }}>
      <h1 style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--olive)", margin: 0, marginBottom: "1.25rem" }}>
        🏷️ แบรนด์ร้าน
      </h1>

      <div className="card" style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        {/* Shop name */}
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

        {/* Address */}
        <div>
          <label className="label">ที่อยู่ร้าน</label>
          <textarea
            className="input"
            value={address}
            onChange={e => setAddress(e.target.value)}
            placeholder="เลขที่ ถนน ตำบล อำเภอ จังหวัด รหัสไปรษณีย์"
            style={{ minHeight: 70, resize: "vertical" }}
          />
          <div style={{ fontSize: "0.75rem", color: "#888", marginTop: 4 }}>
            ที่อยู่นี้จะปรากฏที่หัวใบเสร็จและในช่อง “ผู้ขาย” ของใบกำกับภาษีเต็ม
          </div>
        </div>

        {/* Tax ID */}
        <div>
          <label className="label">เลขประจำตัวผู้เสียภาษี</label>
          <input
            className="input"
            value={taxId}
            onChange={e => setTaxId(e.target.value.replace(/\D/g, "").slice(0, 13))}
            placeholder="0000000000000"
            inputMode="numeric"
            maxLength={13}
            style={{ fontFamily: "monospace", letterSpacing: 1 }}
          />
          <div style={{ fontSize: "0.75rem", color: "#888", marginTop: 4 }}>
            ตัวเลข 13 หลัก — จะปรากฏที่หัวใบเสร็จทั้งสองแบบ
          </div>
        </div>

        {/* Logo upload */}
        <div>
          <label className="label">โลโก้ร้าน</label>
          <div style={{
            display: "flex", alignItems: "center", gap: "1rem",
            padding: "1rem", border: "1px dashed var(--beige-dark)", borderRadius: 12, background: "#fafafa",
          }}>
            <div style={{
              width: 96, height: 96, borderRadius: 12, background: "white",
              border: "1px solid var(--beige-dark)", flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden",
            }}>
              {logoDataUrl
                ? <img src={logoDataUrl} alt="logo" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
                : <span style={{ fontSize: 32, color: "#bbb" }}>✂️</span>}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/svg+xml,image/webp"
                onChange={onPickFile}
                style={{ display: "none" }}
              />
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button type="button" className="btn-primary" onClick={pickFile} disabled={processing} style={{ fontSize: "0.85rem" }}>
                  {processing ? "กำลังประมวลผล…" : (logoDataUrl ? "📁 เปลี่ยนรูป" : "📁 อัพโหลดโลโก้")}
                </button>
                {logoDataUrl && (
                  <button type="button" className="btn-secondary" onClick={removeLogo} style={{ fontSize: "0.85rem" }}>
                    ลบโลโก้
                  </button>
                )}
              </div>
              <div style={{ fontSize: "0.7rem", color: "#888" }}>
                รองรับ PNG / JPG / SVG / WebP — รูปที่ใหญ่กว่า 1MB ระบบจะย่อขนาดให้อัตโนมัติ
              </div>
            </div>
          </div>
        </div>

        {/* Theme colors */}
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <label className="label" style={{ marginBottom: 0 }}>ธีมสีของระบบ</label>
            <button type="button" className="btn-secondary" onClick={resetTheme} style={{ fontSize: "0.75rem", padding: "2px 10px" }}>
              คืนค่าเริ่มต้น
            </button>
          </div>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "0.75rem",
            padding: "1rem",
            border: "1px dashed var(--beige-dark)",
            borderRadius: 12,
            background: "#fafafa",
          }}>
            <ColorField
              label="Main (สีหลัก)"
              hint="Sidebar / ปุ่มหลัก / หัวเรื่อง"
              value={theme.main}
              onChange={v => setTheme(t => ({ ...t, main: v }))}
            />
            <ColorField
              label="Secondary (สีรอง)"
              hint="Hover / Accent"
              value={theme.secondary}
              onChange={v => setTheme(t => ({ ...t, secondary: v }))}
            />
            <ColorField
              label="Third (พื้นหลัง)"
              hint="พื้นหลังหน้าจอ"
              value={theme.third}
              onChange={v => setTheme(t => ({ ...t, third: v }))}
            />
          </div>
          <ThemePreview theme={theme} />
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
          <button className="btn-primary" onClick={save} disabled={saving || processing}>
            {saving ? "กำลังบันทึก…" : "บันทึก"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ColorField({ label, hint, value, onChange }: { label: string; hint: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <div style={{ fontSize: "0.8rem", fontWeight: 600, marginBottom: 4 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <input
          type="color"
          value={value}
          onChange={e => onChange(e.target.value)}
          style={{ width: 44, height: 36, border: "1px solid var(--beige-dark)", borderRadius: 6, background: "white", cursor: "pointer", padding: 2 }}
        />
        <input
          type="text"
          className="input"
          value={value}
          onChange={e => {
            const v = e.target.value;
            if (/^#[0-9a-fA-F]{0,6}$/.test(v) || v === "") onChange(v);
          }}
          style={{ fontFamily: "monospace", fontSize: "0.85rem" }}
          placeholder="#RRGGBB"
        />
      </div>
      <div style={{ fontSize: "0.7rem", color: "#888", marginTop: 2 }}>{hint}</div>
    </div>
  );
}

function ThemePreview({ theme }: { theme: Theme }) {
  return (
    <div style={{
      marginTop: "0.75rem",
      borderRadius: 12,
      overflow: "hidden",
      border: "1px solid var(--beige-dark)",
      display: "grid",
      gridTemplateColumns: "120px 1fr",
      minHeight: 120,
    }}>
      <div style={{ background: theme.main, padding: "0.75rem", color: "white", fontSize: "0.8rem", fontWeight: 600 }}>
        Sidebar
        <div style={{ marginTop: 8, padding: "4px 8px", background: theme.secondary, borderRadius: 6, fontSize: "0.7rem" }}>เมนูที่เลือก</div>
      </div>
      <div style={{ background: theme.third, padding: "0.75rem", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
        <button type="button" style={{ background: theme.main, color: "white", border: "none", borderRadius: 8, padding: "6px 14px", fontSize: "0.8rem" }}>ปุ่มหลัก</button>
        <button type="button" style={{ background: theme.secondary, color: "white", border: "none", borderRadius: 8, padding: "6px 14px", fontSize: "0.8rem" }}>ปุ่มรอง</button>
      </div>
    </div>
  );
}
