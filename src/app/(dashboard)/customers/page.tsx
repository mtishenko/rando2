import Link from "next/link";
import { getPortfolioModel } from "@/lib/data/compute";
import { toSummary } from "@/lib/ui/summary";
import { oneDp, scoreStatus } from "@/lib/ui/format";
import { HealthBar, Trend } from "@/components/ui";
import PageShell from "@/components/PageShell";

export const dynamic = "force-static";

export default function CustomersPage() {
  const pm = getPortfolioModel();
  const rows = pm.customers.map(toSummary).sort((a, b) => a.health - b.health);

  return (
    <PageShell title="Customers" sub={`${rows.length} managed customers · sorted by health ascending`}>
      <div className="panel">
        <div style={{ overflowX: "auto" }}>
          <table>
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
                <tr key={c.id} className="click">
                  <td>
                    <Link href={`/customers/${c.id}`} className="link">
                      {c.name}
                    </Link>
                    <div className="faint" style={{ fontSize: 12 }}>
                      {c.industry}
                    </div>
                  </td>
                  <td className="muted">{c.tier}</td>
                  <td>
                    <HealthBar value={c.health} width={76} />
                  </td>
                  <td>
                    <Trend value={c.healthDelta30d} />
                  </td>
                  <td className={`s-${scoreStatus(c.coverage)}`}>{oneDp(c.coverage)}%</td>
                  <td className="muted">{oneDp(c.confidence * 100)}%</td>
                  <td className="num muted">{c.openEvents}</td>
                  <td className={`num ${c.unverifiedCritical ? "s-danger" : "faint"}`} style={{ fontWeight: 600 }}>
                    {c.unverifiedCritical}
                  </td>
                  <td>
                    {c.priorityScore > 0 ? (
                      <span className={`pill p-${c.priorityBand.toLowerCase()}`}>
                        <span className="dot" />
                        {c.priorityBand} · {c.priorityScore}
                      </span>
                    ) : (
                      <span className="faint">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </PageShell>
  );
}
