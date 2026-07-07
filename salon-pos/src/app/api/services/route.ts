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
  if (!name || Number(price) < 0 || !categoryId) {
    return NextResponse.json({ error: "ข้อมูลไม่ครบถ้วนหรือไม่ถูกต้อง" }, { status: 400 });
  }

  try {
    const service = await prisma.service.create({
      data: {
        name,
        price: Number(price),
        duration: Number(duration),
        categoryId,
      },
    });

    return NextResponse.json(service);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดในการสร้างบริการ" }, { status: 500 });
  }
}
