import Link from "next/link";
import { getPortfolioModel } from "@/lib/data/compute";
import { toSummary } from "@/lib/ui/summary";
import { oneDp } from "@/lib/ui/format";
import { HealthBar, Trend } from "@/components/ui";

export const dynamic = "force-static";

export default function CustomersPage() {
  const pm = getPortfolioModel();
  const rows = pm.customers
    .map(toSummary)
    .sort((a, b) => a.health - b.health);

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Customers</h1>
          <div className="page-sub">{rows.length} managed customers · sorted by health ascending</div>
        </div>
      </div>

      <div className="panel">
        <div style={{ overflowX: "auto" }}>
          <table className="table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Tier</th>
                <th>Health</th>
                <th>30-day</th>
                <th>Coverage</th>
                <th>Confidence</th>
                <th className="num">Open events</th>
                <th className="num">Unverified crit.</th>
                <th>Top priority</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id}>
                  <td>
                    <Link href={`/customers/${c.id}`} className="link" style={{ fontWeight: 600 }}>
                      {c.name}
                    </Link>
                    <div className="muted" style={{ fontSize: 12 }}>
                      {c.industry}
                    </div>
                  </td>
                  <td className="dim">{c.tier}</td>
                  <td>
                    <HealthBar value={c.health} width={80} />
                  </td>
                  <td>
                    <Trend value={c.healthDelta30d} />
                  </td>
                  <td className="dim">{oneDp(c.coverage)}%</td>
                  <td className="dim">{oneDp(c.confidence * 100)}%</td>
                  <td className="num dim">{c.openEvents}</td>
                  <td className="num" style={{ color: c.unverifiedCritical ? "var(--critical)" : "var(--text-3)" }}>
                    {c.unverifiedCritical}
                  </td>
                  <td>
                    {c.priorityScore > 0 ? (
                      <span className={`pill band-${c.priorityBand.toLowerCase()}`}>
                        {c.priorityBand} · {c.priorityScore}
                      </span>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
