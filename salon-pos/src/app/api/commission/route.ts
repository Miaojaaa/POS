import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const pools = await prisma.commissionPool.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json(pools);
}

export async function PATCH(req: NextRequest) {
  const { id, percentage } = await req.json();
  const pool = await prisma.commissionPool.update({ where: { id }, data: { percentage } });
  return NextResponse.json(pool);
}
