// src/app/(dashboard)/dashboard/ads/page.tsx
export const dynamic = "force-dynamic";

export default function AdsOverviewPage() {
  return (
    <div className="container" style={{ padding: 16 }}>
      <h2 style={{ marginBottom: 8 }}>Ads Overview</h2>
      <p className="dim">Admin-only. এখানে Slots, Creatives, Placements, Reports ইত্যাদি ম্যানেজ করবেন।</p>

      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", marginTop: 16 }}>
        <a className="card" href="/dashboard/ads/slots">Slots</a>
        <a className="card" href="/dashboard/ads/creatives">Creatives</a>
        <a className="card" href="/dashboard/ads/placements">Placements</a>
        <a className="card" href="/dashboard/ads/reports">Reports</a>
      </div>
    </div>
  );
}
