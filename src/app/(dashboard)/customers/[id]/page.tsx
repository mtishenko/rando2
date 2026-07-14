import Link from "next/link";
import { notFound } from "next/navigation";
import { getCustomerModel, getPortfolioModel } from "@/lib/data/compute";
import { getMetric } from "@/lib/metrics/catalog";
import {
  scoreBand,
  oneDp,
  metricStateLabel,
  metricStateClass,
  ageLabel,
  riskStateLabel,
} from "@/lib/ui/format";
import { Metric, Trend, HealthBar } from "@/components/ui";
import { isApplicable } from "@/lib/scoring/state";

export const dynamic = "force-static";

export function generateStaticParams() {
  return getPortfolioModel().customers.map((m) => ({ id: m.customer.id }));
}

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const m = getCustomerModel(id);
  if (!m) notFound();
  const c = m.customer;
  const s = m.scores;

  const applicableObs = m.observations
    .filter((o) => isApplicable(o.state))
    .sort((a, b) => {
      const da = getMetric(a.metricId);
      const db = getMetric(b.metricId);
      return da.category.localeCompare(db.category) || da.id.localeCompare(db.id);
    });

  return (
    <>
      <div className="page-head">
        <div>
          <div className="muted" style={{ fontSize: 13, marginBottom: 4 }}>
            <Link href="/" className="link">
              Command Center
            </Link>{" "}
            / <Link href="/customers" className="link">Customers</Link>
          </div>
          <h1 className="page-title">{c.displayName}</h1>
          <div className="page-sub">
            {c.tier} · {c.industry} · {c.employeeCount} employees · {c.managedPopulation} managed ·
            criticality {c.criticality}/5
          </div>
        </div>
        <div className="stack" style={{ textAlign: "right", fontSize: 13 }}>
          <span className="dim">
            Account owner <b>{c.accountOwner}</b>
          </span>
          <span className="dim">
            Service manager <b>{c.serviceManager}</b>
          </span>
        </div>
      </div>

      <div className="grid cols-4" style={{ marginBottom: 18 }}>
        <Metric label="Customer Health" value={oneDp(s.health)} band={scoreBand(s.health)}>
          <div className="metric-foot">
            <span>
              30-day <Trend value={s.healthDelta30d} />
            </span>
            <span>
              7-day <Trend value={s.health7dChange} />
            </span>
          </div>
        </Metric>
        <Metric label="Coverage" value={oneDp(s.coverage)} unit="%" band={scoreBand(s.coverage)}>
          <div className="metric-foot">
            <span>
              30-day <Trend value={s.coverageDelta30d} />
            </span>
          </div>
        </Metric>
        <Metric label="Confidence" value={oneDp(s.confidence * 100)} unit="%" band={scoreBand(s.confidence * 100)}>
          <div className="metric-foot">
            <span>freshness × reliability × population × quality</span>
          </div>
        </Metric>
        <Metric
          label="Unverified Critical"
          value={s.unverifiedCriticalControls}
          band={s.unverifiedCriticalControls > 0 ? "critical" : "excellent"}
        >
          <div className="metric-foot">
            <span>{s.scorableMetricCount} scored · {s.applicableMetricCount} applicable</span>
          </div>
        </Metric>
      </div>

      <div className="grid cols-2" style={{ alignItems: "start", marginBottom: 18 }}>
        <div className="panel">
          <div className="panel-title">Category scores</div>
          {s.categoryScores.map((cat) => (
            <div key={cat.category} className="spread" style={{ padding: "9px 0" }}>
              <span style={{ width: 120 }}>{cat.category}</span>
              <HealthBar value={cat.score} width={180} />
              <span className="muted" style={{ fontSize: 12, width: 70, textAlign: "right" }}>
                {cat.scorableMetricCount} metrics
              </span>
            </div>
          ))}
        </div>

        <div className="panel">
          <div className="spread" style={{ marginBottom: 8 }}>
            <div className="panel-title" style={{ margin: 0 }}>
              Open risk events ({m.events.length})
            </div>
          </div>
          {m.events.length === 0 && <div className="muted">No open risk events.</div>}
          {m.events.slice(0, 8).map((e) => (
            <Link
              href={`/risk-events/${e.id}`}
              key={e.id}
              className="spread"
              style={{ padding: "10px 0", borderBottom: "1px solid var(--border)" }}
            >
              <div className="stack" style={{ gap: 2 }}>
                <span style={{ fontWeight: 600 }}>{e.title}</span>
                <span className="muted" style={{ fontSize: 12 }}>
                  {riskStateLabel(e.state)} · age {ageLabel(e.ageDays)} · {e.primaryReason}
                </span>
              </div>
              <span className={`pill band-${e.priorityBand.toLowerCase()}`}>
                {e.priorityBand} · {e.priorityScore}
              </span>
            </Link>
          ))}
        </div>
      </div>

      <div className="panel">
        <div className="panel-title">Metric evidence ({applicableObs.length} applicable)</div>
        <div style={{ overflowX: "auto" }}>
          <table className="table">
            <thead>
              <tr>
                <th>Metric</th>
                <th>Category</th>
                <th>State</th>
                <th>Evidence</th>
                <th className="num">Age</th>
                <th className="num">Weight</th>
              </tr>
            </thead>
            <tbody>
              {applicableObs.map((o) => {
                const def = getMetric(o.metricId);
                return (
                  <tr key={o.metricId}>
                    <td>
                      <span style={{ fontWeight: 600 }}>{def.name}</span>
                      <div className="muted mono" style={{ fontSize: 11 }}>
                        {def.id} · {def.source}
                      </div>
                    </td>
                    <td className="dim">{def.category}</td>
                    <td>
                      <span className={`chip ${metricStateClass(o.state)}`}>
                        {metricStateLabel(o.state)}
                      </span>
                    </td>
                    <td className="dim" style={{ maxWidth: 320, fontSize: 13 }}>
                      {o.evidenceNote}
                    </td>
                    <td className="num dim">{oneDp(o.ageHours)}h</td>
                    <td className="num dim">{def.weight}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
