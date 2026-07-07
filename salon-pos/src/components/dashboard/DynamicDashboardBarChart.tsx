"use client";

import dynamic from "next/dynamic";

const DynamicDashboardBarChart = dynamic(
  () => import("./DashboardBarChart"),
  { ssr: false }
);

export default DynamicDashboardBarChart;
