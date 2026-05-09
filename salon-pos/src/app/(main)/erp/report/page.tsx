import { prisma } from "@/lib/prisma";

export default async function StockReportPage() {
  const products = await prisma.product.findMany({
    where: { isActive: true },
    include: { mainStock: true, subStock: true },
    orderBy: { name: "asc" },
  });

  const totalMainValue = products.reduce((s, p) => s + (p.mainStock?.quantity ?? 0) * p.costPerUnit, 0);
  const totalSubValue = products.reduce((s, p) => {
    const vol = (p.subStock?.quantity ?? 0) * p.unitVolumeG + (p.subStock?.currentVolumeG ?? 0);
    return s + (vol * (p.costPerUnit / p.unitVolumeG));
  }, 0);

  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--olive)", marginBottom: "1.5rem" }}>📊 รายงานสต็อกรวม</h1>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem", marginBottom: "1.5rem" }}>
        <div className="card" style={{ textAlign: "center" }}>
          <div style={{ color: "#888", fontSize: "0.8rem", marginBottom: 4 }}>มูลค่าคลังหลัก</div>
          <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--olive)" }}>฿{totalMainValue.toLocaleString()}</div>
        </div>
        <div className="card" style={{ textAlign: "center" }}>
          <div style={{ color: "#888", fontSize: "0.8rem", marginBottom: 4 }}>มูลค่าคลังหน้าร้าน</div>
          <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#5A7CA6" }}>฿{totalSubValue.toLocaleString()}</div>
        </div>
        <div className="card" style={{ textAlign: "center" }}>
          <div style={{ color: "#888", fontSize: "0.8rem", marginBottom: 4 }}>มูลค่าสต็อกรวม</div>
          <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#555" }}>฿{(totalMainValue + totalSubValue).toLocaleString()}</div>
        </div>
      </div>

      <div className="card">
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid var(--beige-dark)", color: "#666" }}>
              <th style={{ textAlign: "left", padding: "8px 12px" }}>สินค้า</th>
              <th style={{ textAlign: "center", padding: "8px 12px" }}>คลังหลัก (ขวด)</th>
              <th style={{ textAlign: "center", padding: "8px 12px" }}>คลังหน้าร้าน (ขวด + ก.)</th>
              <th style={{ textAlign: "right", padding: "8px 12px" }}>ราคาต้นทุนต่อขวด (฿)</th>
              <th style={{ textAlign: "right", padding: "8px 12px" }}>มูลค่ารวม (฿)</th>
              <th style={{ textAlign: "center", padding: "8px 12px" }}>Reorder Point (ก.)</th>
            </tr>
          </thead>
          <tbody>
            {products.map(p => {
              const totalVolumeG = ((p.mainStock?.quantity ?? 0) + (p.subStock?.quantity ?? 0)) * p.unitVolumeG + (p.subStock?.currentVolumeG ?? 0);
              const isLow = totalVolumeG <= p.reorderPoint;
              const totalVal = ((p.mainStock?.quantity ?? 0) * p.costPerUnit)
                + (((p.subStock?.quantity ?? 0) * p.unitVolumeG + (p.subStock?.currentVolumeG ?? 0)) * (p.costPerUnit / p.unitVolumeG));
              return (
                <tr key={p.id} style={{ borderBottom: "1px solid #f5f5f5", background: isLow ? "#fff8f8" : "white" }}>
                  <td style={{ padding: "8px 12px", fontWeight: 500 }}>
                    {isLow && <span style={{ color: "var(--alert-red)" }}>⚠️ </span>}
                    {p.name}
                  </td>
                  <td style={{ padding: "8px 12px", textAlign: "center" }}>{p.mainStock?.quantity ?? 0}</td>
                  <td style={{ padding: "8px 12px", textAlign: "center" }}>
                    {p.subStock?.quantity ?? 0} + {((p.subStock?.currentVolumeG ?? 0)).toLocaleString()}
                  </td>
                  <td style={{ padding: "8px 12px", textAlign: "right" }}>{p.costPerUnit.toLocaleString()}</td>
                  <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 600 }}>{Math.round(totalVal).toLocaleString()}</td>
                  <td style={{ padding: "8px 12px", textAlign: "center", color: "#888" }}>
                    {(p.reorderPoint).toLocaleString()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
