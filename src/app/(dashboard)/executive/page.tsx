import Link from "next/link";
import { getPortfolioModel } from "@/lib/data/compute";
import { METRICS_BY_ID } from "@/lib/metrics/catalog";
import { effectiveWeight } from "@/lib/scoring/customer";
import { hasUsableEvidence, isApplicable } from "@/lib/scoring/state";
import { scoreBand, oneDp } from "@/lib/ui/format";
import { Metric, Trend, HealthBar } from "@/components/ui";
import type { Capability } from "@/lib/types";

export const dynamic = "force-static";

const CAP_LABEL: Record<Capability, string> = {
  endpoint_management: "Endpoint Management",
  edr: "Endpoint Detection & Response",
  identity_security: "Identity Security",
  m365_security: "Microsoft 365 Security",
  mdr: "Managed Detection & Response",
  backup: "Backup & Recovery",
  network_management: "Network Management",
  documentation: "Documentation",
  service_management: "Service Management",
  grc: "Governance, Risk & Compliance",
};

export default function ExecutivePage() {
  const pm = getPortfolioModel();
  const p = pm.portfolio;

  // Coverage by capability across the whole portfolio (weighted).
  const caps = Object.keys(CAP_LABEL) as Capability[];
  const coverageByCap = caps
    .map((cap) => {
      let num = 0;
      let den = 0;
      for (const m of pm.customers) {
        for (const o of m.observations) {
          const def = METRICS_BY_ID[o.metricId];
          if (!def || def.capability !== cap || !isApplicable(o.state)) continue;
          const w = effectiveWeight(def);
          den += w;
          if (hasUsableEvidence(o.state)) num += w;
        }
      }
      return { cap, coverage: den === 0 ? null : (num / den) * 100 };
    })
    .filter((x) => x.coverage !== null) as { cap: Capability; coverage: number }[];

  // Impact by customer (top improvers).
  const impactByCustomer = pm.customers
    .map((m) => ({ name: m.customer.displayName, delta: m.scores.healthDelta30d }))
    .sort((a, b) => b.delta - a.delta)
    .slice(0, 6);

  const belowThreshold = pm.customers
    .filter((m) => m.scores.health < 80)
    .sort((a, b) => a.scores.health - b.scores.health);

  const criticalUnverified = pm.customers
    .filter((m) => m.scores.unverifiedCriticalControls > 0)
    .sort((a, b) => b.scores.unverifiedCriticalControls - a.scores.unverifiedCriticalControls);

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Executive Portfolio Dashboard</h1>
          <div className="page-sub">
            Portfolio health, risk, delivery effectiveness, and customer-value trends
          </div>
        </div>
      </div>

      <div className="grid cols-3" style={{ marginBottom: 18 }}>
        <Metric label="Customer Health" value={oneDp(p.health)} band={scoreBand(p.health)}>
          <div className="metric-foot">
            <span>
              30-day <Trend value={p.healthDelta30d} />
            </span>
            <span>
              <b>{p.customersBelowThreshold}</b> below threshold
            </span>
          </div>
        </Metric>
        <Metric label="Measurement Coverage" value={oneDp(p.coverage)} unit="%" band={scoreBand(p.coverage)}>
          <div className="metric-foot">
            <span>
              30-day <Trend value={p.coverageDelta30d} />
            </span>
            <span>
              <b>{p.criticalUnverifiedControls}</b> critical unverified
            </span>
          </div>
        </Metric>
        <Metric label="Edgefi Impact · month" value={oneDp(p.impact.total)} band="good">
          <div className="metric-foot">
            <span>
              <b>{p.risksResolvedThisMonth}</b> risks resolved
            </span>
            <span>
              <b>{p.recurrencesPrevented}</b> recurrences prevented
            </span>
          </div>
        </Metric>
      </div>

      <div className="grid cols-2" style={{ alignItems: "start", marginBottom: 18 }}>
        <div className="panel">
          <div className="panel-title">Impact composition (this month)</div>
          {[
            { label: "Verified risk reduction", v: p.impact.verifiedRiskReduction, w: "35%" },
            { label: "Customer health improvement", v: p.impact.healthImprovement, w: "25%" },
            { label: "Coverage improvement", v: p.impact.coverageImprovement, w: "20%" },
            { label: "Recurrence prevention", v: p.impact.recurrencePrevention, w: "10%" },
            { label: "Durable control improvement", v: p.impact.durableControlImprovement, w: "10%" },
          ].map((row) => (
            <div className="factor" key={row.label} style={{ gridTemplateColumns: "220px 1fr 46px" }}>
              <span>
                {row.label} <span className="muted">({row.w})</span>
              </span>
              <div className="fbar">
                <span style={{ width: `${row.v}%` }} />
              </div>
              <span className="mono dim" style={{ textAlign: "right" }}>
                {oneDp(row.v)}
              </span>
            </div>
          ))}
          <div className="notice" style={{ marginTop: 14 }}>
            Ticket closure alone earns no impact credit — every component reflects a verified outcome.
          </div>
        </div>

        <div className="panel">
          <div className="panel-title">Coverage by capability</div>
          {coverageByCap
            .sort((a, b) => a.coverage - b.coverage)
            .map((c) => (
              <div key={c.cap} className="spread" style={{ padding: "7px 0" }}>
                <span style={{ width: 210, fontSize: 13 }}>{CAP_LABEL[c.cap]}</span>
                <HealthBar value={c.coverage} width={200} />
              </div>
            ))}
        </div>
      </div>

      <div className="grid cols-3" style={{ alignItems: "start" }}>
        <div className="panel">
          <div className="panel-title">Customers below threshold</div>
          {belowThreshold.length === 0 && <div className="muted">None below 80.</div>}
          {belowThreshold.map((m) => (
            <Link
              href={`/customers/${m.customer.id}`}
              key={m.customer.id}
              className="spread"
              style={{ padding: "9px 0", borderBottom: "1px solid var(--border)" }}
            >
              <span>{m.customer.displayName}</span>
              <span className={`band-${scoreBand(m.scores.health)}`} style={{ fontWeight: 700 }}>
                {oneDp(m.scores.health)}
              </span>
            </Link>
          ))}
        </div>

        <div className="panel">
          <div className="panel-title">Critical unverified controls</div>
          {criticalUnverified.length === 0 && <div className="muted">None.</div>}
          {criticalUnverified.map((m) => (
            <Link
              href={`/customers/${m.customer.id}`}
              key={m.customer.id}
              className="spread"
              style={{ padding: "9px 0", borderBottom: "1px solid var(--border)" }}
            >
              <span>{m.customer.displayName}</span>
              <span className="band-critical" style={{ fontWeight: 700 }}>
                {m.scores.unverifiedCriticalControls}
              </span>
            </Link>
          ))}
        </div>

        <div className="panel">
          <div className="panel-title">Top health improvers (30-day)</div>
          {impactByCustomer.map((c) => (
            <div
              key={c.name}
              className="spread"
              style={{ padding: "9px 0", borderBottom: "1px solid var(--border)" }}
            >
              <span>{c.name}</span>
              <Trend value={c.delta} />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
