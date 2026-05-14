import * as XLSX from "xlsx";

export type OrderForExport = {
  id: string;
  receiptNumber?: number | null;
  receiptType?: string | null;
  completedAt?: string | null;
  createdAt: string;
  customerName: string;
  customerPhone?: string | null;
  total: number;
  subtotal: number;
  retailSubtotal: number;
  discountAmount: number;
  serviceCharge: number;
  vat: number;
  roundingAdjustment?: number;
  technician: { name: string };
  assistants?: { user: { name: string } }[];
  items: { service: { name: string }; price: number }[];
  payments: { method: string; amount: number }[];
};

const METHOD_LABEL: Record<string, string> = {
  CASH: "เงินสด",
  TRANSFER: "โอน",
  CREDIT_CARD: "บัตรเครดิต",
  WALLET: "Wallet",
  TICKET: "Ticket",
};

function pad4(n: number) { return String(n).padStart(4, "0"); }
function formatReceiptNo(seq: number, type: string | null | undefined, completedAt: string | Date | null | undefined) {
  if (!completedAt || !seq || !type) return "ยังไม่พิมพ์";
  const d = new Date(completedAt);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = String(d.getFullYear());
  if (type === "FULL") return `LNDSFULL${yyyy}${mm}${dd}${pad4(seq)}`;
  return `LNDS${pad4(seq)}${dd}${mm}${yyyy}`;
}

export function exportTransactionsXlsx(
  orders: OrderForExport[],
  period: { month: number; year: number },
  filename?: string,
) {
  const rows: (string | number)[][] = [];

  rows.push([
    "วันที่", "เลขใบเสร็จ", "ลูกค้า", "เบอร์โทร", "ช่างหลัก", "ผู้ช่วย",
    "บริการ",
    "ส่วนลด (฿)", "Net Total (฿)", "Service Charge 3% (฿)", "VAT 7% (฿)", "ค่าปัดเศษ (฿)", "รวมทั้งสิ้น (฿)",
    "วิธีชำระเงิน",
  ]);

  let sumNet = 0, sumSC = 0, sumVat = 0, sumRound = 0, sumTotal = 0, sumDiscount = 0;

  for (const o of orders) {
    const refDate = o.completedAt || o.createdAt;
    const dateStr = new Date(refDate).toLocaleDateString("th-TH", { year: "numeric", month: "2-digit", day: "2-digit" });
    const rounding = o.roundingAdjustment || 0;
    const net = o.total - (o.vat || 0) - (o.serviceCharge || 0) - rounding;
    const services = o.items.map(i => i.service.name).join(", ");
    const assistants = (o.assistants || []).map(a => a.user.name).join(", ");
    const payments = o.payments.map(p => `${METHOD_LABEL[p.method] ?? p.method} ฿${p.amount.toLocaleString()}`).join(" + ");

    rows.push([
      dateStr,
      formatReceiptNo(o.receiptNumber || 0, o.receiptType, refDate),
      o.customerName,
      o.customerPhone || "",
      o.technician.name,
      assistants || "—",
      services,
      Number((o.discountAmount || 0).toFixed(2)),
      Number(net.toFixed(2)),
      Number((o.serviceCharge || 0).toFixed(2)),
      Number((o.vat || 0).toFixed(2)),
      Number(rounding.toFixed(2)),
      Number(o.total.toFixed(2)),
      payments,
    ]);

    sumNet += net;
    sumSC += o.serviceCharge || 0;
    sumVat += o.vat || 0;
    sumRound += rounding;
    sumTotal += o.total;
    sumDiscount += o.discountAmount || 0;
  }

  // Blank row + summary row
  rows.push([]);
  rows.push([
    "",
    "",
    "",
    "",
    "",
    "",
    `รวมทั้งหมด (${orders.length} รายการ)`,
    Number(sumDiscount.toFixed(2)),
    Number(sumNet.toFixed(2)),
    Number(sumSC.toFixed(2)),
    Number(sumVat.toFixed(2)),
    Number(sumRound.toFixed(2)),
    Number(sumTotal.toFixed(2)),
    "",
  ]);

  const sheet = XLSX.utils.aoa_to_sheet(rows);

  // Column widths
  sheet["!cols"] = [
    { wch: 12 }, // วันที่
    { wch: 22 }, // เลขใบเสร็จ
    { wch: 18 }, // ลูกค้า
    { wch: 13 }, // เบอร์โทร
    { wch: 14 }, // ช่างหลัก
    { wch: 14 }, // ผู้ช่วย
    { wch: 30 }, // บริการ
    { wch: 12 }, // ส่วนลด
    { wch: 14 }, // Net
    { wch: 14 }, // SC
    { wch: 12 }, // VAT
    { wch: 12 }, // ค่าปัดเศษ
    { wch: 14 }, // รวม
    { wch: 28 }, // วิธีชำระ
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, "Transactions");

  const name = filename || `report-${period.year}-${String(period.month).padStart(2, "0")}.xlsx`;
  XLSX.writeFile(wb, name);
}
