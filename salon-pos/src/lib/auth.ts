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
 * Hierarchical PIN check. Returns which role's PIN was actually used, or null if invalid.
 * Owner PIN can authorize any action (including Manager-required ones).
 * Manager PIN can only authorize Manager-required actions.
 */
export async function verifyPinHierarchical(
  requiredRole: "MANAGER" | "OWNER",
  pin: string,
): Promise<"MANAGER" | "OWNER" | null> {
  // Owner PIN trumps everything — check first
  const ownerConfig = await prisma.systemConfig.findUnique({ where: { key: "owner_pin" } });
  if (ownerConfig && ownerConfig.value === pin) return "OWNER";

  // Manager PIN only works for Manager-required actions
  if (requiredRole === "MANAGER") {
    const managerConfig = await prisma.systemConfig.findUnique({ where: { key: "manager_pin" } });
    if (managerConfig && managerConfig.value === pin) return "MANAGER";
  }

  return null;
}

export async function verifyPin(role: "MANAGER" | "OWNER", pin: string): Promise<boolean> {
  return (await verifyPinHierarchical(role, pin)) !== null;
}
