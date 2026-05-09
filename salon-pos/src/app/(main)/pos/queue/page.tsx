"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

/* ─────────────────────────── types ─────────────────────────── */
type OrderSummary = {
  id: string; customerName: string; customerPhone?: string; status: string;
  subtotal: number; total: number; createdAt: string; notes?: string;
  technician: { name: string };
  items: { service: { name: string }; price: number }[];
  chemicals: { product: { name: string }; amountMg: number }[];
};

type OrderDetail = {
  id: string; customerId?: string; customerName: string; customerPhone?: string;
  subtotal: number; retailSubtotal: number; total: number; discountAmount: number; status: string; createdAt: string;
  customer?: { id: string; name: string; walletBalance: number };
  technician: { name: string };
  items: { id: string; serviceId: string; service: { id: string; name: string }; price: number }[];
  retailItems: { id: string; retailProductId: string; quantity: number; price: number; retailProduct: { name: string } }[];
  chemicals: { product: { name: string }; amountMg: number; totalCost: number }[];
};

type Payment = { method: string; amount: number };

type CustomerTicket = {
  id: string;
  isUsed: boolean;
  ticketDef: {
    id: string;
    name: string;
    type: string;
    serviceId?: string | null;
    discountPct?: number | null;
    fixedValue?: number | null;
    service?: { name: string } | null;
  };
};

type RetailProduct = { id: string; name: string; price: number; stock: number };
type RetailLine = { retailProductId: string; name: string; price: number; quantity: number };

type ReceiptData = {
  order: OrderDetail; finalTotal: number; change: number;
  payments: Payment[]; paidAt: Date; receiptNumber: number;
};

/* ─────────────────────────── constants ─────────────────────── */
const STATUS_LABEL: Record<string, string> = { WAITING: "รอคิว", IN_PROGRESS: "กำลังทำ", DONE: "รอชำระเงิน", PAID: "ชำระเงินแล้ว", CANCELLED: "ยกเลิกรายการ" };
const STATUS_COLOR: Record<string, string> = { WAITING: "#856404", IN_PROGRESS: "#004085", DONE: "#856404", PAID: "#155724", CANCELLED: "#721c24" };
const STATUS_BG: Record<string, string> = { WAITING: "#FFF3CD", IN_PROGRESS: "#CCE5FF", DONE: "#FFF3CD", PAID: "#D4EDDA", CANCELLED: "#F8D7DA" };
const METHOD_LABEL: Record<string, string> = { CASH: "เงินสด", TRANSFER: "โอนเงิน (QR)", WALLET: "Wallet", TICKET: "Ticket/คูปอง" };

/* ─────────────────────────── helper: receipt number formatter ─────── */
function pad4(n: number): string {
  return String(n).padStart(4, "0");
}

function formatReceiptNo(seq: number, mode: "SHORT" | "FULL", date: Date): string {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = String(date.getFullYear());
  if (mode === "SHORT") return `LNDS${pad4(seq)}${dd}${mm}${yyyy}`;
  return `LNDSFULL${yyyy}${mm}${dd}${pad4(seq)}`;
}

/* ─────────────────────────── company info ─────── */
const COMPANY = {
  name: "บริษัท ลานนาดีเซีย กรุ๊ป จำกัด",
  taxId: "0505567002730",
  address: "119/2 หมู่บ้านใจแก้เอราวัณ 23 หมู่ 3 ตำบล หนองหอย อำเภอ เมืองเชียงใหม่ จังหวัด เชียงใหม่ 50000",
  shortName: "บ.ลานนาดีเซีย กรุ๊ป",
};

