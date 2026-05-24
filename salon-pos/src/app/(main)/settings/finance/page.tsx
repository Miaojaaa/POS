"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_FINANCE,
  DEFAULT_RECEIPT_FORMATS,
  buildReceiptNumber,
  type CommissionMode,
  type CommissionRates,
  type DateOrder,
  type FinanceConfig,
  type LetterPosition,
  type ReceiptFormatConfig,
  type ReceiptFormats,
  type VatMode,
  type YearFormat,
} from "@/lib/system-config";

const COMMISSION_OPTIONS: { value: CommissionMode; title: string; hint: string }[] = [
  { value: "POOL", title: "ค่าคอมรวม (Pool)", hint: "รวบรวมค่าคอมเป็นกองกลาง แล้วหารตามเปอร์เซ็นต์ของแต่ละบทบาท" },
  { value: "PER_HEAD", title: "ค่าคอมรายหัว", hint: "คำนวณค่าคอมตามจำนวนออร์เดอร์/ลูกค้าของพนักงานแต่ละคน" },
  { value: "NONE", title: "ไม่มีค่าคอม", hint: "พนักงานรับเฉพาะเงินเดือนพื้นฐาน" },
];

const VAT_OPTIONS: { value: VatMode; title: string; hint: string }[] = [
  { value: "EXCLUSIVE", title: "VAT คิดแยก (Exclusive)", hint: "ราคาสินค้ายังไม่รวม VAT — ระบบจะบวก 7% เพิ่มตอนคิดเงิน" },
  { value: "INCLUSIVE", title: "VAT รวมในราคา (Inclusive)", hint: "ราคาสินค้ารวม VAT แล้ว — ระบบจะแยก 7% ออกจากยอดเพื่อแสดงบนใบเสร็จ" },
];

const LETTER_POSITION_OPTIONS: { value: LetterPosition; label: string }[] = [
  { value: "FRONT", label: "อยู่หน้า" },
  { value: "BACK", label: "อยู่หลัง" },
];

const DATE_ORDER_OPTIONS: { value: DateOrder; label: string }[] = [
  { value: "YMD", label: "ปี - เดือน - วัน" },
  { value: "YDM", label: "ปี - วัน - เดือน" },
  { value: "MDY", label: "เดือน - วัน - ปี" },
  { value: "DMY", label: "วัน - เดือน - ปี" },
];

const YEAR_FORMAT_OPTIONS: { value: YearFormat; label: string }[] = [
  { value: "CE_4", label: "ค.ศ. 4 หลัก (เช่น 2026)" },
  { value: "BE_4", label: "พ.ศ. 4 หลัก (เช่น 2569)" },
  { value: "CE_2", label: "ค.ศ. 2 หลัก (เช่น 26)" },
  { value: "BE_2", label: "พ.ศ. 2 หลัก (เช่น 69)" },
];

