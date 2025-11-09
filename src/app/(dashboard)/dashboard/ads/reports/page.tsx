// src/app/(dashboard)/ads/reports/page.tsx
"use client";
import { useEffect, useMemo, useState } from "react";
import styles from "./adsReports.module.css";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Legend,
  Tooltip,
  Brush,
} from "recharts";

/* ---------- helpers ---------- */
function fmt(n: number) {
  return new Intl.NumberFormat().format(n);
}
function pct(n: number) {
  return (n * 100).toFixed(2) + "%";
}
function todayYMD() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}
function addDays(ymd: string, d: number) {
  const dt = new Date(ymd + "T00:00:00Z");
  dt.setUTCDate(dt.getUTCDate() + d);
  return dt.toISOString().slice(0, 10);
}
async function jfetch<T>(url: string): Promise<T> {
  const r = await fetch(url, { cache: "no-store" });
  const j = await r.json();
  if (!r.ok) throw new Error(j?.error || "Request failed");
  return j as T;
}
function toCsv(rows: any[], headers: string[]): string {
  const esc = (v: any) =>
    String(v ?? "").replaceAll('"', '""').replace(/\r?\n/g, " ");
  const head = headers.join(",");
  const body = rows
    .map((r) => headers.map((h) => `"${esc(r[h])}"`).join(","))
    .join("\n");
  return head + "\n" + body;
}
function download(filename: string, content: string, type = "text/csv") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* ---------- types ---------- */
type Daily = { ymd: string; impressions: number; clicks: number };
type TopRow = { id: number; name?: string; slot_key?: string; impressions: number; clicks: number };
type Option = { id: number; name?: string; slot_key?: string };

/* ---------- API wrappers ---------- */
async function fetchSummary(from: string, to: string, slotId?: number, creativeId?: number) {
  const qs = new URLSearchParams({ from, to });
  if (slotId) qs.set("slotId", String(slotId));
  if (creativeId) qs.set("creativeId", String(creativeId));
  return jfetch<{ rows: Daily[] }>(`/api/r2/ads/metrics/summary?${qs}`);
}
async function fetchTop(
  kind: "slot" | "creative",
  from: string,
  to: string,
  limit = 10,
  slotId?: number,
  creativeId?: number
) {
  const qs = new URLSearchParams({ kind, from, to, limit: String(limit) });
  if (slotId) qs.set("slotId", String(slotId));
  if (creativeId) qs.set("creativeId", String(creativeId));
  return jfetch<{ rows: TopRow[] }>(`/api/r2/ads/metrics/top?${qs}`);
}
async function fetchSlots(): Promise<Option[]> {
  const j = await jfetch<{ rows: Option[] }>(`/api/r2/ads/slots`);
  return j.rows ?? [];
}
async function fetchCreatives(): Promise<Option[]> {
  const j = await jfetch<{ rows: Option[] }>(`/api/r2/ads/creatives`);
  return j.rows ?? [];
}

