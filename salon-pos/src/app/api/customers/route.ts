import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q");
  const customers = await prisma.customer.findMany({
    where: q
      ? { OR: [{ name: { contains: q } }, { phone: { contains: q } }] }
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
  const body = await req.json();
  const { id, ...data } = body;
  const customer = await prisma.customer.update({
    where: { id },
    data: { 
      name: data.name, 
      phone: data.phone, 
      birthdate: data.birthdate || null, 
      memberLevel: data.memberLevel,
      allergyHistory: data.allergyHistory || null
    },
  });
  return NextResponse.json(customer);
}