export default function FinanceSettingsPage() {
  const [config, setConfig] = useState<FinanceConfig>(DEFAULT_FINANCE);
  const [formats, setFormats] = useState<ReceiptFormats>(DEFAULT_RECEIPT_FORMATS);
  const [initial, setInitial] = useState<string>(""); // JSON snapshot of last-saved state for dirty-check
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/system-config")
      .then(r => r.json())
      .then((d: { finance: FinanceConfig; receiptFormat: ReceiptFormats }) => {
        if (d.finance) setConfig(d.finance);
        if (d.receiptFormat) setFormats(d.receiptFormat);
        setInitial(JSON.stringify({ finance: d.finance ?? DEFAULT_FINANCE, formats: d.receiptFormat ?? DEFAULT_RECEIPT_FORMATS }));
      })
      .catch(() => setMsg({ kind: "err", text: "โหลดข้อมูลไม่สำเร็จ" }))
      .finally(() => setLoading(false));
  }, []);

  const dirty = initial !== "" && JSON.stringify({ finance: config, formats }) !== initial;

  async function save() {
    if (!formats.short.prefix.trim()) { setMsg({ kind: "err", text: "Prefix ใบเสร็จย่อห้ามว่าง" }); return; }
    if (!formats.full.prefix.trim()) { setMsg({ kind: "err", text: "Prefix ใบกำกับภาษีเต็มห้ามว่าง" }); return; }
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/system-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ finance: config, receiptFormat: formats }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "บันทึกไม่สำเร็จ" }));
        setMsg({ kind: "err", text: data.error ?? "บันทึกไม่สำเร็จ" });
      } else {
        const data: { finance: FinanceConfig; receiptFormat: ReceiptFormats } = await res.json();
        if (data.finance) setConfig(data.finance);
        if (data.receiptFormat) setFormats(data.receiptFormat);
        setInitial(JSON.stringify({ finance: data.finance ?? config, formats: data.receiptFormat ?? formats }));
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
            ส่งผลต่อหน้า HR &amp; Payroll และการคำนวณเงินเดือน — POOL กับ PER_HEAD เก็บ % แยกกัน
          </p>
          <div style={{ display: "grid", gap: "0.5rem" }}>
            {COMMISSION_OPTIONS.map(opt => {
              const active = config.commissionMode === opt.value;
              const rates = opt.value === "POOL" ? config.poolRates
                : opt.value === "PER_HEAD" ? config.perHeadRates
                : null;
              return (
                <RadioCard
                  key={opt.value}
                  checked={active}
                  title={opt.title}
                  hint={opt.hint}
                  onChange={() => setConfig(c => ({ ...c, commissionMode: opt.value }))}
                >
                  {active && rates && (
                    <RateEditor
                      rates={rates}
                      onChange={next => setConfig(c => opt.value === "POOL"
                        ? { ...c, poolRates: next }
                        : { ...c, perHeadRates: next })}
                    />
                  )}
                </RadioCard>
              );
            })}
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

        {/* Receipt-number format */}
        <section>
          <h2 style={{ fontSize: "1rem", fontWeight: 600, margin: "0 0 0.5rem" }}>รูปแบบเลขใบเสร็จ &amp; ใบกำกับภาษี</h2>
          <p style={{ fontSize: "0.8rem", color: "#888", margin: "0 0 0.75rem" }}>
            มีผลกับเลขที่ออกใหม่หลังจากบันทึก — เลขที่ออกไปแล้ว (ใบกำกับภาษีเต็ม) จะถูกล็อกไว้ตามรูปแบบเดิม
          </p>
          <ReceiptFormatEditor
            title="ใบเสร็จย่อ (SHORT)"
            value={formats.short}
            onChange={v => setFormats(f => ({ ...f, short: v }))}
            onReset={() => setFormats(f => ({ ...f, short: DEFAULT_RECEIPT_FORMATS.short }))}
          />
          <div style={{ height: "0.75rem" }} />
          <ReceiptFormatEditor
            title="ใบกำกับภาษีเต็ม (FULL)"
            value={formats.full}
            onChange={v => setFormats(f => ({ ...f, full: v }))}
            onReset={() => setFormats(f => ({ ...f, full: DEFAULT_RECEIPT_FORMATS.full }))}
          />
        </section>

        {msg && (
          <div style={{
            padding: "0.5rem 0.75rem", borderRadius: 8, fontSize: "0.85rem",
            background: msg.kind === "ok" ? "#D4EDDA" : "#F8D7DA",
            color: msg.kind === "ok" ? "#155724" : "#721c24",
          }}>{msg.text}</div>
        )}

        <div>
          <button className="btn-primary" onClick={save} disabled={saving || !dirty}>
            {saving ? "กำลังบันทึก…" : "บันทึก"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ReceiptFormatEditor({ title, value, onChange, onReset }: {
  title: string;
  value: ReceiptFormatConfig;
  onChange: (v: ReceiptFormatConfig) => void;
  onReset: () => void;
}) {
  // Use today + seq=1 as the preview so the user immediately sees how the format renders
  const preview = buildReceiptNumber(1, new Date(), value);
  return (
    <div style={{
      border: "1px solid var(--beige-dark)", borderRadius: 12, padding: "0.875rem 1rem",
      background: "#fafafa",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
        <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>{title}</div>
        <button type="button" className="btn-secondary" onClick={onReset} style={{ fontSize: "0.7rem", padding: "2px 10px" }}>
          คืนค่าเริ่มต้น
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.75rem" }}>
        <div>
          <label className="label">หมวดอักษร (Prefix)</label>
          <input
            className="input"
            value={value.prefix}
            onChange={e => onChange({ ...value, prefix: e.target.value.toUpperCase().slice(0, 16) })}
            placeholder="เช่น LNDS"
            style={{ fontFamily: "monospace", letterSpacing: 1 }}
          />
        </div>
        <div>
          <label className="label">ตำแหน่งอักษร</label>
          <select
            className="input"
            value={value.letterPosition}
            onChange={e => onChange({ ...value, letterPosition: e.target.value as LetterPosition })}
          >
            {LETTER_POSITION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label">ลำดับวันที่</label>
          <select
            className="input"
            value={value.dateOrder}
            onChange={e => onChange({ ...value, dateOrder: e.target.value as DateOrder })}
          >
            {DATE_ORDER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label">รูปแบบปี</label>
          <select
            className="input"
            value={value.yearFormat}
            onChange={e => onChange({ ...value, yearFormat: e.target.value as YearFormat })}
          >
            {YEAR_FORMAT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label">จำนวนหลักเลขรัน</label>
          <input
            type="number" min={2} max={8}
            className="input"
            value={value.seqDigits}
            onChange={e => onChange({ ...value, seqDigits: Math.min(8, Math.max(2, Number(e.target.value) || 4)) })}
          />
        </div>
      </div>

      <div style={{
        marginTop: "0.75rem", padding: "0.5rem 0.75rem", borderRadius: 8,
        background: "white", border: "1px dashed var(--beige-dark)",
        fontFamily: "monospace", fontSize: "0.95rem", letterSpacing: 1,
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <span style={{ color: "#888", fontSize: "0.75rem", fontFamily: "inherit", letterSpacing: 0 }}>ตัวอย่าง:</span>
        <span style={{ fontWeight: 700, color: "var(--olive)" }}>{preview}</span>
      </div>
    </div>
  );
}

function RadioCard({ checked, title, hint, onChange, children }: { checked: boolean; title: string; hint: string; onChange: () => void; children?: React.ReactNode }) {
  return (
    <div style={{
      border: `2px solid ${checked ? "var(--olive)" : "var(--beige-dark)"}`,
      borderRadius: 12,
      background: checked ? "rgba(107,124,69,0.06)" : "white",
      transition: "border-color 0.15s, background 0.15s",
    }}>
      <label style={{
        display: "flex", alignItems: "flex-start", gap: "0.75rem",
        padding: "0.75rem 1rem", cursor: "pointer",
      }}>
        <input type="radio" checked={checked} onChange={onChange} style={{ marginTop: 3, accentColor: "var(--olive)" }} />
        <div>
          <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>{title}</div>
          <div style={{ fontSize: "0.75rem", color: "#888", marginTop: 2 }}>{hint}</div>
        </div>
      </label>
      {children}
    </div>
  );
}

function RateEditor({ rates, onChange }: { rates: CommissionRates; onChange: (next: CommissionRates) => void }) {
  return (
    <div style={{
      borderTop: "1px dashed var(--beige-dark)",
      padding: "0.75rem 1rem 0.875rem",
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: "0.75rem",
    }}>
      <PctField
        label="% ของช่าง"
        value={rates.techPct}
        onChange={v => onChange({ ...rates, techPct: v })}
      />
      <PctField
        label="% ของผู้ช่วย"
        value={rates.assistPct}
        onChange={v => onChange({ ...rates, assistPct: v })}
      />
    </div>
  );
}

function PctField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label className="label" style={{ fontSize: "0.75rem" }}>{label}</label>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <input
          type="number"
          min={0}
          max={100}
          step={0.5}
          className="input"
          style={{ fontFamily: "monospace", textAlign: "right" }}
          value={value}
          onChange={e => {
            const raw = e.target.value;
            if (raw === "") return onChange(0);
            const n = Number(raw);
            if (Number.isFinite(n)) onChange(Math.max(0, Math.min(100, n)));
          }}
        />
        <span style={{ fontSize: "0.85rem", color: "#666" }}>%</span>
      </div>
    </div>
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
