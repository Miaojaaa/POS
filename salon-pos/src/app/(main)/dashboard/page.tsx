import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  const [todayOrders, monthOrders, queueCount, memberCount] = await Promise.all([
    // Revenue counts ONLY from PAID orders
    prisma.order.findMany({
      where: { createdAt: { gte: startOfDay }, status: "PAID" },
      include: { payments: true },
    }),
    prisma.order.findMany({
      where: { createdAt: { gte: startOfMonth }, status: "PAID" },
      include: { payments: true },
    }),
    prisma.order.count({ where: { status: { in: ["WAITING", "IN_PROGRESS"] } } }),
    prisma.customer.count(),
  ]);

  // For the "Recent Orders" table, we might still want to see everything today
  const allTodayOrders = await prisma.order.findMany({
    where: { createdAt: { gte: startOfDay }, status: { not: "CANCELLED" } },
    orderBy: { createdAt: "desc" },
  });

  const todayRevenue = todayOrders.reduce((sum, o) => sum + o.total, 0);
  const monthRevenue = monthOrders.reduce((sum, o) => sum + o.total, 0);
  const todayCount = todayOrders.length;

  const cards = [
    { label: "ยอดขายวันนี้", value: `฿${todayRevenue.toLocaleString()}`, color: "#6B7C45" },
    { label: "ยอดขายเดือนนี้", value: `฿${monthRevenue.toLocaleString()}`, color: "#8FA65A" },
    { label: "ออร์เดอร์จ่ายแล้ววันนี้", value: `${todayCount} ออร์เดอร์`, color: "#5A7CA6" },
    { label: "คิวที่รออยู่", value: `${queueCount} คิว`, color: "#C4863B" },
    { label: "สมาชิกทั้งหมด", value: `${memberCount} คน`, color: "#A65A7C" },
  ];

  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--olive)", marginBottom: "0.25rem" }}>
        ภาพรวมร้านวันนี้
      </h1>
      <p style={{ color: "#888", fontSize: "0.875rem", marginBottom: "1.5rem" }}>
        {today.toLocaleDateString("th-TH", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "1rem", marginBottom: "2rem" }}>
        {cards.map(card => (
          <div key={card.label} className="card" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "0.8rem", color: "#888", marginBottom: 4 }}>{card.label}</div>
            <div style={{ fontSize: "1.4rem", fontWeight: 700, color: card.color }}>{card.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
        <div className="card">
          <h3 style={{ margin: "0 0 1rem", color: "var(--olive)", fontSize: "1rem" }}>📋 ออร์เดอร์ล่าสุดวันนี้</h3>
          {allTodayOrders.length === 0 ? (
            <p style={{ color: "#aaa", fontSize: "0.875rem" }}>ยังไม่มีออร์เดอร์วันนี้</p>
          ) : (
            <table style={{ width: "100%", fontSize: "0.85rem", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--beige-dark)" }}>
                  <th style={{ textAlign: "left", padding: "4px 8px" }}>ลูกค้า</th>
                  <th style={{ textAlign: "right", padding: "4px 8px" }}>ยอด</th>
                  <th style={{ textAlign: "center", padding: "4px 8px" }}>สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {allTodayOrders.slice(0, 10).map(o => (
                  <tr key={o.id} style={{ borderBottom: "1px solid #f5f5f5" }}>
                    <td style={{ padding: "4px 8px" }}>{o.customerName}</td>
                    <td style={{ padding: "4px 8px", textAlign: "right" }}>฿{o.total.toLocaleString()}</td>
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
              📋 ดูคิวลูกค้า
            </a>
            <a href="/crm/members" className="btn-secondary" style={{ textAlign: "center", textDecoration: "none", display: "block" }}>
              👥 จัดการสมาชิก
            </a>
            <a href="/erp/main" className="btn-secondary" style={{ textAlign: "center", textDecoration: "none", display: "block" }}>
              📦 ดูสต็อก
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
