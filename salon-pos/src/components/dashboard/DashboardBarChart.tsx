"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Datum = { name: string; value: number };

type Props = {
  data: Datum[];
  color?: string;
  valuePrefix?: string;
  valueSuffix?: string;
  emptyText?: string;
};

export default function DashboardBarChart({
  data,
  color = "#6B7C45",
  valuePrefix = "",
  valueSuffix = "",
  emptyText = "ยังไม่มีข้อมูล",
}: Props) {
  if (data.length === 0) {
    return <p style={{ color: "#aaa", textAlign: "center", padding: "1.5rem", fontSize: "0.875rem" }}>{emptyText}</p>;
  }

  const height = Math.max(180, data.length * 32 + 40);
  const fmt = (n: number) => `${valuePrefix}${Math.round(n).toLocaleString()}${valueSuffix}`;

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 5, right: 24, bottom: 5, left: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eee" horizontal={false} />
          <XAxis type="number" tickFormatter={fmt} tick={{ fontSize: 11 }} />
          <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={130} />
          <Tooltip formatter={(v) => fmt(Number(v))} contentStyle={{ fontSize: 12 }} />
          <Bar dataKey="value" fill={color} radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