/* ─────────────────────────── helper: build receipt html ─────── */
function buildReceiptHtml(r: ReceiptData, mode: "SHORT" | "FULL", taxId: string, fullCustomerName?: string): string {
  const date = r.paidAt.toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" });
  const time = r.paidAt.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
  const receiptNo = formatReceiptNo(r.receiptNumber, mode, r.paidAt);

  if (mode === "SHORT") {
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>ใบเสร็จ ${receiptNo}</title>
<style>body{font-family:sans-serif;margin:24px;font-size:13px;max-width:320px}
h2,h3{text-align:center;margin:4px 0}p{margin:3px 0}
.line{border-top:1px dashed #555;margin:8px 0}
table{width:100%;border-collapse:collapse}td{padding:2px 0}
.r{text-align:right}.b{font-weight:700}.sm{font-size:11px;color:#555}
.no{text-align:center;font-family:monospace;font-size:12px;letter-spacing:0.5px;background:#f5f5f5;padding:4px;border-radius:4px;margin:6px 0}
.shop{text-align:center;font-size:11px;color:#666;line-height:1.4}
</style></head><body>
<h2>${COMPANY.name}</h2>
<div class="shop">${COMPANY.address}</div>
<div class="shop">เลขผู้เสียภาษี: ${COMPANY.taxId}</div>
<h3>ใบเสร็จรับเงิน (อย่างย่อ)</h3>
<div class="no">${receiptNo}</div>
<div class="line"></div>
<p>วันที่: ${date} ${time}</p>
<p>ลูกค้า: ${r.order.customerName}</p>
${r.order.customerPhone ? `<p>โทร: ${r.order.customerPhone}</p>` : ""}
<p class="sm">ช่าง: ${r.order.technician.name}</p>
<div class="line"></div>
<table>
${r.order.items.map(i => `<tr><td>${i.service.name}</td><td class="r">฿${i.price.toLocaleString()}</td></tr>`).join("")}
</table>
<div class="line"></div>
<table>
<tr><td>ราคาก่อนส่วนลด</td><td class="r">฿${r.order.subtotal.toLocaleString()}</td></tr>
${r.order.discountAmount > 0 ? `<tr><td>ส่วนลด</td><td class="r" style="color:red">-฿${r.order.discountAmount.toLocaleString()}</td></tr>` : ""}
<tr class="b"><td>ยอดสุทธิ</td><td class="r">฿${r.finalTotal.toLocaleString()}</td></tr>
</table>
<div class="line"></div>
${r.payments.map(p => `<p>${METHOD_LABEL[p.method] ?? p.method}: ฿${p.amount.toLocaleString()}</p>`).join("")}
${r.change > 0 ? `<p class="b">เงินทอน: ฿${r.change.toLocaleString()}</p>` : ""}
<div class="line"></div>
<p style="text-align:center;font-size:12px">ขอบคุณที่ใช้บริการค่ะ 🙏</p>
</body></html>`;
  }

  // FULL TAX INVOICE — A4 layout
  const subtotalNet = r.finalTotal / 1.07;
  const vatAmount = r.finalTotal - subtotalNet;
  const itemsRows = r.order.items.map((i, idx) => `
    <tr>
      <td class="c">${idx + 1}</td>
      <td>${i.service.name}</td>
      <td class="c">1</td>
      <td class="r">${(i.price / 1.07).toFixed(2)}</td>
      <td class="r">${(i.price / 1.07).toFixed(2)}</td>
    </tr>`).join("");

  const buyerName = (fullCustomerName && fullCustomerName.trim()) || r.order.customerName;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>ใบกำกับภาษี ${receiptNo}</title>
<style>
@page { size: A4; margin: 1.5cm; }
* { box-sizing: border-box; }
body { font-family: "Sarabun", "TH Sarabun New", sans-serif; margin: 0; font-size: 13px; color: #222; }
.page { width: 100%; max-width: 18cm; margin: 0 auto; }
.header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #333; padding-bottom: 12px; margin-bottom: 16px; }
.shop-info h1 { margin: 0 0 4px; font-size: 20px; color: #333; }
.shop-info p { margin: 2px 0; font-size: 12px; color: #555; }
.doc-info { text-align: right; }
.doc-info h2 { margin: 0; font-size: 18px; color: #333; }
.doc-info .badge { background: #333; color: white; padding: 4px 12px; border-radius: 4px; font-size: 11px; margin-top: 4px; display: inline-block; }
.no { font-family: monospace; font-size: 13px; letter-spacing: 1px; margin-top: 6px; }
.parties { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px; }
.party { border: 1px solid #ccc; padding: 10px 12px; border-radius: 4px; background: #fafafa; }
.party h3 { margin: 0 0 6px; font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; }
.party p { margin: 2px 0; font-size: 13px; }
.party .b { font-weight: 700; }
table.items { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
table.items th { background: #333; color: white; padding: 8px 10px; font-size: 12px; text-align: left; }
table.items td { padding: 8px 10px; border-bottom: 1px solid #eee; font-size: 13px; }
table.items td.c { text-align: center; }
table.items td.r { text-align: right; }
.summary { display: flex; justify-content: flex-end; margin-bottom: 24px; }
.summary table { border-collapse: collapse; min-width: 280px; }
.summary td { padding: 4px 8px; }
.summary .label { color: #555; }
.summary .val { text-align: right; min-width: 100px; }
.summary tr.total td { border-top: 2px solid #333; font-weight: 700; font-size: 15px; padding-top: 8px; }
.signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 50px; }
.sig { text-align: center; }
.sig .line { border-top: 1px solid #999; margin-bottom: 6px; }
.sig small { color: #666; }
.footer { text-align: center; margin-top: 30px; padding-top: 12px; border-top: 1px solid #ddd; font-size: 11px; color: #888; }
</style></head><body>
<div class="page">
  <div class="header">
    <div class="shop-info">
      <h1>${COMPANY.name}</h1>
      <p>${COMPANY.address}</p>
      <p><strong>เลขประจำตัวผู้เสียภาษี:</strong> ${COMPANY.taxId}</p>
    </div>
    <div class="doc-info">
      <h2>ใบกำกับภาษี</h2>
      <div class="badge">ต้นฉบับ / Original</div>
      <div class="no">เลขที่: ${receiptNo}</div>
      <div style="font-size:12px;color:#666;margin-top:4px">วันที่: ${date}</div>
      <div style="font-size:12px;color:#666">เวลา: ${time}</div>
    </div>
  </div>

  <div class="parties">
    <div class="party">
      <h3>ผู้ขาย / Seller</h3>
      <p class="b">${COMPANY.name}</p>
      <p>${COMPANY.address}</p>
      <p>เลขผู้เสียภาษี: ${COMPANY.taxId}</p>
    </div>
    <div class="party">
      <h3>ผู้ซื้อ / Customer</h3>
      <p class="b">${buyerName}</p>
      ${r.order.customerPhone ? `<p>โทร: ${r.order.customerPhone}</p>` : ""}
      ${taxId ? `<p>เลขผู้เสียภาษี: ${taxId}</p>` : ""}
    </div>
  </div>

  <table class="items">
    <thead>
      <tr>
        <th style="width:40px">#</th>
        <th>รายการ / Description</th>
        <th class="c" style="width:60px">จำนวน</th>
        <th class="r" style="width:100px">ราคา/หน่วย</th>
        <th class="r" style="width:120px">จำนวนเงิน</th>
      </tr>
    </thead>
    <tbody>
      ${itemsRows}
    </tbody>
  </table>

  <div class="summary">
    <table>
      <tr><td class="label">มูลค่าสินค้า/บริการ</td><td class="val">${subtotalNet.toFixed(2)} บาท</td></tr>
      ${r.order.discountAmount > 0 ? `<tr><td class="label">ส่วนลด</td><td class="val" style="color:#c00">-${r.order.discountAmount.toFixed(2)} บาท</td></tr>` : ""}
      <tr><td class="label">ภาษีมูลค่าเพิ่ม 7%</td><td class="val">${vatAmount.toFixed(2)} บาท</td></tr>
      <tr class="total"><td>รวมทั้งสิ้น</td><td class="val">${r.finalTotal.toFixed(2)} บาท</td></tr>
    </table>
  </div>

  <div style="font-size:12px;color:#555;margin-bottom:8px">
    ชำระโดย: ${r.payments.map(p => `${METHOD_LABEL[p.method] ?? p.method} ฿${p.amount.toLocaleString()}`).join(", ")}
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
    เอกสารนี้พิมพ์จากระบบคอมพิวเตอร์ของ ${COMPANY.name} — ${receiptNo}
  </div>
</div>
</body></html>`;
}

/* ─────────────────────────── main component ─────────────────── */
export default function QueuePage() {
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(true);

  /* alert modal */
  const [alertMsg, setAlertMsg] = useState<string | null>(null);
  const showAlert = (msg: string) => setAlertMsg(msg);

  /* checkout modal */
  const [checkoutOrder, setCheckoutOrder] = useState<OrderDetail | null>(null);
  const [loadingCheckout, setLoadingCheckout] = useState(false);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [discountPct, setDiscountPct] = useState(0);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [approvedById, setApprovedById] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  /* coupon/ticket */
  const [customerTickets, setCustomerTickets] = useState<CustomerTicket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<CustomerTicket | null>(null);

  /* retail products */
  const [retailProducts, setRetailProducts] = useState<RetailProduct[]>([]);
  const [retailLines, setRetailLines] = useState<RetailLine[]>([]);
  const [retailPickerOpen, setRetailPickerOpen] = useState(false);

  /* PIN modal (discount approval) */
  const [showPinModal, setShowPinModal] = useState(false);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");

  /* receipt modal */
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [receiptMode, setReceiptMode] = useState<"SHORT" | "FULL">("SHORT");
  const [taxId, setTaxId] = useState("");
  const [fullCustomerName, setFullCustomerName] = useState("");

  /* ── queue load ── */
  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/orders?status=WAITING,IN_PROGRESS,DONE,PAID,CANCELLED");
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data)) setOrders(data);
    } catch {
      // transient network error (e.g. dev server restart) — ignore and retry on next interval
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, [load]);

  async function updateStatus(id: string, status: string) {
    await fetch(`/api/orders/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    await load();
  }

  /* ── open checkout ── */
  async function openCheckout(orderId: string) {
    setLoadingCheckout(true);
    const res = await fetch(`/api/orders/${orderId}`);
    const order: OrderDetail = await res.json();
    setCheckoutOrder(order);
    const initialBase = order.subtotal + (order.retailSubtotal || 0);
    setPayments([{ method: "TRANSFER", amount: initialBase + Math.round(initialBase * 0.07) }]);
    setDiscountAmount(0);
    setDiscountPct(0);
    setApprovedById(null);
    setSelectedTicket(null);
    setCustomerTickets([]);
    setRetailLines([]);
    setRetailPickerOpen(false);
    if (order.customerId) {
      const tRes = await fetch(`/api/tickets?customerId=${order.customerId}`);
      const all: CustomerTicket[] = await tRes.json();
      setCustomerTickets(all.filter(t => !t.isUsed));
    }
    const rRes = await fetch("/api/retail-products");
    setRetailProducts(await rRes.json());
    setLoadingCheckout(false);
  }

  function closeCheckout() {
    setCheckoutOrder(null);
    setPayments([]);
    setDiscountAmount(0);
    setDiscountPct(0);
    setApprovedById(null);
    setSelectedTicket(null);
    setCustomerTickets([]);
    setRetailLines([]);
    setRetailPickerOpen(false);
  }

  function addRetail(p: RetailProduct) {
    setRetailLines(prev => {
      const existing = prev.find(l => l.retailProductId === p.id);
      let next: RetailLine[];
      if (existing) {
        next = prev.map(l => l.retailProductId === p.id ? { ...l, quantity: l.quantity + 1 } : l);
      } else {
        next = [...prev, { retailProductId: p.id, name: p.name, price: p.price, quantity: 1 }];
      }
      recalcPaymentForRetail(next);
      return next;
    });
    setRetailPickerOpen(false);
  }

  function updateRetailQty(productId: string, qty: number) {
    setRetailLines(prev => {
      const next = qty <= 0
        ? prev.filter(l => l.retailProductId !== productId)
        : prev.map(l => l.retailProductId === productId ? { ...l, quantity: qty } : l);
      recalcPaymentForRetail(next);
      return next;
    });
  }

  function recalcPaymentForRetail(lines: RetailLine[]) {
    if (!checkoutOrder) return;
    const retailSub = lines.reduce((s, l) => s + l.price * l.quantity, 0);
    const tDiscount = getTicketDiscount(selectedTicket, checkoutOrder);
    setPayments(prev => {
      if (prev.length !== 1) return prev;
      const base = Math.max(0, checkoutOrder.subtotal + (checkoutOrder.retailSubtotal || 0) + retailSub - discountAmount - tDiscount);
      const hasCC = prev[0].method === "CREDIT_CARD";
      const sc = hasCC ? Math.round(base * 0.03) : 0;
      const v = Math.round((base + sc) * 0.07);
      return [{ ...prev[0], amount: base + sc + v }];
    });
  }

  function getTicketDiscount(ticket: CustomerTicket | null, order: OrderDetail | null): number {
    if (!ticket || !order) return 0;
    const def = ticket.ticketDef;
    if (def.type === "FIXED") return def.fixedValue || 0;
    if (def.type === "SERVICE" && def.serviceId) {
      const item = order.items.find(i => i.serviceId === def.serviceId);
      return item ? item.price * ((def.discountPct ?? 100) / 100) : 0;
    }
    return 0;
  }

  function ticketDefLabel(def: CustomerTicket["ticketDef"]) {
    if (def.type === "FIXED") return `ลด ฿${(def.fixedValue || 0).toLocaleString()}`;
    const pct = def.discountPct ?? 100;
    return pct === 100 ? `${def.service?.name || ""} ฟรี` : `${def.service?.name || ""} ลด ${pct}%`;
  }

  function applyTicket(ticket: CustomerTicket) {
    if (!checkoutOrder) return;
    setSelectedTicket(ticket);
    const tDiscount = getTicketDiscount(ticket, checkoutOrder);
    const rSub = retailLines.reduce((s, l) => s + l.price * l.quantity, 0);
    setPayments(prev => {
      if (prev.length !== 1) return prev;
      const base = Math.max(0, checkoutOrder.subtotal + (checkoutOrder.retailSubtotal || 0) + rSub - discountAmount - tDiscount);
      const hasCC = prev[0].method === "CREDIT_CARD";
      const sc = hasCC ? Math.round(base * 0.03) : 0;
      const v = Math.round((base + sc) * 0.07);
      return [{ ...prev[0], amount: base + sc + v }];
    });
  }

  function removeTicket() {
    if (!checkoutOrder) return;
    setSelectedTicket(null);
    const rSub = retailLines.reduce((s, l) => s + l.price * l.quantity, 0);
    setPayments(prev => {
      if (prev.length !== 1) return prev;
      const base = Math.max(0, checkoutOrder.subtotal + (checkoutOrder.retailSubtotal || 0) + rSub - discountAmount);
      const hasCC = prev[0].method === "CREDIT_CARD";
      const sc = hasCC ? Math.round(base * 0.03) : 0;
      const v = Math.round((base + sc) * 0.07);
      return [{ ...prev[0], amount: base + sc + v }];
    });
  }

  /* ── discount ── */
  function handleDiscountChange(val: number, type: "amount" | "pct") {
    if (!checkoutOrder) return;
    let newDiscount = 0;
    if (type === "amount") {
      newDiscount = val;
      setDiscountAmount(val);
      setDiscountPct(checkoutOrder.subtotal > 0 ? (val / checkoutOrder.subtotal) * 100 : 0);
    } else {
      newDiscount = (checkoutOrder.subtotal * val) / 100;
      setDiscountPct(val);
      setDiscountAmount(newDiscount);
    }

    const tDiscount = getTicketDiscount(selectedTicket, checkoutOrder);
    const rSub = retailLines.reduce((s, l) => s + l.price * l.quantity, 0);
    setPayments(prev => {
      if (prev.length === 1) {
        const base = Math.max(0, checkoutOrder.subtotal + (checkoutOrder.retailSubtotal || 0) + rSub - newDiscount - tDiscount);
        const hasCC = prev[0].method === "CREDIT_CARD";
        const sc = hasCC ? Math.round(base * 0.03) : 0;
        const v = Math.round((base + sc) * 0.07);
        return [{ ...prev[0], amount: base + sc + v }];
      }
      return prev;
    });

    if (val > 0 && !approvedById) {
      setShowPinModal(true);
    }
  }

  /* ── PIN ── */
  async function verifyPin() {
    setPinError("");
    const res = await fetch("/api/verify-pin", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "MANAGER", pin }),
    });
    const data = await res.json();
    if (data.ok) {
      setApprovedById(data.userId ?? null);
      setShowPinModal(false); setPin("");
    } else {
      setPinError("PIN ไม่ถูกต้อง");
    }
  }

  /* ── checkout submit ── */
  const ticketDiscount = getTicketDiscount(selectedTicket, checkoutOrder);
  const retailSubtotal = retailLines.reduce((s, l) => s + l.price * l.quantity, 0);
  const applicableTickets = customerTickets.filter(t => {
    if (t.ticketDef.type === "FIXED") return true;
    if (t.ticketDef.type === "SERVICE" && t.ticketDef.serviceId) {
      return checkoutOrder?.items.some(i => i.serviceId === t.ticketDef.serviceId);
    }
    return false;
  });
  const baseTotal = checkoutOrder ? Math.max(0, checkoutOrder.subtotal + (checkoutOrder.retailSubtotal || 0) + retailSubtotal - discountAmount - ticketDiscount) : 0;
  const hasCreditCard = payments.some(p => p.method === "CREDIT_CARD");
  const serviceCharge = hasCreditCard ? Math.round(baseTotal * 0.03) : 0;
  const vat = Math.round((baseTotal + serviceCharge) * 0.07);

  const finalTotal = baseTotal + serviceCharge + vat;
  const totalPaid = payments.reduce((s, p) => s + p.amount, 0);
  const change = totalPaid - finalTotal;

  async function handleCheckout() {
    if (!checkoutOrder) return;
    if (change < -0.01) { showAlert("ยอดชำระไม่ครบ กรุณาตรวจสอบ"); return; }
    setProcessing(true);
    const res = await fetch(`/api/orders/${checkoutOrder.id}/checkout`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        payments: payments.filter(p => p.amount > 0),
        discountAmount, discountPct, approvedById,
        serviceCharge, vat,
        ticketId: selectedTicket?.id ?? null,
        ticketDiscount,
        retailItems: retailLines.map(l => ({ retailProductId: l.retailProductId, quantity: l.quantity, price: l.price })),
      }),
    });
    if (res.ok) {
      const data = await res.json();
      const receiptPayload: ReceiptData = {
        order: { ...checkoutOrder, discountAmount },
        finalTotal, change: Math.max(0, change),
        payments: payments.filter(p => p.amount > 0),
        paidAt: new Date(),
        receiptNumber: data.receiptNumber ?? 1,
      };
      closeCheckout();
      setReceipt(receiptPayload);
      setReceiptMode("SHORT");
      setTaxId("");
      setFullCustomerName(checkoutOrder.customerName || "");
      await load();
    } else {
      showAlert("เกิดข้อผิดพลาด กรุณาลองใหม่");
    }
    setProcessing(false);
  }

  /* ── receipt print ── */
  function printReceipt() {
    if (receiptMode === "FULL" && !taxId.trim()) {
      showAlert("กรุณากรอกเลขผู้เสียภาษีก่อนพิมพ์ใบกำกับภาษีเต็ม");
      return;
    }
    if (receiptMode === "FULL" && !fullCustomerName.trim()) {
      showAlert("กรุณากรอกชื่อผู้ซื้อก่อนพิมพ์ใบกำกับภาษีเต็ม");
      return;
    }
    const winSize = receiptMode === "FULL" ? "width=900,height=900" : "width=420,height=640";
    const win = window.open("", "_blank", winSize);
    if (!win || !receipt) return;
    win.document.write(buildReceiptHtml(receipt, receiptMode, taxId, fullCustomerName));
    win.document.close();
    setTimeout(() => win.print(), 400);
  }

  function closeReceipt() {
    setReceipt(null);
    setReceiptMode("SHORT");
    setTaxId("");
    setFullCustomerName("");
  }

  /* ── order card ── */
  function OrderCard({ order }: { order: OrderSummary }) {
    return (
      <div className="card" style={{ marginBottom: "0.75rem", border: `2px solid ${STATUS_BG[order.status]}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
          <div>
            <span style={{ fontWeight: 700 }}>{order.customerName}</span>
            {order.customerPhone && <span style={{ color: "#888", fontSize: "0.8rem", marginLeft: 8 }}>{order.customerPhone}</span>}
          </div>
          <span className="badge" style={{ background: STATUS_BG[order.status], color: STATUS_COLOR[order.status] }}>
            {STATUS_LABEL[order.status]}
          </span>
        </div>
        <div style={{ fontSize: "0.85rem", color: "#555", marginBottom: 6 }}>ช่าง: <strong>{order.technician.name}</strong></div>
        <div style={{ fontSize: "0.85rem", marginBottom: 4 }}>{order.items.map(i => i.service.name).join(" · ")}</div>
        {order.chemicals.length > 0 && (
          <div style={{ fontSize: "0.8rem", color: "#888", marginBottom: 4 }}>
            🧪 {order.chemicals.map(c => `${c.product.name}(${c.amountMg}มก.)`).join(", ")}
          </div>
        )}
        {order.notes && <div style={{ fontSize: "0.8rem", color: "#888", fontStyle: "italic" }}>📝 {order.notes}</div>}
        <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
          {order.status === "WAITING" && (
            <button className="btn-primary" style={{ fontSize: "0.8rem", padding: "4px 12px" }} onClick={() => updateStatus(order.id, "IN_PROGRESS")}>
              เริ่มให้บริการ
            </button>
          )}
          {order.status === "IN_PROGRESS" && (
            <button className="btn-primary" style={{ fontSize: "0.8rem", padding: "4px 12px" }} onClick={() => updateStatus(order.id, "DONE")}>
              ✓ เสร็จแล้ว
            </button>
          )}
          {order.status === "DONE" && (
            <button
              className="btn-primary"
              style={{ fontSize: "0.8rem", padding: "4px 12px", background: "var(--success-green, #2d6a4f)" }}
              onClick={() => openCheckout(order.id)}
              disabled={loadingCheckout}
            >
              💳 ชำระเงิน
            </button>
          )}
          {order.status !== "PAID" && order.status !== "CANCELLED" && (
            <button className="btn-secondary" style={{ fontSize: "0.8rem", padding: "4px 12px" }} onClick={() => updateStatus(order.id, "CANCELLED")}>
              ยกเลิก
            </button>
          )}
          <span style={{ marginLeft: "auto", fontSize: "0.85rem", fontWeight: 600 }}>฿{order.subtotal.toLocaleString()}</span>
        </div>
      </div>
    );
  }

  if (loading) return <div>กำลังโหลด...</div>;

  const waiting = orders.filter(o => o.status === "WAITING");
  const inProgress = orders.filter(o => o.status === "IN_PROGRESS");
  const pendingPayment = orders.filter(o => o.status === "DONE");
  const completed = orders.filter(o => o.status === "PAID" || o.status === "CANCELLED").slice(0, 15);

  /* ── render ── */
  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--olive)", margin: 0 }}>📋 คิวลูกค้า</h1>
        <div style={{ display: "flex", gap: "0.75rem" }}>
          <Link href="/pos/new" className="btn-primary" style={{ textDecoration: "none" }}>+ รับออร์เดอร์ใหม่</Link>
          <button className="btn-secondary" onClick={load}>🔄 รีเฟรช</button>
        </div>
      </div>

      {/* Kanban */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "1rem" }}>
        <div>
          <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "#856404", background: "#FFF3CD", padding: "0.5rem 1rem", borderRadius: 8, marginBottom: "0.75rem" }}>
            ⏳ รอคิว ({waiting.length})
          </h2>
          {waiting.length === 0 ? <p style={{ color: "#aaa", fontSize: "0.875rem" }}>ไม่มีคิวรอ</p> : waiting.map(o => <OrderCard key={o.id} order={o} />)}
        </div>
        <div>
          <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "#004085", background: "#CCE5FF", padding: "0.5rem 1rem", borderRadius: 8, marginBottom: "0.75rem" }}>
            ✂️ กำลังทำ ({inProgress.length})
          </h2>
          {inProgress.length === 0 ? <p style={{ color: "#aaa", fontSize: "0.875rem" }}>ไม่มี</p> : inProgress.map(o => <OrderCard key={o.id} order={o} />)}
        </div>
        <div>
          <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "#856404", background: "#FFF3CD", padding: "0.5rem 1rem", borderRadius: 8, marginBottom: "0.75rem" }}>
            💳 รอชำระเงิน ({pendingPayment.length})
          </h2>
          {pendingPayment.length === 0 ? <p style={{ color: "#aaa", fontSize: "0.875rem" }}>ไม่มี</p> : pendingPayment.map(o => <OrderCard key={o.id} order={o} />)}
        </div>
        <div>
          <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "#155724", background: "#D4EDDA", padding: "0.5rem 1rem", borderRadius: 8, marginBottom: "0.75rem" }}>
            ✓ รายการทำสำเร็จ ({completed.length})
          </h2>
          {completed.length === 0 ? <p style={{ color: "#aaa", fontSize: "0.875rem" }}>ไม่มี</p> : completed.map(o => <OrderCard key={o.id} order={o} />)}
        </div>
      </div>

      {/* ══════════════ CHECKOUT MODAL ══════════════ */}
      {checkoutOrder && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 680, width: "95vw", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h3 style={{ margin: 0, color: "var(--olive)" }}>💳 ชำระเงิน — {checkoutOrder.customerName}</h3>
              <button onClick={closeCheckout} style={{ background: "none", border: "none", fontSize: "1.4rem", cursor: "pointer", color: "#aaa", lineHeight: 1 }}>×</button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              {/* Left: order summary + discount */}
              <div>
                <div style={{ marginBottom: "0.75rem", background: "var(--beige)", borderRadius: 8, padding: "0.75rem" }}>
                  <div style={{ fontWeight: 600, fontSize: "0.85rem", marginBottom: 6, color: "var(--olive)" }}>รายการบริการ</div>
                  {checkoutOrder.items.map((item, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.875rem", marginBottom: 3 }}>
                      <span>{item.service.name}</span>
                      <span>฿{item.price.toLocaleString()}</span>
                    </div>
                  ))}
                  <div style={{ borderTop: "1px solid var(--beige-dark)", marginTop: 6, paddingTop: 6, display: "flex", justifyContent: "space-between", fontWeight: 700 }}>
                    <span>รวม</span><span>฿{checkoutOrder.subtotal.toLocaleString()}</span>
                  </div>
                </div>

                {/* Retail Products */}
                <div style={{ marginBottom: "0.75rem", background: "var(--beige)", borderRadius: 8, padding: "0.75rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <div style={{ fontWeight: 600, fontSize: "0.85rem", color: "var(--olive)" }}>🛍️ สินค้า Retail</div>
                    <button
                      onClick={() => setRetailPickerOpen(!retailPickerOpen)}
                      style={{ background: "var(--olive)", color: "white", border: "none", borderRadius: 6, padding: "3px 10px", cursor: "pointer", fontSize: "0.75rem" }}
                    >
                      {retailPickerOpen ? "ปิด" : "+ เพิ่ม"}
                    </button>
                  </div>

                  {retailPickerOpen && (
                    <div style={{ marginBottom: 6, background: "white", borderRadius: 6, maxHeight: 160, overflowY: "auto", border: "1px solid var(--beige-dark)" }}>
                      {retailProducts.length === 0 ? (
                        <p style={{ fontSize: "0.8rem", color: "#aaa", padding: "0.5rem", margin: 0, textAlign: "center" }}>ยังไม่มีสินค้า — เพิ่มได้ที่ Settings → สินค้า Retail</p>
                      ) : retailProducts.map(p => {
                        const inCart = retailLines.find(l => l.retailProductId === p.id);
                        const remain = p.stock - (inCart?.quantity || 0);
                        return (
                          <div key={p.id}
                            onClick={() => remain > 0 && addRetail(p)}
                            style={{
                              display: "flex", justifyContent: "space-between", alignItems: "center",
                              padding: "0.4rem 0.6rem", cursor: remain > 0 ? "pointer" : "not-allowed",
                              borderBottom: "1px solid #f5f5f5",
                              opacity: remain > 0 ? 1 : 0.4,
                            }}
                          >
                            <div style={{ fontSize: "0.825rem" }}>{p.name}</div>
                            <div style={{ fontSize: "0.75rem", color: "#666" }}>
                              ฿{p.price.toLocaleString()} · เหลือ {remain}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {retailLines.length === 0 ? (
                    <p style={{ fontSize: "0.8rem", color: "#aaa", margin: 0 }}>ไม่มีสินค้า</p>
                  ) : (
                    <>
                      {retailLines.map(l => (
                        <div key={l.retailProductId} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.825rem", marginBottom: 4 }}>
                          <span style={{ flex: 1 }}>{l.name}</span>
                          <input
                            type="number"
                            min={0}
                            value={l.quantity}
                            onChange={e => updateRetailQty(l.retailProductId, Number(e.target.value))}
                            style={{ width: 50, padding: "2px 4px", border: "1px solid var(--beige-dark)", borderRadius: 4, textAlign: "center" }}
                          />
                          <span style={{ minWidth: 70, textAlign: "right" }}>฿{(l.price * l.quantity).toLocaleString()}</span>
                          <button
                            onClick={() => updateRetailQty(l.retailProductId, 0)}
                            style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer" }}
                          >×</button>
                        </div>
                      ))}
                      <div style={{ borderTop: "1px solid var(--beige-dark)", marginTop: 6, paddingTop: 6, display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: "0.875rem" }}>
                        <span>รวมสินค้า</span><span>฿{retailSubtotal.toLocaleString()}</span>
                      </div>
                    </>
                  )}
                </div>

                {/* Discount */}
                <div style={{ marginBottom: "0.75rem" }}>
                  <label className="label">ส่วนลด {approvedById ? <span style={{ color: "var(--success-green, #2d6a4f)", fontSize: "0.75rem" }}>✓ อนุมัติแล้ว</span> : <span style={{ fontSize: "0.75rem", color: "#aaa" }}>(ต้องการ Manager PIN)</span>}</label>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <input type="number" className="input" style={{ flex: 1, marginBottom: 0 }} placeholder="บาท"
                      value={discountAmount || ""} onChange={e => handleDiscountChange(Number(e.target.value), "amount")} />
                    <input type="number" className="input" style={{ width: 72, marginBottom: 0 }} placeholder="%" max={100}
                      value={discountPct ? discountPct.toFixed(1) : ""} onChange={e => handleDiscountChange(Number(e.target.value), "pct")} />
                  </div>
                </div>

                {/* Coupon */}
                <div style={{ marginBottom: "0.75rem" }}>
                  <label className="label">🎫 คูปอง</label>
                  {!checkoutOrder.customerId ? (
                    <p style={{ fontSize: "0.8rem", color: "#aaa", margin: 0 }}>ออร์เดอร์นี้ไม่มีข้อมูลสมาชิก</p>
                  ) : applicableTickets.length === 0 ? (
                    <p style={{ fontSize: "0.8rem", color: "#aaa", margin: 0 }}>ไม่มีคูปองที่ใช้ได้</p>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", maxHeight: 160, overflowY: "auto" }}>
                      {applicableTickets.map(t => {
                        const isSelected = selectedTicket?.id === t.id;
                        return (
                          <div key={t.id} style={{
                            display: "flex", justifyContent: "space-between", alignItems: "center",
                            padding: "0.4rem 0.6rem", borderRadius: 8,
                            border: `2px solid ${isSelected ? "var(--olive)" : "var(--beige-dark)"}`,
                            background: isSelected ? "#f0f5e8" : "white",
                          }}>
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div style={{ fontWeight: 600, fontSize: "0.825rem" }}>{t.ticketDef.name}</div>
                              <div style={{ fontSize: "0.75rem", color: "#666" }}>{ticketDefLabel(t.ticketDef)}</div>
                            </div>
                            {isSelected ? (
                              <button onClick={removeTicket}
                                style={{ background: "#fee2e2", border: "none", borderRadius: 6, padding: "0.2rem 0.6rem", cursor: "pointer", color: "#dc2626", fontSize: "0.75rem", fontWeight: 600 }}>
                                ยกเลิก
                              </button>
                            ) : (
                              <button onClick={() => applyTicket(t)}
                                style={{ background: "var(--olive)", border: "none", borderRadius: 6, padding: "0.2rem 0.6rem", cursor: "pointer", color: "white", fontSize: "0.75rem", fontWeight: 600 }}>
                                ใช้
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Totals */}
                <div style={{ background: "var(--beige)", borderRadius: 8, padding: "0.75rem" }}>
                  {(checkoutOrder.retailSubtotal || 0) > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.875rem" }}>
                      <span>สินค้า Retail (จากออร์เดอร์)</span><span>฿{checkoutOrder.retailSubtotal.toLocaleString()}</span>
                    </div>
                  )}
                  {retailSubtotal > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.875rem" }}>
                      <span>สินค้า Retail (เพิ่มที่ checkout)</span><span>฿{retailSubtotal.toLocaleString()}</span>
                    </div>
                  )}
                  {discountAmount > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.875rem", color: "var(--alert-red, #c0392b)" }}>
                      <span>ส่วนลด</span><span>-฿{discountAmount.toLocaleString()}</span>
                    </div>
                  )}
                  {ticketDiscount > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.875rem", color: "#16a34a" }}>
                      <span>คูปอง ({selectedTicket?.ticketDef.name})</span><span>-฿{ticketDiscount.toLocaleString()}</span>
                    </div>
                  )}
                  {hasCreditCard && (
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.875rem", marginTop: 4 }}>
                      <span>Service Charge (3%)</span><span>฿{serviceCharge.toLocaleString()}</span>
                    </div>
                  )}
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.875rem", marginTop: 2 }}>
                    <span>VAT (7%)</span><span>฿{vat.toLocaleString()}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: "1.1rem", color: "var(--olive)", marginTop: 6 }}>
                    <span>ยอดสุทธิ</span><span>฿{finalTotal.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Right: payment methods */}
              <div>
                {checkoutOrder.customer && (
                  <div style={{ background: "#e8f4fd", padding: "0.5rem 0.75rem", borderRadius: 8, marginBottom: "0.75rem", fontSize: "0.875rem" }}>
                    💰 Wallet: <strong>฿{checkoutOrder.customer.walletBalance.toLocaleString()}</strong>
                  </div>
                )}

                <div style={{ fontWeight: 600, fontSize: "0.85rem", marginBottom: 8, color: "var(--olive)" }}>วิธีชำระเงิน</div>
                {payments.map((pay, i) => (
                  <div key={i} style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem", alignItems: "center" }}>
                    <select className="input" style={{ flex: 1, marginBottom: 0 }} value={pay.method}
                      onChange={e => {
                        const newMethod = e.target.value;
                        setPayments(prev => {
                          const newPayments = prev.map((p, j) => j === i ? { ...p, method: newMethod } : p);
                          if (newPayments.length === 1 && checkoutOrder) {
                            const base = Math.max(0, checkoutOrder.subtotal + (checkoutOrder.retailSubtotal || 0) + retailSubtotal - discountAmount - ticketDiscount);
                            const hasCC = newMethod === "CREDIT_CARD";
                            const sc = hasCC ? Math.round(base * 0.03) : 0;
                            const v = Math.round((base + sc) * 0.07);
                            newPayments[0].amount = base + sc + v;
                          }
                          return newPayments;
                        });
                      }}>
                      <option value="CASH">เงินสด</option>
                      <option value="TRANSFER">โอนเงิน (QR)</option>
                      <option value="CREDIT_CARD">บัตรเครดิต</option>
                      <option value="WALLET">Wallet</option>
                    </select>
                    <input type="number" className="input" style={{ width: 110, marginBottom: 0 }} value={pay.amount || ""}
                      onChange={e => setPayments(prev => prev.map((p, j) => j === i ? { ...p, amount: Number(e.target.value) } : p))} />
                    {payments.length > 1 && (
                      <button onClick={() => setPayments(prev => prev.filter((_, j) => j !== i))}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "#ccc", fontSize: "1.1rem", lineHeight: 1 }}>×</button>
                    )}
                  </div>
                ))}
                <button className="btn-secondary" style={{ fontSize: "0.8rem", marginBottom: "0.75rem" }}
                  onClick={() => setPayments(prev => [...prev, { method: "TRANSFER", amount: 0 }])}>
                  + เพิ่มช่องทาง
                </button>

                <div style={{ borderTop: "1px solid var(--beige-dark)", paddingTop: "0.75rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.875rem", marginBottom: 4 }}>
                    <span>รวมยอดชำระ</span><span style={{ fontWeight: 700 }}>฿{totalPaid.toLocaleString()}</span>
                  </div>
                  {change > 0.01 && (
                    <div style={{ display: "flex", justifyContent: "space-between", color: "#2d6a4f", fontWeight: 700 }}>
                      <span>เงินทอน</span><span>฿{change.toLocaleString()}</span>
                    </div>
                  )}
                  {change < -0.01 && (
                    <div style={{ display: "flex", justifyContent: "space-between", color: "var(--alert-red, #c0392b)", fontWeight: 700 }}>
                      <span>ยังขาดอีก</span><span>฿{(-change).toLocaleString()}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <button className="btn-primary" style={{ width: "100%", marginTop: "1.25rem", padding: "0.875rem", fontSize: "1rem" }}
              onClick={handleCheckout} disabled={processing}>
              {processing ? "กำลังบันทึก..." : "✓ ยืนยันการชำระเงิน"}
            </button>
          </div>
        </div>
      )}

      {/* ══════════════ RECEIPT MODAL ══════════════ */}
      {receipt && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 460, width: "95vw" }}>
            {/* Mode toggle */}
            <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
              <button
                onClick={() => setReceiptMode("SHORT")}
                style={{
                  flex: 1, padding: "8px", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: "0.875rem",
                  border: `2px solid ${receiptMode === "SHORT" ? "var(--olive)" : "var(--beige-dark)"}`,
                  background: receiptMode === "SHORT" ? "var(--olive)" : "white",
                  color: receiptMode === "SHORT" ? "white" : "var(--text-dark)",
                }}
              >🧾 ใบเสร็จย่อ</button>
              <button
                onClick={() => setReceiptMode("FULL")}
                style={{
                  flex: 1, padding: "8px", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: "0.875rem",
                  border: `2px solid ${receiptMode === "FULL" ? "var(--olive)" : "var(--beige-dark)"}`,
                  background: receiptMode === "FULL" ? "var(--olive)" : "white",
                  color: receiptMode === "FULL" ? "white" : "var(--text-dark)",
                }}
              >📋 ใบกำกับภาษีเต็ม</button>
            </div>

            {/* Full receipt: customer name + tax ID required */}
            {receiptMode === "FULL" && (
              <div style={{ marginBottom: "1rem", padding: "0.75rem", background: "#fff8e6", border: "1px solid #f5c842", borderRadius: 8, display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <div>
                  <label className="label" style={{ color: "#8a6d00" }}>ชื่อผู้ซื้อ / นิติบุคคล (บังคับ) *</label>
                  <input className="input" style={{ marginBottom: 0 }} placeholder="ชื่อบุคคล หรือ บริษัท..."
                    value={fullCustomerName} onChange={e => setFullCustomerName(e.target.value)} autoFocus />
                </div>
                <div>
                  <label className="label" style={{ color: "#8a6d00" }}>เลขผู้เสียภาษีลูกค้า (บังคับ) *</label>
                  <input className="input" style={{ marginBottom: 0 }} placeholder="0-0000-00000-00-0"
                    value={taxId} onChange={e => setTaxId(e.target.value)} />
                </div>
              </div>
            )}

            {/* Receipt preview */}
            <div style={{ border: "1px dashed #aaa", borderRadius: 8, padding: "1rem", fontFamily: "monospace", fontSize: "0.8rem", background: "#fafafa", marginBottom: "1rem" }}>
              <div style={{ textAlign: "center", fontWeight: 700, marginBottom: 2 }}>{COMPANY.name}</div>
              <div style={{ textAlign: "center", fontSize: "0.7rem", color: "#666", marginBottom: 2 }}>เลขผู้เสียภาษี: {COMPANY.taxId}</div>
              <div style={{ textAlign: "center", fontSize: "0.75rem", color: "#666", marginBottom: 4 }}>
                {receiptMode === "FULL" ? "ใบกำกับภาษีเต็มรูปแบบ (A4)" : "ใบเสร็จรับเงิน (อย่างย่อ)"}
              </div>
              <div style={{ textAlign: "center", fontSize: "0.75rem", letterSpacing: 0.5, padding: "3px 6px", background: "white", border: "1px solid #ddd", borderRadius: 4, margin: "4px 0 8px", fontWeight: 600 }}>
                {formatReceiptNo(receipt.receiptNumber, receiptMode, receipt.paidAt)}
              </div>
              {receiptMode === "FULL" && taxId && (
                <div style={{ marginBottom: 4 }}><strong>เลขผู้เสียภาษีลูกค้า:</strong> {taxId}</div>
              )}
              <div style={{ borderTop: "1px dashed #aaa", margin: "6px 0" }} />
              <div>วันที่: {receipt.paidAt.toLocaleDateString("th-TH")} {receipt.paidAt.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}</div>
              <div>ลูกค้า: {receiptMode === "FULL" && fullCustomerName.trim() ? fullCustomerName : receipt.order.customerName}</div>
              <div style={{ color: "#666", fontSize: "0.75rem" }}>ช่าง: {receipt.order.technician.name}</div>
              <div style={{ borderTop: "1px dashed #aaa", margin: "6px 0" }} />
              {receipt.order.items.map((item, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>{item.service.name}</span><span>฿{item.price.toLocaleString()}</span>
                </div>
              ))}
              <div style={{ borderTop: "1px dashed #aaa", margin: "6px 0" }} />
              {receipt.order.discountAmount > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", color: "var(--alert-red, #c0392b)" }}>
                  <span>ส่วนลด</span><span>-฿{receipt.order.discountAmount.toLocaleString()}</span>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700 }}>
                <span>ยอดสุทธิ</span><span>฿{receipt.finalTotal.toLocaleString()}</span>
              </div>
              <div style={{ borderTop: "1px dashed #aaa", margin: "6px 0" }} />
              {receipt.payments.map((p, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>{METHOD_LABEL[p.method] ?? p.method}</span><span>฿{p.amount.toLocaleString()}</span>
                </div>
              ))}
              {receipt.change > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700 }}>
                  <span>เงินทอน</span><span>฿{receipt.change.toLocaleString()}</span>
                </div>
              )}
              <div style={{ borderTop: "1px dashed #aaa", margin: "8px 0", textAlign: "center", color: "#666" }}>ขอบคุณที่ใช้บริการค่ะ 🙏</div>
            </div>

            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button
                className="btn-primary"
                style={{ flex: 1 }}
                onClick={printReceipt}
                disabled={receiptMode === "FULL" && !taxId.trim()}
              >
                🖨️ พิมพ์ใบเสร็จ
              </button>
              <button className="btn-secondary" style={{ flex: 1 }} onClick={closeReceipt}>
                ✓ ปิด
              </button>
            </div>
            {receiptMode === "FULL" && !taxId.trim() && (
              <p style={{ fontSize: "0.75rem", color: "#c0392b", textAlign: "center", marginTop: "0.5rem" }}>
                กรุณากรอกเลขผู้เสียภาษีก่อนพิมพ์
              </p>
            )}
          </div>
        </div>
      )}

      {/* ══════════════ PIN MODAL ══════════════ */}
      {showPinModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 340 }}>
            <h3 style={{ margin: "0 0 0.5rem", color: "var(--olive)" }}>🔐 Manager PIN</h3>
            <p style={{ fontSize: "0.875rem", color: "#666", marginBottom: "1rem" }}>กรอก Manager PIN เพื่ออนุมัติส่วนลด</p>
            <input type="password" className="input" placeholder="PIN 4-6 หลัก" value={pin}
              onChange={e => setPin(e.target.value)} onKeyDown={e => e.key === "Enter" && verifyPin()}
              style={{ marginBottom: "0.5rem" }} autoFocus />
            {pinError && <div style={{ color: "var(--alert-red)", fontSize: "0.875rem", marginBottom: "0.75rem" }}>{pinError}</div>}
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button className="btn-primary" style={{ flex: 1 }} onClick={verifyPin}>ยืนยัน</button>
              <button className="btn-secondary" style={{ flex: 1 }}
                onClick={() => { setShowPinModal(false); setPin(""); setPinError(""); setDiscountAmount(0); setDiscountPct(0); }}>
                ยกเลิก
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════ ALERT MODAL ══════════════ */}
      {alertMsg && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 360, textAlign: "center" }}>
            <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>⚠️</div>
            <p style={{ fontSize: "0.95rem", color: "var(--text-dark)", marginBottom: "1.25rem", whiteSpace: "pre-wrap" }}>{alertMsg}</p>
            <button className="btn-primary" style={{ minWidth: 120 }} onClick={() => setAlertMsg(null)}>ตกลง</button>
          </div>
        </div>
      )}
    </div>
  );
}
