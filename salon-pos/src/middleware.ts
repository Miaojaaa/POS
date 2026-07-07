import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const SESSION_COOKIE = "salon_session";

// Secret for signing cookies. Must match the one in session.ts
// Fallback is ONLY for development. In production, provide a strong secret!
const secretKey = process.env.SESSION_SECRET_KEY || "default_super_secret_key_change_me_in_production";
const key = new TextEncoder().encode(secretKey);

// Public API routes that don't require authentication
const publicRoutes = ["/api/auth/login", "/api/auth/logout"];

export async function middleware(req: NextRequest) {
  const url = req.nextUrl.clone();

  // We only protect /api routes in this middleware.
  // We leave UI routing protection to layout.tsx or other client-side checks for now,
  // to avoid breaking frontend navigation.
  if (!url.pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // Allow public API routes
  if (publicRoutes.includes(url.pathname)) {
    return NextResponse.next();
  }

  const cookie = req.cookies.get(SESSION_COOKIE)?.value;

  if (!cookie) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Verify the JWT signature
    await jwtVerify(cookie, key, { algorithms: ["HS256"] });
    return NextResponse.next();
  } catch (error) {
    // If the signature is invalid (e.g., tampered with or expired), reject the request
    return NextResponse.json({ error: "Invalid Session" }, { status: 401 });
  }
}

// Config to specify which routes this middleware applies to
export const config = {
  matcher: ["/api/:path*"],
};
