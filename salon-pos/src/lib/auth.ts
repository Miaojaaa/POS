import { prisma } from "./prisma";
import bcrypt from "bcryptjs";

export async function verifyUser(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return null;
  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return null;
  return user;
}

export async function verifyPin(role: "MANAGER" | "OWNER", pin: string) {
  const key = role === "MANAGER" ? "manager_pin" : "owner_pin";
  const config = await prisma.systemConfig.findUnique({ where: { key } });
  if (!config) return false;
  return config.value === pin;
}
