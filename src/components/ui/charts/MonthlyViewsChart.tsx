// src/components/ui/charts/MonthlyViewsChart.tsx

"use client";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, /* Cell */
} from "recharts";

export type MonthBucket = { ym: string; label: string; total: number };

export default function MonthlyViewsChart({ data }: { data: MonthBucket[] }) {
  const rows = (data || []).map(d => ({ ...d, total: Number(d.total || 0) }));

  return (
    <div style={{ width: "100%", height: 260 }}>
      <ResponsiveContainer>
        <BarChart data={rows} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="rgba(255,255,255,.25)" strokeDasharray="3 3" />
          <XAxis dataKey="label" tick={{ fill: "var(--text-dim)" }} />
          <YAxis tick={{ fill: "var(--text-dim)" }} />
          <Tooltip contentStyle={{ background: "var(--elev)", border: "1px solid var(--border)" }} />
          <Legend wrapperStyle={{ color: "var(--text-dim)" }} />
          <Bar dataKey="total" name="Views" fill="var(--brand)" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
