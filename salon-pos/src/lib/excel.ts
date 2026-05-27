import * as XLSX from "xlsx";

export type OrderForExport = {
  branchId: string;
  branch?: { name: string };
  customerName: string;
  technician: { name: string };
  createdAt: string;
  completedAt?: string | null;
  subtotal: number;          // raw services sum (pre-VAT/SC/discount)
  retailSubtotal: number;    // raw retail sum
  discountAmount: number;
  serviceCharge: number;
  vat: number;
  roundingAdjustment?: number;
  total: number;             // final total customer paid
  items: { service: { name: string; category?: { name: string } | null }; price: number }[];
  retailItems: { retailProduct: { name: string }; quantity: number; price: number }[];
  payments: { method: string; amount: number }[];
};

const METHOD_LABEL: Record<string, string> = {
  CASH: "เงินสด",
  TRANSFER: "โอน",
  CREDIT_CARD: "บัตรเครดิต",
  WALLET: "Wallet",
  TICKET: "Ticket",
};

const MONEY_FMT = "#,##0.00";

function ymd(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Single-sheet layout used by both daily and monthly exports.
 *
 * Columns: [วันที่?] สาขา · รายการ · หมวดหมู่ย่อยบริการ · ช่าง · ส่วนลด ·
 * Net Total · SC · VAT · ค่าปัดเศษ · ยอด · (วิธีชำระ × N)
 *
 * Each order becomes one row for services (qty merged into the label join)
 * plus one row per retail line ("name xQTY"). Money columns are proportionally
 * allocated by `line_raw / (subtotal + retailSubtotal)` so vertical sums of
 * any money column equal the corresponding order total.
 */
function buildServicesSheet(
  orders: OrderForExport[],
  opts: { includeDate: boolean },
): XLSX.WorkSheet {
  const maxPayments = Math.max(1, ...orders.map(o => o.payments.length));
  const header: string[] = [];
  if (opts.includeDate) header.push("วันที่");
  header.push(
    "สาขา", "รายการ", "หมวดหมู่ย่อยบริการ", "ช่าง",
    "ส่วนลด (฿)", "Net Total (฿)", "Service Charge 3% (฿)", "VAT 7% (฿)", "ค่าปัดเศษ (฿)", "ยอด (฿)",
  );
  for (let i = 0; i < maxPayments; i++) {
    header.push(i === 0 ? "วิธีชำระ" : `วิธีชำระ ${i + 1}`);
    header.push(i === 0 ? "ยอดชำระ" : `ยอดชำระ ${i + 1}`);
  }

  const rows: (string | number)[][] = [header];

  let sumDiscount = 0, sumNet = 0, sumSC = 0, sumVat = 0, sumRound = 0, sumTotal = 0;
  const sumByMethodIdx: number[] = [];

  for (const o of orders) {
    const rawTotal = o.subtotal + o.retailSubtotal;
    const branchName = o.branch?.name ?? "";
    const subCats = Array.from(new Set(
      o.items
        .map(i => i.service.category?.name)
        .filter((n): n is string => Boolean(n)),
    )).join(", ");

    const lines: { label: string; raw: number; subCat: string }[] = [];
    if (o.items.length > 0) {
      lines.push({
        label: o.items.map(i => i.service.name).join(", "),
        raw: o.subtotal,
        subCat: subCats,
      });
    }
    for (const ri of o.retailItems) {
      lines.push({
        label: `${ri.retailProduct.name} x${ri.quantity}`,
        raw: ri.price * ri.quantity,
        subCat: "",
      });
    }
    if (lines.length === 0) continue;

    const rounding = o.roundingAdjustment || 0;
    const refDate = new Date(o.completedAt || o.createdAt);
    const dateStr = ymd(refDate);

    for (const line of lines) {
      const ratio = rawTotal > 0 ? line.raw / rawTotal : 1 / lines.length;
      const discountLine = (o.discountAmount || 0) * ratio;
      const scLine = (o.serviceCharge || 0) * ratio;
      const vatLine = (o.vat || 0) * ratio;
      const roundLine = rounding * ratio;
      const netLine = line.raw - discountLine;
      const linePortion = o.total * ratio;

      const row: (string | number)[] = [];
      if (opts.includeDate) row.push(dateStr);
      row.push(
        branchName,
        line.label,
        line.subCat,
        o.technician.name,
        Number(discountLine.toFixed(2)),
        Number(netLine.toFixed(2)),
        Number(scLine.toFixed(2)),
        Number(vatLine.toFixed(2)),
        Number(roundLine.toFixed(2)),
        Number(linePortion.toFixed(2)),
      );
      for (let i = 0; i < maxPayments; i++) {
        const p = o.payments[i];
        if (p) {
          const portion = p.amount * ratio;
          row.push(METHOD_LABEL[p.method] ?? p.method);
          row.push(Number(portion.toFixed(2)));
          sumByMethodIdx[i] = (sumByMethodIdx[i] || 0) + portion;
        } else {
          row.push("", "");
        }
      }
      rows.push(row);

      sumDiscount += discountLine;
      sumNet += netLine;
      sumSC += scLine;
      sumVat += vatLine;
      sumRound += roundLine;
      sumTotal += linePortion;
    }
  }

  if (orders.length > 0) {
    rows.push([]);
    const footer: (string | number)[] = [];
    if (opts.includeDate) footer.push("");
    footer.push(
      `รวม ${orders.length} ออร์เดอร์`, "", "", "",
      Number(sumDiscount.toFixed(2)),
      Number(sumNet.toFixed(2)),
      Number(sumSC.toFixed(2)),
      Number(sumVat.toFixed(2)),
      Number(sumRound.toFixed(2)),
      Number(sumTotal.toFixed(2)),
    );
    for (let i = 0; i < maxPayments; i++) {
      footer.push("");
      footer.push(Number((sumByMethodIdx[i] || 0).toFixed(2)));
    }
    rows.push(footer);
  }

  const sheet = XLSX.utils.aoa_to_sheet(rows);

  const cols: { wch: number }[] = [];
  if (opts.includeDate) cols.push({ wch: 12 }); // วันที่
  cols.push(
    { wch: 16 }, // สาขา
    { wch: 38 }, // รายการ
    { wch: 20 }, // หมวดหมู่ย่อยบริการ
    { wch: 16 }, // ช่าง
    { wch: 12 }, // ส่วนลด
    { wch: 13 }, // Net Total
    { wch: 18 }, // SC 3%
    { wch: 13 }, // VAT 7%
    { wch: 13 }, // ค่าปัดเศษ
    { wch: 13 }, // ยอด
  );
  for (let i = 0; i < maxPayments; i++) {
    cols.push({ wch: 12 });
    cols.push({ wch: 14 });
  }
  sheet["!cols"] = cols;

  // Money columns: discount..total are at base indices 4..9, shifted by 1 when วันที่ is present
  const dateOffset = opts.includeDate ? 1 : 0;
  const moneyColIndexes: number[] = [4, 5, 6, 7, 8, 9].map(c => c + dateOffset);
  const totalColIdx = 9 + dateOffset;
  for (let i = 0; i < maxPayments; i++) {
    moneyColIndexes.push(totalColIdx + 2 + i * 2);
  }

  for (let r = 1; r < rows.length; r++) {
    for (const c of moneyColIndexes) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = sheet[addr];
      if (cell && typeof cell.v === "number") {
        cell.z = MONEY_FMT;
        cell.t = "n";
      }
    }
  }

  const lastColLetter = XLSX.utils.encode_col(header.length - 1);
  sheet["!autofilter"] = { ref: `A1:${lastColLetter}1` };

  // Freeze top row + the first non-date column (so สาขา stays anchored when scrolling).
  const xSplit = opts.includeDate ? 2 : 1;
  (sheet as { "!views"?: unknown[] })["!views"] = [{
    state: "frozen", ySplit: 1, xSplit, topLeftCell: `${XLSX.utils.encode_col(xSplit)}2`, activePane: "bottomRight",
  }];

  return sheet;
}

