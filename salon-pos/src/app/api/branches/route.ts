import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const branches = await prisma.branch.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    });
    return NextResponse.json(branches);
  } catch (err: any) {
    console.error("GET branches error:", err);
    return NextResponse.json({ 
      error: "Failed to fetch branches",
      details: err.message,
      code: err.code 
    }, { status: 500 });
  }
}
