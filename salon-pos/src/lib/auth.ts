import { prisma } from "./prisma";
import bcrypt from "bcryptjs";

export async function verifyUser(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return null;
  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return null;
  return user;
}

/**
 * Per-user PIN verification with hierarchical fallback.
 *
 * 1. First, search for a User whose `pin` field matches the entered PIN.
 *    — This lets us identify exactly *who* authorized the action.
 * 2. If no per-user match, fall back to shared SystemConfig PINs
 *    (`owner_pin` / `manager_pin`) for backward compatibility.
 *    — In this case we cannot identify the individual, only the role.
 *
 * @returns object with { role, userId, userName } or null if invalid
 */
export async function verifyPinIdentified(
  requiredRole: "MANAGER" | "OWNER",
  pin: string,
): Promise<{ role: "MANAGER" | "OWNER"; userId: string; userName: string } | null> {
  // === Step 1: Per-user PIN lookup ===
  const user = await prisma.user.findFirst({
    where: { pin, isActive: true },
    select: { id: true, name: true, role: true },
  });

  if (user) {
    const roles = user.role.split(",").map((r: string) => r.trim().toUpperCase());
    const isOwner = roles.includes("OWNER");
    const isManager = roles.includes("MANAGER");

    // Owner PIN can authorize anything
    if (isOwner) return { role: "OWNER", userId: user.id, userName: user.name };
    // Manager PIN can only authorize MANAGER-level actions
    if (isManager && requiredRole === "MANAGER") return { role: "MANAGER", userId: user.id, userName: user.name };
    // User has a PIN but doesn't have the required role
    return null;
  }

  // === Step 2: Fallback to shared SystemConfig PINs ===
  // Owner PIN trumps everything — check first
  const ownerConfig = await prisma.systemConfig.findUnique({ where: { key: "owner_pin" } });
  if (ownerConfig && ownerConfig.value === pin) {
    // Find first active owner user to attach identity
    const ownerUser = await prisma.user.findFirst({
      where: { role: { contains: "OWNER" }, isActive: true },
      select: { id: true, name: true },
    });
    return {
      role: "OWNER",
      userId: ownerUser?.id ?? "",
      userName: ownerUser?.name ?? "Owner",
    };
  }

  // Manager PIN only works for Manager-required actions
  if (requiredRole === "MANAGER") {
    const managerConfig = await prisma.systemConfig.findUnique({ where: { key: "manager_pin" } });
    if (managerConfig && managerConfig.value === pin) {
      const managerUser = await prisma.user.findFirst({
        where: { role: { contains: "MANAGER" }, isActive: true },
        select: { id: true, name: true },
      });
      return {
        role: "MANAGER",
        userId: managerUser?.id ?? "",
        userName: managerUser?.name ?? "Manager",
      };
    }
  }

  return null;
}

/**
 * Hierarchical PIN check. Returns which role's PIN was actually used, or null if invalid.
 * Owner PIN can authorize any action (including Manager-required ones).
 * Manager PIN can only authorize Manager-required actions.
 */
export async function verifyPinHierarchical(
  requiredRole: "MANAGER" | "OWNER",
  pin: string,
): Promise<"MANAGER" | "OWNER" | null> {
  const result = await verifyPinIdentified(requiredRole, pin);
  return result?.role ?? null;
}

export async function verifyPin(role: "MANAGER" | "OWNER", pin: string): Promise<boolean> {
  return (await verifyPinHierarchical(role, pin)) !== null;
}

/** True if the role string contains OWNER or MANAGER (multi-role aware). */
export function roleNeedsPin(role: string): boolean {
  const roles = role.split(",").map(r => r.trim().toUpperCase());
  return roles.includes("OWNER") || roles.includes("MANAGER");
}

/**
 * Generate a 6-digit numeric PIN that does not collide with any existing
 * `User.pin`. Falls back through up to 100 random draws before throwing —
 * with 6 digits and a few dozen managers, collisions are vanishingly rare.
 */
export async function generateUniquePin(): Promise<string> {
  for (let attempt = 0; attempt < 100; attempt++) {
    const pin = String(Math.floor(100000 + Math.random() * 900000));
    const clash = await prisma.user.findFirst({ where: { pin }, select: { id: true } });
    if (!clash) return pin;
  }
  throw new Error("ไม่สามารถสุ่ม PIN ที่ไม่ซ้ำได้ — โปรดลองใหม่");
}
