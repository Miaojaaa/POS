import { prisma } from "@/lib/prisma";
import { DEFAULT_FINANCE, normalizePct, type CommissionMode } from "@/lib/system-config";

const CFG_KEYS = [
  "finance.commissionMode",
  "finance.commission.pool.tech",
  "finance.commission.pool.assist",
  "finance.commission.perHead.tech",
  "finance.commission.perHead.assist",
] as const;

export async function generatePayrollRun(month: number, year: number) {
  const startOfMonth = new Date(year, month - 1, 1);
  const endOfMonth = new Date(year, month, 0, 23, 59, 59);

  // Drop any existing run for this month (status doesn't matter — caller decides
  // whether to confirm again afterwards).
  const existing = await prisma.payrollRun.findFirst({ where: { month, year } });
  if (existing) {
    await prisma.payrollItem.deleteMany({ where: { payrollRunId: existing.id } });
    await prisma.payrollRun.delete({ where: { id: existing.id } });
  }

  // Commission mode drives the formula — POOL = equal split per role,
  // PER_HEAD = share by individual order count, NONE = no commission at all.
  // Rates are stored per-mode under finance.commission.{pool,perHead}.{tech,assist}
  // so the owner can use different percentages for each distribution method.
  const cfgRows = await prisma.systemConfig.findMany({ where: { key: { in: [...CFG_KEYS] } } });
  const cfg = new Map(cfgRows.map(r => [r.key, r.value]));
  const modeRaw = cfg.get("finance.commissionMode");
  const commissionMode: CommissionMode =
    modeRaw === "PER_HEAD" ? "PER_HEAD" :
    modeRaw === "NONE" ? "NONE" : "POOL";
  const techPct = commissionMode === "PER_HEAD"
    ? normalizePct(cfg.get("finance.commission.perHead.tech"), DEFAULT_FINANCE.perHeadRates.techPct)
    : normalizePct(cfg.get("finance.commission.pool.tech"), DEFAULT_FINANCE.poolRates.techPct);
  const assistPct = commissionMode === "PER_HEAD"
    ? normalizePct(cfg.get("finance.commission.perHead.assist"), DEFAULT_FINANCE.perHeadRates.assistPct)
    : normalizePct(cfg.get("finance.commission.pool.assist"), DEFAULT_FINANCE.poolRates.assistPct);

  const users = await prisma.user.findMany({ where: { isActive: true } });

  // Source-of-truth: PAID orders only (same as ประวัติ Transaction page)
  const orders = await prisma.order.findMany({
    where: { status: "PAID", completedAt: { gte: startOfMonth, lte: endOfMonth } },
    include: { items: true, chemicals: true, assistants: true, retailItems: true },
  });

  const totalRevenue = orders.reduce((s, o) => s + o.total, 0);
  const totalChemCost = orders.reduce((s, o) => s + o.chemicalCost, 0);
  const netRevenue = totalRevenue - totalChemCost;

  const techIds = new Set(users.filter(u => u.role.split(",").includes("TECHNICIAN")).map(u => u.id));
  const assistIds = new Set(users.filter(u => u.role.split(",").includes("ASSISTANT")).map(u => u.id));
  const techCount = techIds.size;
  const assistCount = assistIds.size;

  const techPoolAmount = (netRevenue * techPct) / 100;
  const assistPoolAmount = (netRevenue * assistPct) / 100;

  // PER_HEAD needs total per-role order counts to compute each person's share
  const totalTechOrders = orders.filter(o => techIds.has(o.technicianId)).length;
  const totalAssistOrders = orders.reduce(
    (s, o) => s + o.assistants.filter(a => assistIds.has(a.userId)).length,
    0,
  );

  return prisma.payrollRun.create({
    data: {
      month,
      year,
      status: "DRAFT",
      items: {
        create: users.map(u => {
          const myOrders = orders.filter(o =>
            o.technicianId === u.id || o.assistants.some(a => a.userId === u.id)
          );
          const myTechOrders = orders.filter(o => o.technicianId === u.id);
          const myAssistOrderCount = orders.reduce(
            (s, o) => s + o.assistants.filter(a => a.userId === u.id).length,
            0,
          );

          // Retail commission (20% of retail price) goes to the main technician only.
          // NONE mode zeros it out alongside pool commission.
          const retailCommission = commissionMode === "NONE" ? 0 : myTechOrders.reduce((sum, o) => {
            const retailSum = o.retailItems.reduce((s, ri) => s + (ri.price * ri.quantity), 0);
            return sum + (retailSum * 0.20);
          }, 0);

          const orderCount = myOrders.length;
          const roles = u.role.split(",");
          let poolCommission = 0;

          if (commissionMode === "POOL") {
            if (roles.includes("TECHNICIAN") && techCount > 0) poolCommission = techPoolAmount / techCount;
            else if (roles.includes("ASSISTANT") && assistCount > 0) poolCommission = assistPoolAmount / assistCount;
          } else if (commissionMode === "PER_HEAD") {
            if (roles.includes("TECHNICIAN") && totalTechOrders > 0) {
              poolCommission = techPoolAmount * (myTechOrders.length / totalTechOrders);
            } else if (roles.includes("ASSISTANT") && totalAssistOrders > 0) {
              poolCommission = assistPoolAmount * (myAssistOrderCount / totalAssistOrders);
            }
          }

          const baseSalary = u.baseSalary ?? 0;
          const positionAllowance = u.positionAllowance ?? 0;
          return {
            userId: u.id,
            poolCommission,
            retailCommission,
            baseSalary,
            positionAllowance,
            totalAmount: poolCommission + retailCommission + baseSalary,
            orderCount,
          };
        }),
      },
    },
    include: { items: { include: { user: { select: { id: true, name: true, role: true } } } } },
  });
}
