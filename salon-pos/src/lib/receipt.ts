export const COMPANY = {
  name: "บริษัท ลานนาดีเซีย กรุ๊ป จำกัด",
  taxId: "0505567002730",
  address: "119/2 หมู่บ้านใจแก้เอราวัณ 23 หมู่ 3 ตำบล หนองหอย อำเภอ เมืองเชียงใหม่ จังหวัด เชียงใหม่ 50000",
  shortName: "บ.ลานนาดีเซีย กรุ๊ป",
};

export const METHOD_LABEL: Record<string, string> = {
  CASH: "เงินสด",
  TRANSFER: "โอนเงิน (QR)",
  CREDIT_CARD: "บัตรเครดิต",
  WALLET: "Wallet",
  TICKET: "Ticket/คูปอง",
};

export type ReceiptLineItem = { name: string; qty: number; unitPrice: number; total: number };
export type ReceiptPayment = { method: string; amount: number };
export type FullInvoiceInfo = { customerName: string; customerAddress: string; customerTaxId: string };
// Override the shop name + logo printed at the top of the receipt. Both optional —
// if not provided, the legally-registered name from COMPANY is used (taxId/address never change).
export type ReceiptBranding = { shopName?: string | null; logoDataUrl?: string | null };

export type ReceiptData = {
  orderId: string;
  customerName: string;
  customerPhone?: string | null;
  technicianName: string;
  items: ReceiptLineItem[];
  subtotal: number;
  discountTotal: number;
  baseTotal: number;
  serviceCharge: number;
  vat: number;
  roundingAdjustment: number;
  finalTotal: number;
  change: number;
  payments: ReceiptPayment[];
  paidAt: Date;
  receiptNumber: number;
  // For FULL: use the canonical taxInvoiceNumber from DB (locked at first issuance).
  // For SHORT: leave undefined and the builder formats from receiptNumber + paidAt.
  taxInvoiceNumber?: string | null;
};

function pad4(n: number): string { return String(n).padStart(4, "0"); }

export function formatReceiptNo(seq: number, mode: "SHORT" | "FULL", date: Date): string {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = String(date.getFullYear());
  if (mode === "SHORT") return `LNDS${pad4(seq)}${dd}${mm}${yyyy}`;
  return `LNDSFULL${yyyy}${mm}${dd}${pad4(seq)}`;
}

