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
  items: { service: { name: string }; price: number }[];
  retailItems: { retailProduct: { name: string }; quantity: number; price: number }[];
  payments: { method: string; amount: number }[];
};

export type BranchInfo = { id: string; name: string };

const METHOD_LABEL: Record<string, string> = {
  CASH: "เงินสด",
  TRANSFER: "โอน",
  CREDIT_CARD: "บัตรเครดิต",
  WALLET: "Wallet",
  TICKET: "Ticket",
};

const MONEY_FMT = "#,##0.00";

function safeSheetName(name: string, used: Set<string>): string {
  let base = name.replace(/[:\\/?*[\]]/g, "_").slice(0, 31);
  if (!base) base = "Sheet";
  let candidate = base;
  let n = 2;
  while (used.has(candidate)) {
    const suffix = ` (${n++})`;
    candidate = base.slice(0, 31 - suffix.length) + suffix;
  }
  used.add(candidate);
  return candidate;
}

function ymd(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Build one worksheet for a single branch's orders.
 *
 * Layout: each order is split into rows — one combined services row (qty="-")
 * plus one row per retail line (qty=quantity). All money columns are
 * proportionally allocated by `line_raw / (subtotal + retailSubtotal)` so
 * summing any column vertically equals the corresponding order total.
 * Payment columns expand to `2 × max(payments)` so split payments stay readable.
 *
 * Readability tweaks (limited by community `xlsx` 0.18.5):
 *   • Number format `#,##0.00` on all money cells
 *   • Autofilter on the header
 *   • Frozen top row + frozen "customer" column
 *   • Sensible column widths
 *   • Distinct footer row with column totals
 */
function buildBranchSheet(
  orders: OrderForExport[],
  opts: { includeDate: boolean },
): XLSX.WorkSheet {
  const maxPayments = Math.max(1, ...orders.map(o => o.payments.length));
  const header: string[] = [];
  if (opts.includeDate) header.push("วันที่");
  header.push(
    "ลูกค้า", "รายการ", "จำนวน", "ช่าง",
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
    const lines: { label: string; qty: number | string; raw: number }[] = [];
    if (o.items.length > 0) {
      lines.push({
        label: o.items.map(i => i.service.name).join(", "),
        qty: "-",
        raw: o.subtotal,
      });
    }
    for (const ri of o.retailItems) {
      lines.push({
        label: ri.retailProduct.name,
        qty: ri.quantity,
        raw: ri.price * ri.quantity,
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
        o.customerName,
        line.label,
        line.qty,
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

  // Footer
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

  // Column widths
  const cols: { wch: number }[] = [];
  if (opts.includeDate) cols.push({ wch: 12 });
  cols.push(
    { wch: 20 }, // ลูกค้า
    { wch: 38 }, // รายการ
    { wch: 8 },  // จำนวน
    { wch: 16 }, // ช่าง
    { wch: 12 }, // ส่วนลด
    { wch: 13 }, // Net Total
    { wch: 18 }, // SC 3%
    { wch: 13 }, // VAT 7%
    { wch: 13 }, // ค่าปัดเศษ
    { wch: 13 }, // ยอด
  );
  for (let i = 0; i < maxPayments; i++) {
    cols.push({ wch: 12 }); // วิธีชำระ
    cols.push({ wch: 14 }); // ยอดชำระ
  }
  sheet["!cols"] = cols;

  // Apply number format to money columns
  const dateOffset = opts.includeDate ? 1 : 0;
  // Static money columns are at indices 5..9 relative to (date?, customer, item, qty, tech) layout
  // 0-indexed: [date?, customer(0+d), item(1+d), qty(2+d), tech(3+d),
  //             discount(4+d), net(5+d), sc(6+d), vat(7+d), round(8+d), total(9+d), ...payments]
  const moneyColIndexes: number[] = [4, 5, 6, 7, 8, 9].map(c => c + dateOffset);
  // Payment amount columns (every "ยอดชำระ"): they sit at total+2, total+4, ...
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

  // Auto-filter on header
  const lastColLetter = XLSX.utils.encode_col(header.length - 1);
  sheet["!autofilter"] = { ref: `A1:${lastColLetter}1` };

  // Freeze top row + the customer column (so date stays visible too if present)
  const ySplit = 1;
  const xSplit = opts.includeDate ? 2 : 1;
  const topLeftCell = `${XLSX.utils.encode_col(xSplit)}2`;
  // xlsx 0.18 typings don't export the SheetView shape; cast through unknown.
  (sheet as { "!views"?: unknown[] })["!views"] = [{
    state: "frozen", ySplit, xSplit, topLeftCell, activePane: "bottomRight",
  }];

  return sheet;
}

/** Group helper. */
function groupByBranch(orders: OrderForExport[]): Map<string, OrderForExport[]> {
  const map = new Map<string, OrderForExport[]>();
  for (const o of orders) {
    if (!map.has(o.branchId)) map.set(o.branchId, []);
    map.get(o.branchId)!.push(o);
  }
  return map;
}

function buildWorkbook(
  orders: OrderForExport[],
  branches: BranchInfo[],
  opts: { includeDate: boolean },
): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  const used = new Set<string>();
  const byBranch = groupByBranch(orders);
  for (const branch of branches) {
    const list = byBranch.get(branch.id) || [];
    const sheet = buildBranchSheet(list, opts);
    XLSX.utils.book_append_sheet(wb, sheet, safeSheetName(branch.name, used));
  }
  return wb;
}

/** Daily export — one sheet per branch, no date column (single day). */
export function exportDailyByBranchXlsx(
  orders: OrderForExport[],
  branches: BranchInfo[],
  date: Date,
  filename?: string,
) {
  const wb = buildWorkbook(orders, branches, { includeDate: false });
  XLSX.writeFile(wb, filename || `รายงานรายวัน-${ymd(date)}.xlsx`);
}

/** Monthly export — one sheet per branch, with a leading "วันที่" column. */
export function exportMonthlyByBranchXlsx(
  orders: OrderForExport[],
  branches: BranchInfo[],
  period: { month: number; year: number },
  filename?: string,
) {
  const wb = buildWorkbook(orders, branches, { includeDate: true });
  const name = filename || `รายงานรายเดือน-${period.year}-${String(period.month).padStart(2, "0")}.xlsx`;
  XLSX.writeFile(wb, name);
}

// Backwards-compat alias for callers still importing the old type name.
// (Daily export button uses this — no behavior change.)
export type DailyOrderForExport = OrderForExport;
