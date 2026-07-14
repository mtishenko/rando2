import Link from "next/link";
import { notFound } from "next/navigation";
import { getCustomerModel, getPortfolioModel } from "@/lib/data/compute";
import { getMetric } from "@/lib/metrics/catalog";
import {
  scoreStatus,
  oneDp,
  metricStateLabel,
  metricStateClass,
  ageLabel,
  riskStateLabel,
} from "@/lib/ui/format";
import { Trend, HealthBar } from "@/components/ui";
import { isApplicable } from "@/lib/scoring/state";
import PageShell from "@/components/PageShell";

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
    <PageShell
      title={c.displayName}
      sub={
        <>
          <Link href="/customers" className="link">
            customers
          </Link>{" "}
          / {c.tier} · {c.industry} · {c.employeeCount} employees · {c.managedPopulation} managed ·
          criticality {c.criticality}/5
        </>
      }
      actions={
        <div className="stack right" style={{ fontSize: 12.5, gap: 2 }}>
          <span className="muted">
            account owner <b style={{ color: "var(--ink)" }}>{c.accountOwner}</b>
          </span>
          <span className="muted">
            service manager <b style={{ color: "var(--ink)" }}>{c.serviceManager}</b>
          </span>
        </div>
      }
    >
      <div className="stats">
        <div className="stat">
          <div className={`n s-${scoreStatus(s.health)}`}>{oneDp(s.health)}</div>
          <div className="l">Customer health</div>
        </div>
        <div className="stat">
          <div className={`n s-${scoreStatus(s.coverage)}`}>{oneDp(s.coverage)}%</div>
          <div className="l">Measurement coverage</div>
        </div>
        <div className="stat">
          <div className={`n s-${scoreStatus(s.confidence * 100)}`}>{oneDp(s.confidence * 100)}%</div>
          <div className="l">Evidence confidence</div>
        </div>
        <div className={`stat${s.unverifiedCriticalControls > 0 ? " hot" : ""}`}>
          <div className="n">{s.unverifiedCriticalControls}</div>
          <div className="l">Critical unverified controls</div>
        </div>
      </div>

      <div className="grid cols-2" style={{ alignItems: "start", marginBottom: 18 }}>
        <div className="panel" style={{ marginBottom: 0 }}>
          <div className="ph">
            <b>Category scores</b>
          </div>
          <div className="pbody">
            {s.categoryScores.map((cat) => (
              <div key={cat.category} className="spread" style={{ padding: "8px 0" }}>
                <span style={{ width: 110, fontSize: 13.5 }}>{cat.category}</span>
                <HealthBar value={cat.score} width={170} />
                <span className="faint" style={{ fontSize: 12, width: 68, textAlign: "right" }}>
                  {cat.scorableMetricCount} metrics
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="panel" style={{ marginBottom: 0 }}>
          <div className="ph">
            <b>Open risk events</b>
            <span className="sub2">{m.events.length} open</span>
          </div>
          <div>
            {m.events.length === 0 && <div className="empty-note">No open risk events.</div>}
            {m.events.slice(0, 7).map((e) => (
              <Link key={e.id} href={`/risk-events/${e.id}`} className="jt-row" style={{ textDecoration: "none" }}>
                <div className="tt2">
                  <b>{e.title}</b>
                  <span>
                    {riskStateLabel(e.state)} · age {ageLabel(e.ageDays)} · {e.primaryReason}
                  </span>
                </div>
                <span className={`pill p-${e.priorityBand.toLowerCase()}`}>
                  <span className="dot" />
                  {e.priorityBand} · {e.priorityScore}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="ph">
          <b>Metric evidence</b>
          <span className="sub2">{applicableObs.length} applicable metrics</span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table>
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
                      <div style={{ fontWeight: 550 }}>{def.name}</div>
                      <div className="faint mono" style={{ fontSize: 11 }}>
                        {def.id} · {def.source}
                      </div>
                    </td>
                    <td className="muted">{def.category}</td>
                    <td>
                      <span className={`mchip ${metricStateClass(o.state)}`}>{metricStateLabel(o.state)}</span>
                    </td>
                    <td className="muted" style={{ maxWidth: 320, fontSize: 13 }}>
                      {o.evidenceNote}
                    </td>
                    <td className="num muted">{oneDp(o.ageHours)}h</td>
                    <td className="num muted">{def.weight}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </PageShell>
  );
}