export function buildReceiptHtml(r: ReceiptData, mode: "SHORT" | "FULL", info: FullInvoiceInfo, branding?: ReceiptBranding): string {
  const date = r.paidAt.toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" });
  const time = r.paidAt.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
  const receiptNo = mode === "FULL" && r.taxInvoiceNumber
    ? r.taxInvoiceNumber
    : formatReceiptNo(r.receiptNumber, mode, r.paidAt);
  const hasCC = r.payments.some(p => p.method === "CREDIT_CARD");
  const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const totalQty = r.items.reduce((s, it) => s + it.qty, 0);
  const shopName = branding?.shopName?.trim() || COMPANY.name;
  const logoUrl = branding?.logoDataUrl || null;

  if (mode === "SHORT") {
    const itemRows = r.items.map(it =>
      `<tr><td class="c">${it.qty}</td><td>${it.name}</td><td class="r">${fmt(it.total)}</td></tr>`
    ).join("");

    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>ใบเสร็จ ${receiptNo}</title>
<style>
body { font-family: "Sarabun", "TH Sarabun New", sans-serif; margin: 16px; font-size: 12px; max-width: 320px; color: #222; }
h2, h3 { text-align: center; margin: 4px 0; }
p { margin: 3px 0; }
.line { border-top: 1px dashed #555; margin: 6px 0; }
table { width: 100%; border-collapse: collapse; }
table.items td, table.items th { padding: 2px 0; vertical-align: top; }
table.items th { font-size: 11px; color: #555; border-bottom: 1px solid #888; }
.c { text-align: center; }
.r { text-align: right; }
.b { font-weight: 700; }
.sm { font-size: 11px; color: #555; }
.no { text-align: center; font-family: monospace; font-size: 12px; letter-spacing: 0.5px; background: #f5f5f5; padding: 4px; border-radius: 4px; margin: 6px 0; }
.shop { text-align: center; font-size: 11px; color: #666; line-height: 1.4; }
.logo { text-align: center; margin: 0 0 6px; }
.logo img { max-width: 120px; max-height: 60px; object-fit: contain; }
.summary td { padding: 2px 0; }
.summary tr.net td { border-top: 1px solid #aaa; font-weight: 700; padding-top: 4px; }
.summary tr.grand td { border-top: 2px solid #000; border-bottom: 2px solid #000; font-weight: 700; font-size: 13px; padding: 4px 0; }
.vat-label { text-align: center; font-size: 11px; letter-spacing: 1px; border: 1px solid #999; padding: 3px; margin-top: 6px; font-weight: 700; }
</style></head><body>
${logoUrl ? `<div class="logo"><img src="${logoUrl}" alt="logo"/></div>` : ""}
<h2>${shopName}</h2>
<div class="shop">${COMPANY.address}</div>
<div class="shop">เลขผู้เสียภาษี: ${COMPANY.taxId}</div>
<div class="line"></div>
<h3>ใบกำกับภาษีอย่างย่อ / ใบเสร็จรับเงิน</h3>
<div class="no">${receiptNo}</div>
<div class="line"></div>
<p>พนักงานขาย: ${r.technicianName}</p>
<p>วันที่: ${date} ${time}</p>
<p>ลูกค้า: ${r.customerName}</p>
${r.customerPhone ? `<p class="sm">โทร: ${r.customerPhone}</p>` : ""}
<div class="line"></div>
<table class="items">
  <thead><tr><th class="c" style="width:36px">จำนวน</th><th>รายการ</th><th class="r" style="width:80px">ราคา</th></tr></thead>
  <tbody>${itemRows}</tbody>
</table>
<div class="line"></div>
<p class="b">จำนวนรวม ${totalQty}</p>
<table class="summary">
  <tr><td>รวมเป็นเงิน</td><td class="r">${fmt(r.subtotal)}</td></tr>
  ${r.discountTotal > 0 ? `<tr><td>ส่วนลด</td><td class="r" style="color:#c00">-${fmt(r.discountTotal)}</td></tr>` : ""}
  <tr class="net"><td>ยอดสุทธิ (หลังหักส่วนลด)</td><td class="r">${fmt(r.baseTotal)}</td></tr>
  ${hasCC ? `<tr><td>+ Service Charge 3% (CC)</td><td class="r">${fmt(r.serviceCharge)}</td></tr>` : ""}
  <tr><td>+ ภาษีมูลค่าเพิ่ม 7%</td><td class="r">${fmt(r.vat)}</td></tr>
  ${r.roundingAdjustment !== 0 ? `<tr><td>ค่าปัดเศษ</td><td class="r">${r.roundingAdjustment > 0 ? "+" : ""}${fmt(r.roundingAdjustment)}</td></tr>` : ""}
  <tr class="grand"><td>รวมทั้งสิ้น</td><td class="r">${fmt(r.finalTotal)}</td></tr>
</table>
<div class="line"></div>
${r.payments.map(p => `<p>${METHOD_LABEL[p.method] ?? p.method}: ฿${fmt(p.amount)}</p>`).join("")}
${r.change > 0 ? `<p class="b">เงินทอน: ฿${fmt(r.change)}</p>` : ""}
<div class="vat-label">VAT INCLUDED</div>
<p style="text-align:center;font-size:12px;margin-top:8px">ขอบคุณที่ใช้บริการค่ะ 🙏</p>
</body></html>`;
  }

  // FULL TAX INVOICE — A4 layout, prints Original + Copy on 2 pages
  const itemsRows = r.items.map((it, idx) => `
    <tr>
      <td class="c">${idx + 1}</td>
      <td>${it.name}</td>
      <td class="c">${it.qty}</td>
      <td class="r">${fmt(it.unitPrice)}</td>
      <td class="r">${fmt(it.total)}</td>
    </tr>`).join("");

  const priceExclVat = r.baseTotal + r.serviceCharge;

  const buildPage = (variant: "ORIGINAL" | "COPY") => {
    const variantLabel = variant === "ORIGINAL" ? "ต้นฉบับ / Original" : "สำเนา / Copy";
    return `
    <div class="page">
      <div class="header">
        <div class="shop-info">
          ${logoUrl ? `<div class="logo"><img src="${logoUrl}" alt="logo"/></div>` : ""}
          <h1>${shopName}</h1>
          <p>${COMPANY.address}</p>
          <p><strong>เลขประจำตัวผู้เสียภาษี:</strong> ${COMPANY.taxId}</p>
        </div>
        <div class="doc-info">
          <h2>ใบกำกับภาษี / Tax Invoice</h2>
          <div class="badge ${variant === "COPY" ? "copy" : ""}">${variantLabel}</div>
          <div class="no">เลขที่: ${receiptNo}</div>
          <div class="meta">วันที่: ${date}</div>
          <div class="meta">เวลา: ${time}</div>
        </div>
      </div>

      <div class="parties">
        <div class="party">
          <h3>ผู้ขาย / Seller</h3>
          <p class="b">${shopName}</p>
          <p>${COMPANY.address}</p>
          <p><strong>เลขผู้เสียภาษี:</strong> ${COMPANY.taxId}</p>
        </div>
        <div class="party">
          <h3>ผู้ซื้อ / Customer</h3>
          <p class="b">${info.customerName}</p>
          <p>${info.customerAddress}</p>
          <p><strong>เลขผู้เสียภาษี:</strong> ${info.customerTaxId}</p>
          ${r.customerPhone ? `<p>โทร: ${r.customerPhone}</p>` : ""}
        </div>
      </div>

      <table class="items">
        <thead>
          <tr>
            <th style="width:40px">#</th>
            <th>รายการ / Description</th>
            <th class="c" style="width:60px">จำนวน</th>
            <th class="r" style="width:110px">ราคา/หน่วย</th>
            <th class="r" style="width:120px">จำนวนเงิน</th>
          </tr>
        </thead>
        <tbody>
          ${itemsRows}
        </tbody>
      </table>

      <div class="summary">
        <table>
          <tr><td class="label">รวมเป็นเงิน</td><td class="val">${fmt(r.subtotal)} บาท</td></tr>
          ${r.discountTotal > 0 ? `<tr><td class="label">ส่วนลด</td><td class="val red">-${fmt(r.discountTotal)} บาท</td></tr>` : ""}
          <tr class="net"><td class="label">ยอดสุทธิ (หลังหักส่วนลด)</td><td class="val">${fmt(r.baseTotal)} บาท</td></tr>
          ${hasCC ? `<tr><td class="label">+ Service Charge 3% (Credit Card)</td><td class="val">${fmt(r.serviceCharge)} บาท</td></tr>` : ""}
          <tr><td class="label">ราคาไม่รวมภาษีมูลค่าเพิ่ม</td><td class="val">${fmt(priceExclVat)} บาท</td></tr>
          <tr><td class="label">+ ภาษีมูลค่าเพิ่ม 7%</td><td class="val">${fmt(r.vat)} บาท</td></tr>
          ${r.roundingAdjustment !== 0 ? `<tr><td class="label">ค่าปัดเศษ</td><td class="val">${r.roundingAdjustment > 0 ? "+" : ""}${fmt(r.roundingAdjustment)} บาท</td></tr>` : ""}
          <tr class="total"><td>รวมทั้งสิ้น</td><td class="val">${fmt(r.finalTotal)} บาท</td></tr>
        </table>
      </div>

      <div class="payments">
        ชำระโดย: ${r.payments.map(p => `${METHOD_LABEL[p.method] ?? p.method} ฿${fmt(p.amount)}`).join(", ")}
      </div>

      <div class="signatures">
        <div class="sig">
          <div class="line"></div>
          <small>ผู้รับเงิน / Authorized Signature</small>
        </div>
        <div class="sig">
          <div class="line"></div>
          <small>ผู้รับสินค้า / Customer Signature</small>
        </div>
      </div>

      <div class="footer">
        เอกสารนี้พิมพ์จากระบบคอมพิวเตอร์ของ ${shopName} — ${receiptNo} (${variantLabel})
      </div>
    </div>`;
  };

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>ใบกำกับภาษี ${receiptNo}</title>
<style>
@page { size: A4; margin: 1.5cm; }
* { box-sizing: border-box; }
body { font-family: "Sarabun", "TH Sarabun New", sans-serif; margin: 0; font-size: 13px; color: #222; }
.page { width: 100%; max-width: 18cm; margin: 0 auto; page-break-after: always; }
.page:last-child { page-break-after: auto; }
.header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #333; padding-bottom: 12px; margin-bottom: 16px; }
.shop-info h1 { margin: 0 0 4px; font-size: 20px; color: #333; }
.shop-info p { margin: 2px 0; font-size: 12px; color: #555; }
.shop-info .logo { margin-bottom: 6px; }
.shop-info .logo img { max-width: 140px; max-height: 70px; object-fit: contain; }
.doc-info { text-align: right; }
.doc-info h2 { margin: 0; font-size: 18px; color: #333; }
.badge { background: #333; color: white; padding: 4px 12px; border-radius: 4px; font-size: 11px; margin-top: 4px; display: inline-block; font-weight: 700; }
.badge.copy { background: #c0392b; }
.no { font-family: monospace; font-size: 13px; letter-spacing: 1px; margin-top: 6px; }
.meta { font-size: 12px; color: #666; margin-top: 2px; }
.parties { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px; }
.party { border: 1px solid #ccc; padding: 10px 12px; border-radius: 4px; background: #fafafa; }
.party h3 { margin: 0 0 6px; font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; }
.party p { margin: 2px 0; font-size: 13px; }
.b { font-weight: 700; }
table.items { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
table.items th { background: #333; color: white; padding: 8px 10px; font-size: 12px; text-align: left; }
table.items td { padding: 8px 10px; border-bottom: 1px solid #eee; font-size: 13px; }
table.items td.c, table.items th.c { text-align: center; }
table.items td.r, table.items th.r { text-align: right; }
.summary { display: flex; justify-content: flex-end; margin-bottom: 24px; }
.summary table { border-collapse: collapse; min-width: 320px; }
.summary td { padding: 4px 8px; }
.summary .label { color: #555; }
.summary .val { text-align: right; min-width: 110px; }
.summary .red { color: #c00; }
.summary tr.net td { border-top: 1px solid #999; font-weight: 700; padding-top: 6px; }
.summary tr.total td { border-top: 2px solid #333; font-weight: 700; font-size: 15px; padding-top: 8px; }
.payments { font-size: 12px; color: #555; margin-bottom: 8px; }
.signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 50px; }
.sig { text-align: center; }
.sig .line { border-top: 1px solid #999; margin-bottom: 6px; }
.sig small { color: #666; }
.footer { text-align: center; margin-top: 30px; padding-top: 12px; border-top: 1px solid #ddd; font-size: 11px; color: #888; }
</style></head><body>
${buildPage("ORIGINAL")}
${buildPage("COPY")}
</body></html>`;
}
