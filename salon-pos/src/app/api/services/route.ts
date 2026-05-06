import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const services = await prisma.service.findMany({
    where: { isActive: true },
    include: { category: true },
    orderBy: [{ category: { name: "asc" } }, { name: "asc" }],
  });
  return NextResponse.json(services);
}

export async function POST(req: NextRequest) {
  const { name, price, duration, categoryId } = await req.json();
  const service = await prisma.service.create({
    data: { name, price: Number(price), duration: Number(duration), categoryId },
    include: { category: true },
  });
  return NextResponse.json(service);
}