/**
 * Build the retail-items sheet: one row per retail line sold across all
 * orders, with optional date column for the monthly export.
 */
function buildRetailItemsSheet(
  orders: OrderForExport[],
  opts: { includeDate: boolean },
): XLSX.WorkSheet {
  const header: string[] = [];
  if (opts.includeDate) header.push("วันที่");
  header.push("สาขา", "ชื่อสินค้า", "จำนวน", "ราคา/หน่วย (฿)", "รวม (฿)", "ช่าง");

  const rows: (string | number)[][] = [header];

  let totalQty = 0;
  let totalAmount = 0;

  for (const o of orders) {
    const branchName = o.branch?.name ?? "";
    const techName = o.technician.name;
    const dateStr = ymd(new Date(o.completedAt || o.createdAt));
    for (const ri of o.retailItems) {
      const line = ri.price * ri.quantity;
      const row: (string | number)[] = [];
      if (opts.includeDate) row.push(dateStr);
      row.push(
        branchName,
        ri.retailProduct.name,
        ri.quantity,
        Number(ri.price.toFixed(2)),
        Number(line.toFixed(2)),
        techName,
      );
      rows.push(row);
      totalQty += ri.quantity;
      totalAmount += line;
    }
  }

  if (rows.length > 1) {
    rows.push([]);
    const footer: (string | number)[] = [];
    if (opts.includeDate) footer.push("");
    footer.push("รวม", "", totalQty, "", Number(totalAmount.toFixed(2)), "");
    rows.push(footer);
  }

  const sheet = XLSX.utils.aoa_to_sheet(rows);
  const cols: { wch: number }[] = [];
  if (opts.includeDate) cols.push({ wch: 12 });
  cols.push(
    { wch: 16 }, // สาขา
    { wch: 38 }, // ชื่อสินค้า
    { wch: 8 },  // จำนวน
    { wch: 14 }, // ราคา/หน่วย
    { wch: 14 }, // รวม
    { wch: 16 }, // ช่าง
  );
  sheet["!cols"] = cols;

  // Money columns: ราคา/หน่วย (col 3) and รวม (col 4), shifted by 1 when วันที่ is present
  const dateOffset = opts.includeDate ? 1 : 0;
  const moneyColIndexes = [3, 4].map(c => c + dateOffset);
  for (let r = 1; r < rows.length; r++) {
    for (const c of moneyColIndexes) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = sheet[addr];
      if (cell && typeof cell.v === "number") {
        cell.z = MONEY_FMT;
        cell.t = "n";
      }
    }
  }

  const lastColLetter = XLSX.utils.encode_col(header.length - 1);
  sheet["!autofilter"] = { ref: `A1:${lastColLetter}1` };
  const xSplit = opts.includeDate ? 2 : 1;
  (sheet as { "!views"?: unknown[] })["!views"] = [{
    state: "frozen", ySplit: 1, xSplit, topLeftCell: `${XLSX.utils.encode_col(xSplit)}2`, activePane: "bottomRight",
  }];

  return sheet;
}

function buildWorkbook(orders: OrderForExport[], opts: { includeDate: boolean }): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, buildServicesSheet(orders, opts), "บริการ");
  XLSX.utils.book_append_sheet(wb, buildRetailItemsSheet(orders, opts), "สินค้า");
  return wb;
}

/** Daily export — บริการ + สินค้า sheets, no วันที่ column. */
export function exportDailyXlsx(orders: OrderForExport[], date: Date, filename?: string) {
  const wb = buildWorkbook(orders, { includeDate: false });
  XLSX.writeFile(wb, filename || `รายงานรายวัน-${ymd(date)}.xlsx`);
}

/** Monthly export — same layout as daily, with a leading วันที่ column. */
export function exportMonthlyXlsx(
  orders: OrderForExport[],
  period: { month: number; year: number },
  filename?: string,
) {
  const wb = buildWorkbook(orders, { includeDate: true });
  const name = filename || `รายงานรายเดือน-${period.year}-${String(period.month).padStart(2, "0")}.xlsx`;
  XLSX.writeFile(wb, name);
}
