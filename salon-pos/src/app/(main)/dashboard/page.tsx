import { prisma } from "@/lib/prisma";
import BranchSelector from "@/components/BranchSelector";
import DailyExportButton from "@/components/DailyExportButton";
import DynamicDashboardBarChart from "@/components/dashboard/DynamicDashboardBarChart";
import { LayoutDashboard, ShoppingBag, Scissors, ClipboardList } from "lucide-react";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ branchId?: string }>;
};

export default async function DashboardPage({ searchParams }: Props) {
  const { branchId = "all" } = await searchParams;
  
  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  const branches = await prisma.branch.findMany({ where: { isActive: true } });

  // Revenue cards: filter by completedAt (payment time) so totals match the
  // transaction history page and the daily Excel export, which both key off
  // when the order was paid — not when it was opened.
  const whereTodayRevenue: any = { completedAt: { gte: startOfDay }, status: "PAID" };
  const whereMonthRevenue: any = { completedAt: { gte: startOfMonth }, status: "PAID" };
  // "Recent orders" table: orders opened today regardless of status (createdAt).
  const whereOpenedToday: any = { createdAt: { gte: startOfDay } };
  const whereQueue: any = { status: { in: ["WAITING", "IN_PROGRESS"] } };

  if (branchId !== "all") {
    whereTodayRevenue.branchId = branchId;
    whereMonthRevenue.branchId = branchId;
    whereOpenedToday.branchId = branchId;
    whereQueue.branchId = branchId;
  }

  const [todayOrders, monthOrders, queueCount, memberCount] = await Promise.all([
    prisma.order.findMany({
      where: whereTodayRevenue,
      include: {
        payments: true,
        items: { include: { service: { include: { category: true } } } },
        retailItems: { include: { retailProduct: true } },
      },
    }),
    prisma.order.findMany({ where: whereMonthRevenue, include: { payments: true } }),
    prisma.order.count({ where: whereQueue }),
    prisma.customer.count(),
  ]);

  // Aggregate retail products sold today (by quantity) and service revenue by category.
  const productAgg = new Map<string, number>();
  const categoryAgg = new Map<string, number>();
  for (const o of todayOrders) {
    for (const ri of o.retailItems) {
      const name = ri.retailProduct.name;
      productAgg.set(name, (productAgg.get(name) ?? 0) + ri.quantity);
    }
    for (const it of o.items) {
      const cat = it.service.category?.name ?? "ไม่ระบุหมวด";
      categoryAgg.set(cat, (categoryAgg.get(cat) ?? 0) + it.price);
    }
  }
  const productData = Array.from(productAgg, ([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);
  const categoryData = Array.from(categoryAgg, ([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  const allTodayOrders = await prisma.order.findMany({
    where: { ...whereOpenedToday, status: { not: "CANCELLED" } },
    orderBy: { createdAt: "desc" },
  });

  const todayRevenue = todayOrders.reduce((sum, o) => sum + o.total, 0);
  const monthRevenue = monthOrders.reduce((sum, o) => sum + o.total, 0);
  const todayCount = todayOrders.length;

  const cards: { label: string; value: string; color: string; sub?: string }[] = [
    { label: "ยอดขายวันนี้", value: `฿${todayRevenue.toLocaleString()}`, color: "#6B7C45", sub: "(รวม VAT 7%)" },
    { label: "ยอดขายเดือนนี้", value: `฿${monthRevenue.toLocaleString()}`, color: "#8FA65A", sub: "(รวม VAT 7%)" },
    { label: "ออร์เดอร์จ่ายแล้ววันนี้", value: `${todayCount} ออร์เดอร์`, color: "#5A7CA6" },
    { label: "คิวที่รออยู่", value: `${queueCount} คิว`, color: "#C4863B" },
    { label: "สมาชิกทั้งหมด", value: `${memberCount} คน`, color: "#A65A7C" },
  ];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.25rem" }}>
        <h1 style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "1.4rem", fontWeight: 700, color: "var(--olive)", margin: 0 }}>
          <LayoutDashboard size={24} /> ภาพรวมร้านวันนี้
        </h1>

        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <DailyExportButton />
          <BranchSelector branches={branches} currentBranchId={branchId} />
        </div>
      </div>
      
      <p style={{ color: "#888", fontSize: "0.875rem", marginBottom: "1.5rem" }}>
        {today.toLocaleDateString("th-TH", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "1rem", marginBottom: "2rem" }}>
        {cards.map(card => (
          <div key={card.label} className="card" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "0.8rem", color: "#888", marginBottom: 4 }}>{card.label}</div>
            <div style={{ fontSize: "1.4rem", fontWeight: 700, color: card.color }}>{card.value}</div>
            {card.sub && <div style={{ fontSize: "0.7rem", color: "#aaa", marginTop: 2 }}>{card.sub}</div>}
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
        <div className="card">
          <h3 style={{ display: "flex", alignItems: "center", gap: "0.5rem", margin: "0 0 1rem", color: "var(--olive)", fontSize: "1rem" }}>
            <ShoppingBag size={18} /> สินค้าที่ขายได้วันนี้ (จำนวนชิ้น)
          </h3>
          <DynamicDashboardBarChart
            data={productData}
            color="#C4863B"
            valueSuffix=" ชิ้น"
            emptyText="วันนี้ยังไม่มีการขายสินค้า"
          />
        </div>
        <div className="card">
          <h3 style={{ display: "flex", alignItems: "center", gap: "0.5rem", margin: "0 0 1rem", color: "var(--olive)", fontSize: "1rem" }}>
            <Scissors size={18} /> ยอดขายตามหมวดหมู่บริการวันนี้
          </h3>
          <DynamicDashboardBarChart
            data={categoryData}
            color="#6B7C45"
            valuePrefix="฿"
            emptyText="วันนี้ยังไม่มียอดบริการ"
          />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
        <div className="card">
          <h3 style={{ display: "flex", alignItems: "center", gap: "0.5rem", margin: "0 0 1rem", color: "var(--olive)", fontSize: "1rem" }}>
            <ClipboardList size={18} /> ออร์เดอร์ล่าสุดวันนี้
          </h3>
          {allTodayOrders.length === 0 ? (
            <p style={{ color: "#aaa", fontSize: "0.875rem" }}>ยังไม่มีออร์เดอร์วันนี้</p>
          ) : (
            <table style={{ width: "100%", fontSize: "0.85rem", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--beige-dark)" }}>
                  <th style={{ textAlign: "left", padding: "4px 8px" }}>ลูกค้า</th>
                  <th style={{ textAlign: "right", padding: "4px 8px" }}>ยอด (฿)</th>
                  <th style={{ textAlign: "center", padding: "4px 8px" }}>สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {allTodayOrders.slice(0, 10).map(o => (
                  <tr key={o.id} style={{ borderBottom: "1px solid #f5f5f5" }}>
                    <td style={{ padding: "4px 8px" }}>{o.customerName}</td>
                    <td style={{ padding: "4px 8px", textAlign: "right" }}>{o.total.toLocaleString()}</td>
                    <td style={{ padding: "4px 8px", textAlign: "center" }}>
                      <span className={`badge badge-${o.status.toLowerCase().replace("_", "-")}`}>
                        {o.status === "WAITING" ? "รอ" : o.status === "IN_PROGRESS" ? "กำลังทำ" : o.status === "DONE" ? "เสร็จ" : o.status === "PAID" ? "จ่ายแล้ว" : "ยกเลิก"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card">
          <h3 style={{ margin: "0 0 1rem", color: "var(--olive)", fontSize: "1rem" }}>🚀 เมนูด่วน</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
            <a href="/pos/new" className="btn-primary" style={{ textAlign: "center", textDecoration: "none", display: "block" }}>
              + รับออร์เดอร์ใหม่
            </a>
            <a href="/pos/queue" className="btn-secondary" style={{ textAlign: "center", textDecoration: "none", display: "block" }}>
              ดูคิวลูกค้า
            </a>
            <a href="/crm/members" className="btn-secondary" style={{ textAlign: "center", textDecoration: "none", display: "block" }}>
              จัดการสมาชิก
            </a>
            <a href="/erp/main" className="btn-secondary" style={{ textAlign: "center", textDecoration: "none", display: "block" }}>
              ดูสต็อก
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
