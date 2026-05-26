import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const branchId = searchParams.get("branchId");
    
    const where: any = {};
    if (branchId && branchId !== "all") {
      where.branchId = branchId;
    }

    const transfers = await prisma.stockTransfer.findMany({
      where,
      include: {
        branch: { select: { name: true } },
        items: { include: { product: true } },
        createdBy: { select: { name: true } },
        approvedBy: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return NextResponse.json(transfers);
  } catch (err: any) {
    console.error("GET transfers error:", err);
    return NextResponse.json({ 
      error: "Failed to fetch transfers",
      details: err.message,
      code: err.code 
    }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { items, note, createdById, branchId = "main" } = await req.json();
    let userId = createdById;
    if (!userId) {
      const fallbackUser = await prisma.user.findFirst({ where: { role: { contains: "OWNER" } } });
      userId = fallbackUser?.id || "";
    }
    if (!userId) {
      return NextResponse.json({ error: "ไม่พบผู้ใช้สำหรับบันทึกผู้ขอโอน" }, { status: 400 });
    }

    const transfer = await prisma.stockTransfer.create({
      data: {
        createdById: userId,
        branchId,
        note,
        status: "PENDING",
        items: { create: items.map((i: { productId: string; quantity: number }) => ({ productId: i.productId, quantity: i.quantity })) },
      },
    });

    return NextResponse.json(transfer);
  } catch (err: any) {
    console.error("POST transfers error:", err);
    return NextResponse.json({ 
      error: "Failed to create transfer",
      details: err.message,
      code: err.code 
    }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { id, action, approvedById } = await req.json();

    if (action === "APPROVE") {
      let approverId = approvedById;
      if (!approverId) {
        const fallback = await prisma.user.findFirst({ where: { role: { contains: "MANAGER" } } });
        approverId = fallback?.id;
      }
      if (!approverId) {
        return NextResponse.json({ error: "ไม่พบผู้อนุมัติ" }, { status: 400 });
      }

      const transfer = await prisma.stockTransfer.findUnique({ where: { id }, include: { items: true } });
      if (!transfer) return NextResponse.json({ error: "Not found" }, { status: 404 });

      await prisma.$transaction(async (tx) => {
        await tx.stockTransfer.update({
          where: { id },
          data: { status: "APPROVED", approvedById: approverId, approvedAt: new Date() },
        });
        for (const item of transfer.items) {
          await tx.mainStock.update({ where: { productId: item.productId }, data: { quantity: { decrement: item.quantity } } });
          
          await tx.subStock.upsert({
            where: { productId_branchId: { productId: item.productId, branchId: transfer.branchId } },
            update: { quantity: { increment: item.quantity } },
            create: { productId: item.productId, branchId: transfer.branchId, quantity: item.quantity, currentVolumeG: 0 }
          });
        }
        await tx.auditLog.create({ data: { action: "APPROVE_TRANSFER", entity: "StockTransfer", entityId: id } });
      });
    } else if (action === "REJECT") {
      await prisma.stockTransfer.update({ where: { id }, data: { status: "REJECTED" } });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("PATCH transfers error:", err);
    return NextResponse.json({ 
      error: "Failed to update transfer",
      details: err.message,
      code: err.code 
    }, { status: 500 });
  }
}
