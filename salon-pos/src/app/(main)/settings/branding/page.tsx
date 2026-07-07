"use client";

import { useEffect, useRef, useState } from "react";
import {
  normalizeFooterBlocks,
  type FooterBlock,
  type FooterBlockAlign,
  type FooterTextSize,
} from "@/lib/system-config";
import { Store } from "lucide-react";

type Theme = { main: string; secondary: string; third: string };
type Branding = {
  shopName: string;
  logoDataUrl: string | null;
  address: string;
  taxId: string;
  promptpayId: string | null;
  theme: Theme;
  footerBlocks: FooterBlock[];
};

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

// Read a picked image to a data URL, compressing if it is over the threshold, and
// enforcing the upload cap. Throws on a file that is still too big after resizing.
// Shared by the logo picker and the receipt footer builder. `note` is a human-readable
// resize summary the caller can surface as a success toast.
async function prepareImageDataUrl(file: File): Promise<{ dataUrl: string; note?: string }> {
  let dataUrl: string;
  let note: string | undefined;
  if (file.size > COMPRESS_THRESHOLD_BYTES) {
    dataUrl = await compressImage(file);
    note = `ย่อขนาดรูปแล้ว (${(file.size / 1024 / 1024).toFixed(1)}MB → ${(dataUrl.length / 1024).toFixed(0)}KB)`;
  } else {
    dataUrl = await readFileAsDataUrl(file);
  }
  if (dataUrl.length > MAX_UPLOAD_BYTES) {
    throw new Error("ไฟล์ยังใหญ่เกินไปหลังย่อ — กรุณาใช้รูปอื่น");
  }
  return { dataUrl, note };
}

export default function BrandingSettingsPage() {
  const [shopName, setShopName] = useState("");
  const [address, setAddress] = useState("");
  const [taxId, setTaxId] = useState("");
  const [promptpayId, setPromptpayId] = useState("");
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  const [theme, setTheme] = useState<Theme>(DEFAULT_THEME);
  const [footerBlocks, setFooterBlocks] = useState<FooterBlock[]>([]);
  const [initial, setInitial] = useState<string>("");
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
        const pp = b.promptpayId ?? "";
        setPromptpayId(pp);
        setLogoDataUrl(b.logoDataUrl);
        const t = b.theme ?? DEFAULT_THEME;
        setTheme(t);
        const blocks = normalizeFooterBlocks(b.footerBlocks ?? []);
        setFooterBlocks(blocks);
        setInitial(JSON.stringify({ shopName: b.shopName, address: b.address, taxId: b.taxId, promptpayId: pp, logoDataUrl: b.logoDataUrl, theme: t, footerBlocks: blocks }));
      })
      .catch(() => setMsg({ kind: "err", text: "โหลดข้อมูลไม่สำเร็จ" }))
      .finally(() => setLoading(false));
  }, []);

  const dirty = initial !== "" && JSON.stringify({ shopName, address, taxId, promptpayId, logoDataUrl, theme, footerBlocks }) !== initial;

  function pickFile() {
    fileRef.current?.click();
  }

  // Logo picker — validates, compresses oversized files client-side, stores the data URL.
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
      const { dataUrl, note } = await prepareImageDataUrl(file);
      setLogoDataUrl(dataUrl);
      if (note) setMsg({ kind: "ok", text: note });
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
          promptpayId: promptpayId.trim(),
          logoDataUrl,
          theme,
          footerBlocks,
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
        const newPp = data.promptpayId ?? "";
        setPromptpayId(newPp);
        setLogoDataUrl(data.logoDataUrl);
        const newTheme = data.theme ?? theme;
        setTheme(newTheme);
        const newBlocks = normalizeFooterBlocks(data.footerBlocks ?? footerBlocks);
        setFooterBlocks(newBlocks);
        setInitial(JSON.stringify({ shopName: data.shopName, address: data.address, taxId: data.taxId, promptpayId: newPp, logoDataUrl: data.logoDataUrl, theme: newTheme, footerBlocks: newBlocks }));
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
      <h1 style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "1.4rem", fontWeight: 700, color: "var(--olive)", margin: 0, marginBottom: "1.25rem" }}>
        <Store size={24} /> ข้อมูลร้าน
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

        {/* PromptPay ID — drives the dynamic payment QR on the customer display */}
        <div>
          <label className="label">PromptPay ID (สำหรับ QR จ่ายเงินบนจอลูกค้า)</label>
          <input
            className="input"
            value={promptpayId}
            onChange={e => setPromptpayId(e.target.value.replace(/[^\d]/g, "").slice(0, 15))}
            placeholder="เบอร์พร้อมเพย์ เช่น 0812345678"
            inputMode="numeric"
            style={{ fontFamily: "monospace", letterSpacing: 1 }}
          />
          <div style={{ fontSize: "0.75rem", color: "#888", marginTop: 4 }}>
            เบอร์โทร 10 หลัก, เลขบัตรประชาชน/ผู้เสียภาษี 13 หลัก หรือ e-Wallet 15 หลัก — ระบบจะสร้าง QR พร้อมยอดเงินให้ลูกค้าสแกนบนจอที่ 2 อัตโนมัติ (เว้นว่างได้ถ้าไม่ใช้)
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

        {/* Receipt footer builder */}
        <div>
          <label className="label">ท้ายใบเสร็จ (Custom)</label>
          <div style={{ fontSize: "0.75rem", color: "#888", marginBottom: 8 }}>
            จัดบล็อกข้อความ / รูป (เช่น QR LINE) / เส้นคั่น เรียงจากบนลงล่าง — แต่ละบล็อกเลือกได้ว่าจะแสดงในสลิปและ/หรือใบเต็ม A4
          </div>
          <FooterBuilder blocks={footerBlocks} onChange={setFooterBlocks} setMsg={setMsg} busy={processing} setBusy={setProcessing} />
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
          <button className="btn-primary" onClick={save} disabled={saving || processing || !dirty}>
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