/* ---------- UI page ---------- */
export default function AdsReportsPage() {
  // date range default: last 14 days
  const to0 = todayYMD();
  const from0 = addDays(to0, -13);

  const [from, setFrom] = useState(from0);
  const [to, setTo] = useState(to0);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // filters
  const [slots, setSlots] = useState<Option[]>([]);
  const [creatives, setCreatives] = useState<Option[]>([]);
  const [slotId, setSlotId] = useState<number | undefined>(undefined);
  const [creativeId, setCreativeId] = useState<number | undefined>(undefined);

  // data
  const [daily, setDaily] = useState<Daily[]>([]);
  const [topSlots, setTopSlots] = useState<TopRow[]>([]);
  const [topCreatives, setTopCreatives] = useState<TopRow[]>([]);

  const totals = useMemo(() => {
    const imp = daily.reduce((a, b) => a + (b.impressions || 0), 0);
    const clk = daily.reduce((a, b) => a + (b.clicks || 0), 0);
    return { imp, clk, ctr: imp ? clk / imp : 0 };
  }, [daily]);

  async function loadOptions() {
    try {
      const [ss, cc] = await Promise.all([fetchSlots(), fetchCreatives()]);
      setSlots(ss);
      setCreatives(cc);
    } catch {
      // ignore options error
    }
  }

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const [s, ts, tc] = await Promise.all([
        fetchSummary(from, to, slotId, creativeId),
        fetchTop("slot", from, to, 10, slotId, creativeId),
        fetchTop("creative", from, to, 10, slotId, creativeId),
      ]);
      setDaily(s.rows ?? []);
      setTopSlots(ts.rows ?? []);
      setTopCreatives(tc.rows ?? []);
    } catch (e: any) {
      setErr(e?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadOptions();
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---- CSV exports ---- */
  function exportDailyCsv() {
    const rows = daily.map((r) => ({
      date: r.ymd,
      impressions: r.impressions,
      clicks: r.clicks,
      ctr: r.impressions ? (r.clicks / r.impressions).toFixed(4) : "0.0000",
    }));
    download(`ads-daily-${from}-to-${to}.csv`, toCsv(rows, ["date", "impressions", "clicks", "ctr"]));
  }
  function exportTopSlotsCsv() {
    const rows = topSlots.map((r) => ({
      id: r.id,
      name: r.name ?? r.slot_key ?? r.id,
      impressions: r.impressions,
      clicks: r.clicks,
      ctr: r.impressions ? (r.clicks / r.impressions).toFixed(4) : "0.0000",
    }));
    download(`ads-top-slots-${from}-to-${to}.csv`, toCsv(rows, ["id", "name", "impressions", "clicks", "ctr"]));
  }
  function exportTopCreativesCsv() {
    const rows = topCreatives.map((r) => ({
      id: r.id,
      name: r.name,
      impressions: r.impressions,
      clicks: r.clicks,
      ctr: r.impressions ? (r.clicks / r.impressions).toFixed(4) : "0.0000",
    }));
    download(`ads-top-creatives-${from}-to-${to}.csv`, toCsv(rows, ["id", "name", "impressions", "clicks", "ctr"]));
  }

  return (
    <div className={styles.container}>
      <h2>Ads Reports</h2>

      {/* Filters */}
      <div className={styles.filters}>
        <div className="dim">Date range</div>
        <div className={styles.row8}>
          <input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>

        <div>
          <div className={`dim ${styles.labelMb4}`}>Slot</div>
          <select
            className="select"
            value={slotId ?? ""}
            onChange={(e) => setSlotId(e.target.value ? Number(e.target.value) : undefined)}
          >
            <option value="">All slots</option>
            {slots.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name ? s.name : s.slot_key ? s.slot_key : `(slot ${s.id})`}
              </option>
            ))}
          </select>
        </div>

        <div>
          <div className={`dim ${styles.labelMb4}`}>Creative</div>
          <select
            className="select"
            value={creativeId ?? ""}
            onChange={(e) => setCreativeId(e.target.value ? Number(e.target.value) : undefined)}
          >
            <option value="">All creatives</option>
            {creatives.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div className={styles.applyWrap}>
          <button className="btn" onClick={load}>Apply</button>
        </div>
      </div>

      {err && <div className={styles.error}>{err}</div>}

      {/* KPIs */}
      <div className={styles.kpis}>
        <div className={`card ${styles.kpiCard}`}>
          <div className="dim">Impressions</div>
          <div className={styles.kpiValue}>{fmt(totals.imp)}</div>
        </div>
        <div className={`card ${styles.kpiCard}`}>
          <div className="dim">Clicks</div>
          <div className={styles.kpiValue}>{fmt(totals.clk)}</div>
        </div>
        <div className={`card ${styles.kpiCard}`}>
          <div className="dim">CTR</div>
          <div className={styles.kpiValue}>{pct(totals.ctr)}</div>
        </div>
      </div>

      {/* Trendline chart */}
      <div className={`card ${styles.trendCard}`}>
        <div className={styles.cardHeader}>
          <strong>Daily Trend</strong>
          <div className={styles.btnRow}>
            <button className="btn-ghost" onClick={exportDailyCsv} title="Export CSV">Export CSV</button>
          </div>
        </div>

        {daily.length === 0 ? (
          <div className={`dim ${styles.noData}`}>No data for selected date range.</div>
        ) : (
          <div className={styles.chartBox}>
            <ResponsiveContainer>
              <LineChart data={daily} margin={{ top: 10, right: 20, bottom: 0, left: 0 }}>
                <CartesianGrid strokeOpacity={0.15} />
                <XAxis dataKey="ymd" minTickGap={20} />
                <YAxis yAxisId="L" />
                <YAxis yAxisId="R" orientation="right" />
                <Tooltip formatter={(v: any, n) => (n === "ctr" ? pct(v) : fmt(v))} />
                <Legend />
                <Line yAxisId="L" type="monotone" dataKey="impressions" name="Impressions" stroke="currentColor" dot={false} />
                <Line yAxisId="L" type="monotone" dataKey="clicks" name="Clicks" stroke="currentColor" dot={false} strokeDasharray="6 4" />
                <Line
                  yAxisId="R"
                  type="monotone"
                  data={daily.map((d) => ({ ...d, ctr: d.impressions ? d.clicks / d.impressions : 0 }))}
                  dataKey="ctr"
                  name="CTR"
                  stroke="currentColor"
                  dot={false}
                  strokeDasharray="2 3"
                />
                <Brush dataKey="ymd" height={20} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Top tables */}
      <div className={styles.topTables}>
        <div className={`card ${styles.topCard}`}>
          <div className={styles.cardHeader}>
            <strong>Top Slots</strong>
            <button className="btn-ghost" onClick={exportTopSlotsCsv}>Export CSV</button>
          </div>
          <table className={`table ${styles.tableSpaced}`}>
            <thead>
              <tr><th>Name</th><th className="text-right">Imp.</th><th className="text-right">Clk.</th><th className="text-right">CTR</th></tr>
            </thead>
            <tbody>
              {topSlots.map((r) => {
                const ctr = r.impressions ? r.clicks / r.impressions : 0;
                return (
                  <tr key={r.id}>
                    <td>{r.name ? r.name : r.slot_key ? r.slot_key : `(slot ${r.id})`}</td>
                    <td className="text-right">{fmt(r.impressions)}</td>
                    <td className="text-right">{fmt(r.clicks)}</td>
                    <td className="text-right">{pct(ctr)}</td>
                  </tr>
                );
              })}
              {topSlots.length === 0 && (
                <tr>
                  <td colSpan={4} className={`text-center dim ${styles.pad12}`}>No data.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className={`card ${styles.topCard}`}>
          <div className={styles.cardHeader}>
            <strong>Top Creatives</strong>
            <button className="btn-ghost" onClick={exportTopCreativesCsv}>Export CSV</button>
          </div>
          <table className={`table ${styles.tableSpaced}`}>
            <thead>
              <tr><th>Name</th><th className="text-right">Imp.</th><th className="text-right">Clk.</th><th className="text-right">CTR</th></tr>
            </thead>
            <tbody>
              {topCreatives.map((r) => {
                const ctr = r.impressions ? r.clicks / r.impressions : 0;
                return (
                  <tr key={r.id}>
                    <td>{r.name}</td>
                    <td className="text-right">{fmt(r.impressions)}</td>
                    <td className="text-right">{fmt(r.clicks)}</td>
                    <td className="text-right">{pct(ctr)}</td>
                  </tr>
                );
              })}
              {topCreatives.length === 0 && (
                <tr>
                  <td colSpan={4} className={`text-center dim ${styles.pad12}`}>No data.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {loading && <div className={`dim ${styles.loading}`}>Loading…</div>}
    </div>
  );
}
