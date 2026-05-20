import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { DEFAULT_RECEIPT_FORMATS, buildReceiptNumber, normalizeReceiptFormat } from "@/lib/system-config";

async function readFullReceiptFormat() {
  const row = await prisma.systemConfig.findUnique({ where: { key: "receipt.format.full" } });
  if (!row) return DEFAULT_RECEIPT_FORMATS.full;
  try {
    return normalizeReceiptFormat(JSON.parse(row.value), DEFAULT_RECEIPT_FORMATS.full);
  } catch {
    return DEFAULT_RECEIPT_FORMATS.full;
  }
}

const SELECT_FIELDS = {
  receiptType: true,
  receiptNumber: true,
  completedAt: true,
  taxInvoiceNumber: true,
  taxInvoiceIssuedAt: true,
  taxInvoiceCustomerName: true,
  taxInvoiceAddress: true,
  taxInvoiceTaxId: true,
} as const;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const { type, customerName, customerAddress, customerTaxId } = body as {
    type: string;
    customerName?: string;
    customerAddress?: string;
    customerTaxId?: string;
  };

  if (type !== "SHORT" && type !== "FULL") {
    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  }

  const existing = await prisma.order.findUnique({
    where: { id },
    select: { ...SELECT_FIELDS, status: true },
  });
  if (!existing) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  if (existing.status !== "PAID") {
    return NextResponse.json({ error: "ออร์เดอร์ยังไม่ได้ชำระเงิน" }, { status: 400 });
  }

  // FULL is the legally-binding tax invoice — never downgrade to SHORT once issued
  if (existing.receiptType === "FULL" && type === "SHORT") {
    return NextResponse.json({ ok: true, ...existing });
  }

  // ───── SHORT path ─────
  if (type === "SHORT") {
    // Backfill receiptNumber for legacy/seed orders that bypassed checkout numbering.
    // Use MAX+1 within completedAt date so the SHORT format `LNDS{seq}{ddmmyyyy}` stays unique per day.
    const result = await prisma.$transaction(async (tx) => {
      let receiptNumber = existing.receiptNumber;
      if (!receiptNumber && existing.completedAt) {
        const d = existing.completedAt;
        const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        const dayEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
        const max = await tx.order.findFirst({
          where: { completedAt: { gte: dayStart, lt: dayEnd }, receiptNumber: { not: null } },
          orderBy: { receiptNumber: "desc" },
          select: { receiptNumber: true },
        });
        receiptNumber = (max?.receiptNumber ?? 0) + 1;
      }
      return tx.order.update({
        where: { id },
        data: { receiptType: "SHORT", ...(receiptNumber !== existing.receiptNumber ? { receiptNumber } : {}) },
        select: SELECT_FIELDS,
      });
    });
    return NextResponse.json({ ok: true, ...result });
  }

  // ───── FULL path ─────
  // Already issued — just confirm receiptType, do not touch the locked snapshot
  if (existing.taxInvoiceNumber) {
    const updated = await prisma.order.update({
      where: { id },
      data: { receiptType: "FULL" },
      select: SELECT_FIELDS,
    });
    return NextResponse.json({ ok: true, ...updated });
  }

  // First-time FULL issuance: validate + lock
  if (!customerName?.trim() || !customerAddress?.trim() || !customerTaxId?.trim()) {
    return NextResponse.json(
      { error: "ต้องระบุชื่อ ที่อยู่ และเลขผู้เสียภาษีของผู้ซื้อสำหรับใบกำกับภาษีเต็ม" },
      { status: 400 },
    );
  }

  const issuedAt = new Date();
  const dayStart = new Date(issuedAt.getFullYear(), issuedAt.getMonth(), issuedAt.getDate());
  const dayEnd = new Date(issuedAt.getFullYear(), issuedAt.getMonth(), issuedAt.getDate() + 1);
  const fullFormat = await readFullReceiptFormat();

  const updated = await prisma.$transaction(async (tx) => {
    // Daily sequence of FULL tax invoices, starts at 0001 each day
    const seq = await tx.order.count({
      where: { taxInvoiceIssuedAt: { gte: dayStart, lt: dayEnd } },
    });
    const taxInvoiceNumber = buildReceiptNumber(seq + 1, issuedAt, fullFormat);
    return tx.order.update({
      where: { id },
      data: {
        receiptType: "FULL",
        taxInvoiceNumber,
        taxInvoiceIssuedAt: issuedAt,
        taxInvoiceCustomerName: customerName.trim(),
        taxInvoiceAddress: customerAddress.trim(),
        taxInvoiceTaxId: customerTaxId.trim(),
      },
      select: SELECT_FIELDS,
    });
  });

  return NextResponse.json({ ok: true, ...updated });
}