/* ─────────────────────────── receipt footer builder ─────── */

const ALIGN_OPTS: { v: FooterBlockAlign; label: string }[] = [
  { v: "left", label: "ซ้าย" },
  { v: "center", label: "กลาง" },
  { v: "right", label: "ขวา" },
];
const SIZE_OPTS: { v: FooterTextSize; label: string }[] = [
  { v: "sm", label: "เล็ก" },
  { v: "md", label: "กลาง" },
  { v: "lg", label: "ใหญ่" },
];
const SIZE_PX: Record<FooterTextSize, number> = { sm: 11, md: 13, lg: 16 };
const MAX_BLOCKS = 20;

type Msg = { kind: "ok" | "err"; text: string } | null;

function FooterBuilder({ blocks, onChange, setMsg, busy, setBusy }: {
  blocks: FooterBlock[];
  onChange: (b: FooterBlock[]) => void;
  setMsg: (m: Msg) => void;
  busy: boolean;
  setBusy: (v: boolean) => void;
}) {
  const imgInputRef = useRef<HTMLInputElement>(null);
  // null ⇒ the picked image is appended as a new block; a number ⇒ replace that block's image.
  const targetIndexRef = useRef<number | null>(null);
  const [preview, setPreview] = useState<"SHORT" | "FULL">("SHORT");

  const atLimit = blocks.length >= MAX_BLOCKS;

  function setBlock(index: number, next: FooterBlock) {
    onChange(blocks.map((b, i) => (i === index ? next : b)));
  }
  function removeBlock(index: number) {
    onChange(blocks.filter((_, i) => i !== index));
  }
  function moveBlock(index: number, dir: -1 | 1) {
    const j = index + dir;
    if (j < 0 || j >= blocks.length) return;
    const next = [...blocks];
    [next[index], next[j]] = [next[j], next[index]];
    onChange(next);
  }
  function addBlock(b: FooterBlock) {
    if (atLimit) { setMsg({ kind: "err", text: `เพิ่มได้สูงสุด ${MAX_BLOCKS} บล็อก` }); return; }
    onChange([...blocks, b]);
  }
  function openImagePicker(index: number | null) {
    if (index === null && atLimit) { setMsg({ kind: "err", text: `เพิ่มได้สูงสุด ${MAX_BLOCKS} บล็อก` }); return; }
    targetIndexRef.current = index;
    imgInputRef.current?.click();
  }

  async function onImageFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    const idx = targetIndexRef.current;
    targetIndexRef.current = null;
    if (!file) return;
    if (!file.type.startsWith("image/")) { setMsg({ kind: "err", text: "ไฟล์ต้องเป็นรูปภาพ" }); return; }
    setBusy(true);
    setMsg(null);
    try {
      const { dataUrl, note } = await prepareImageDataUrl(file);
      if (idx === null) {
        onChange([...blocks, { type: "image", dataUrl, align: "center", widthPct: 60, showShort: true, showFull: true }]);
      } else {
        onChange(blocks.map((b, i) => (i === idx && b.type === "image" ? { ...b, dataUrl } : b)));
      }
      if (note) setMsg({ kind: "ok", text: note });
    } catch (err) {
      setMsg({ kind: "err", text: err instanceof Error ? err.message : "อ่านไฟล์ไม่สำเร็จ" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ border: "1px dashed var(--beige-dark)", borderRadius: 12, background: "#fafafa", padding: "1rem", display: "flex", flexDirection: "column", gap: 12 }}>
      <input ref={imgInputRef} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" onChange={onImageFile} style={{ display: "none" }} />

      {blocks.length === 0 && (
        <div style={{ textAlign: "center", color: "#aaa", fontSize: "0.85rem", padding: "0.5rem 0" }}>
          ยังไม่มีบล็อก — เพิ่มข้อความ / รูป / เส้นคั่น ด้านล่าง
        </div>
      )}

      {blocks.map((block, i) => (
        <FooterBlockCard
          key={i}
          block={block}
          index={i}
          total={blocks.length}
          busy={busy}
          onChange={(next) => setBlock(i, next)}
          onRemove={() => removeBlock(i)}
          onMove={(dir) => moveBlock(i, dir)}
          onReplaceImage={() => openImagePicker(i)}
        />
      ))}

      {/* Add-block buttons */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", borderTop: "1px solid var(--beige-dark)", paddingTop: 12 }}>
        <button type="button" className="btn-secondary" disabled={atLimit} style={{ fontSize: "0.85rem" }}
          onClick={() => addBlock({ type: "text", text: "", align: "center", size: "md", bold: false, showShort: true, showFull: true })}>
          ＋ ข้อความ
        </button>
        <button type="button" className="btn-secondary" disabled={atLimit || busy} style={{ fontSize: "0.85rem" }}
          onClick={() => openImagePicker(null)}>
          {busy ? "กำลังประมวลผล…" : "＋ รูปภาพ / QR"}
        </button>
        <button type="button" className="btn-secondary" disabled={atLimit} style={{ fontSize: "0.85rem" }}
          onClick={() => addBlock({ type: "divider", showShort: true, showFull: true })}>
          ＋ เส้นคั่น
        </button>
      </div>

      {/* Live preview */}
      <div style={{ borderTop: "1px solid var(--beige-dark)", paddingTop: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "#555" }}>ตัวอย่างท้ายใบเสร็จ:</span>
          {(["SHORT", "FULL"] as const).map(v => (
            <button key={v} type="button" onClick={() => setPreview(v)}
              style={{
                fontSize: "0.75rem", padding: "3px 10px", borderRadius: 999, cursor: "pointer",
                border: "1px solid var(--beige-dark)",
                background: preview === v ? "var(--olive)" : "white",
                color: preview === v ? "white" : "#555",
              }}>
              {v === "SHORT" ? "สลิป" : "A4"}
            </button>
          ))}
        </div>
        <FooterPreview blocks={blocks} variant={preview} />
      </div>
    </div>
  );
}

function FooterBlockCard({ block, index, total, busy, onChange, onRemove, onMove, onReplaceImage }: {
  block: FooterBlock;
  index: number;
  total: number;
  busy: boolean;
  onChange: (b: FooterBlock) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
  onReplaceImage: () => void;
}) {
  const typeLabel = block.type === "text" ? "📝 ข้อความ" : block.type === "image" ? "🖼️ รูปภาพ" : "➖ เส้นคั่น";
  const iconBtn: React.CSSProperties = {
    width: 28, height: 28, borderRadius: 6, border: "1px solid var(--beige-dark)", background: "white",
    cursor: "pointer", fontSize: "0.85rem", display: "inline-flex", alignItems: "center", justifyContent: "center",
  };
  return (
    <div style={{ border: "1px solid var(--beige-dark)", borderRadius: 10, background: "white", padding: "0.75rem" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#555" }}>{typeLabel}</span>
        <div style={{ display: "flex", gap: 4 }}>
          <button type="button" style={iconBtn} title="เลื่อนขึ้น" disabled={index === 0} onClick={() => onMove(-1)}>↑</button>
          <button type="button" style={iconBtn} title="เลื่อนลง" disabled={index === total - 1} onClick={() => onMove(1)}>↓</button>
          <button type="button" style={{ ...iconBtn, color: "#c0392b" }} title="ลบ" onClick={onRemove}>🗑</button>
        </div>
      </div>

      {block.type === "text" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <textarea
            className="input"
            value={block.text}
            onChange={e => onChange({ ...block, text: e.target.value })}
            placeholder="เช่น ขอบคุณที่ใช้บริการค่ะ 🙏"
            style={{ minHeight: 56, resize: "vertical" }}
          />
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
            <Segmented label="จัดวาง" options={ALIGN_OPTS} value={block.align} onChange={v => onChange({ ...block, align: v })} />
            <Segmented label="ขนาด" options={SIZE_OPTS} value={block.size} onChange={v => onChange({ ...block, size: v })} />
            <button type="button" onClick={() => onChange({ ...block, bold: !block.bold })}
              style={{ fontSize: "0.8rem", padding: "3px 10px", borderRadius: 6, border: "1px solid var(--beige-dark)", cursor: "pointer", fontWeight: block.bold ? 700 : 400, background: block.bold ? "var(--beige)" : "white" }}>
              ตัวหนา
            </button>
          </div>
        </div>
      )}

      {block.type === "image" && (
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          <div style={{ width: 72, height: 72, borderRadius: 8, border: "1px solid var(--beige-dark)", background: "#fafafa", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
            <img src={block.dataUrl} alt="" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
            <div>
              <button type="button" className="btn-secondary" disabled={busy} style={{ fontSize: "0.8rem" }} onClick={onReplaceImage}>
                {busy ? "กำลังประมวลผล…" : "📁 เปลี่ยนรูป"}
              </button>
            </div>
            <Segmented label="จัดวาง" options={ALIGN_OPTS} value={block.align} onChange={v => onChange({ ...block, align: v })} />
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.8rem", color: "#555" }}>
              กว้าง
              <input type="range" min={10} max={100} step={5} value={block.widthPct}
                onChange={e => onChange({ ...block, widthPct: Number(e.target.value) })} style={{ flex: 1 }} />
              <span style={{ width: 36, textAlign: "right", fontFamily: "monospace" }}>{block.widthPct}%</span>
            </label>
          </div>
        </div>
      )}

      {block.type === "divider" && (
        <div style={{ borderTop: "1px dashed #999", margin: "4px 0 2px" }} />
      )}

      {/* Per-block visibility */}
      <div style={{ display: "flex", gap: 16, marginTop: 10, paddingTop: 8, borderTop: "1px dashed var(--beige-dark)", fontSize: "0.8rem", color: "#555" }}>
        <span>แสดงใน:</span>
        <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
          <input type="checkbox" checked={block.showShort} onChange={e => onChange({ ...block, showShort: e.target.checked })} />
          สลิป
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
          <input type="checkbox" checked={block.showFull} onChange={e => onChange({ ...block, showFull: e.target.checked })} />
          ใบเต็ม A4
        </label>
      </div>
    </div>
  );
}

function Segmented<T extends string>({ label, options, value, onChange }: {
  label: string;
  options: { v: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{ fontSize: "0.8rem", color: "#888" }}>{label}</span>
      <div style={{ display: "inline-flex", border: "1px solid var(--beige-dark)", borderRadius: 6, overflow: "hidden" }}>
        {options.map(o => (
          <button key={o.v} type="button" onClick={() => onChange(o.v)}
            style={{
              fontSize: "0.78rem", padding: "3px 9px", cursor: "pointer", border: "none",
              background: value === o.v ? "var(--olive)" : "white",
              color: value === o.v ? "white" : "#555",
            }}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function FooterPreview({ blocks, variant }: { blocks: FooterBlock[]; variant: "SHORT" | "FULL" }) {
  const visible = blocks.filter(b => (variant === "SHORT" ? b.showShort : b.showFull));
  return (
    <div style={{
      width: variant === "SHORT" ? 280 : "100%", maxWidth: 460, margin: "0 auto",
      background: "white", border: "1px solid var(--beige-dark)", borderRadius: 8, padding: "12px 14px",
    }}>
      {visible.length === 0 ? (
        <div style={{ textAlign: "center", color: "#bbb", fontSize: "0.78rem" }}>— ไม่มีบล็อกที่แสดงในใบเสร็จนี้ —</div>
      ) : (
        visible.map((b, i) => {
          if (b.type === "text") {
            return (
              <div key={i} style={{ textAlign: b.align, fontWeight: b.bold ? 700 : 400, fontSize: SIZE_PX[b.size], whiteSpace: "pre-wrap", wordBreak: "break-word", margin: "6px 0", lineHeight: 1.4 }}>
                {b.text.trim() ? b.text : <span style={{ color: "#ccc" }}>(ข้อความว่าง)</span>}
              </div>
            );
          }
          if (b.type === "image") {
            return (
              <div key={i} style={{ textAlign: b.align, margin: "6px 0" }}>
                <img src={b.dataUrl} alt="" style={{ width: `${b.widthPct}%`, objectFit: "contain" }} />
              </div>
            );
          }
          return <div key={i} style={{ borderTop: "1px dashed #999", margin: "8px 0" }} />;
        })
      )}
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
