"use server";

import { cookies, headers } from "next/headers";
import { prisma } from "./prisma";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: string;
};

const SESSION_COOKIE = "salon_session";

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const userId = cookieStore.get(SESSION_COOKIE)?.value;
  if (!userId) return null;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.isActive) return null;
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

// A `Secure` cookie is only sent back over HTTPS. Keying it off NODE_ENV alone
// breaks login over plain HTTP in production (cookie is set but never returned →
// infinite login loop). Instead key it off whether THIS request is actually
// HTTPS — which behind a reverse proxy means the `x-forwarded-proto` header.
// Override with COOKIE_SECURE=true|false if your proxy doesn't forward it.
async function shouldUseSecureCookie(): Promise<boolean> {
  const override = process.env.COOKIE_SECURE?.toLowerCase();
  if (override === "true" || override === "1") return true;
  if (override === "false" || override === "0") return false;

  const hdrs = await headers();
  const proto = hdrs.get("x-forwarded-proto") ?? hdrs.get("x-forwarded-protocol");
  // Header can be a comma-separated list when chained through proxies.
  return proto?.split(",")[0].trim().toLowerCase() === "https";
}

export async function setSession(userId: string) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, userId, {
    httpOnly: true,
    secure: await shouldUseSecureCookie(),
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}
