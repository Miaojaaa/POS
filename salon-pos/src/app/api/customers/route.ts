import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q");
  const customers = await prisma.customer.findMany({
    where: q
      ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { phone: { contains: q } }] }
      : {},
    orderBy: { name: "asc" },
    take: 50,
  });
  return NextResponse.json(customers);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const customer = await prisma.customer.create({
    data: {
      name: body.name,
      phone: body.phone,
      birthdate: body.birthdate || null,
      allergyHistory: body.allergyHistory || null,
      memberLevel: body.memberLevel || "BASIC",
    },
  });
  return NextResponse.json(customer);
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, ...data } = body;

    const existing = await prisma.customer.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Customer not found" }, { status: 404 });

    // Enforce permanent allergy history (cannot be cleared if it was set)
    if (existing.allergyHistory && (!data.allergyHistory || !data.allergyHistory.trim())) {
      return NextResponse.json({ error: "ประวัติการแพ้ไม่สามารถลบออกได้ (Permanent Record)" }, { status: 400 });
    }

    const customer = await prisma.customer.update({
      where: { id },
      data: { 
        name: data.name, 
        phone: data.phone, 
        birthdate: data.birthdate || null, 
        memberLevel: data.memberLevel,
        allergyHistory: data.allergyHistory || existing.allergyHistory
      },
    });
    return NextResponse.json(customer);
  } catch (err) {
    console.error("PUT customers error:", err);
    return NextResponse.json({ error: "Failed to update customer" }, { status: 500 });
  }
}
