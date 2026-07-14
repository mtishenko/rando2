import Link from "next/link";
import { getPortfolioModel } from "@/lib/data/compute";
import { METRICS_BY_ID } from "@/lib/metrics/catalog";
import { effectiveWeight } from "@/lib/scoring/customer";
import { hasUsableEvidence, isApplicable } from "@/lib/scoring/state";
import { scoreStatus, oneDp } from "@/lib/ui/format";
import { Metric, Trend, HealthBar } from "@/components/ui";
import type { Capability } from "@/lib/types";
import PageShell from "@/components/PageShell";
import { getServerIdentity } from "@/lib/auth/server";
import { can } from "@/lib/auth/guard";

// Dynamic: reads the current identity (cookie) to gate commercial overlays.
export const dynamic = "force-dynamic";

const CAP_LABEL: Record<Capability, string> = {
  endpoint_management: "Endpoint management",
  edr: "Endpoint detection & response",
  identity_security: "Identity security",
  m365_security: "Microsoft 365 security",
  mdr: "Managed detection & response",
  backup: "Backup & recovery",
  network_management: "Network management",
  documentation: "Documentation",
  service_management: "Service management",
  grc: "Governance, risk & compliance",
};

function renewalRisk(health: number, health7dChange: number): "High" | "Medium" | "Low" {
  if (health < 80 || health7dChange <= -6) return "High";
  if (health < 90) return "Medium";
  return "Low";
}

export default async function ExecutivePage() {
  const identity = await getServerIdentity();
  const showCommercials = can(identity, "commercials:view");
  const pm = getPortfolioModel();
  const p = pm.portfolio;

  const renewalRows = pm.customers
    .map((m) => ({
      id: m.customer.id,
      name: m.customer.displayName,
      tier: m.customer.tier,
      band: renewalRisk(m.scores.health, m.scores.health7dChange),
    }))
    .filter((r) => r.band !== "Low")
    .sort((a, b) => (a.band === "High" ? -1 : 1) - (b.band === "High" ? -1 : 1));

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

  const impactRows = [
    { label: "Verified risk reduction", v: p.impact.verifiedRiskReduction, w: "35%" },
    { label: "Customer health improvement", v: p.impact.healthImprovement, w: "25%" },
    { label: "Coverage improvement", v: p.impact.coverageImprovement, w: "20%" },
    { label: "Recurrence prevention", v: p.impact.recurrencePrevention, w: "10%" },
    { label: "Durable control improvement", v: p.impact.durableControlImprovement, w: "10%" },
  ];

  return (
    <PageShell
      title="Executive portfolio dashboard"
      sub="Portfolio health, risk, delivery effectiveness, and customer-value trends"
    >
      <div className="grid cols-3" style={{ marginBottom: 22 }}>
        <Metric label="Customer health" value={p.health}>
          <div className="mfoot">
            <span>
              30-day <Trend value={p.healthDelta30d} />
            </span>
            <span>
              <b>{p.customersBelowThreshold}</b> below threshold
            </span>
          </div>
        </Metric>
        <Metric label="Measurement coverage" value={p.coverage} unit="%">
          <div className="mfoot">
            <span>
              30-day <Trend value={p.coverageDelta30d} />
            </span>
            <span>
              <b>{p.criticalUnverifiedControls}</b> critical unverified
            </span>
          </div>
        </Metric>
        <Metric label="edgefi impact · month" value={p.impact.total} tone="edgefi">
          <div className="mfoot">
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
        <div className="panel" style={{ marginBottom: 0 }}>
          <div className="ph">
            <b>Impact composition</b>
            <span className="sub2">this month · verified outcomes only</span>
          </div>
          <div className="pbody">
            {impactRows.map((row) => (
              <div className="factor presence" key={row.label} style={{ gridTemplateColumns: "220px 1fr 44px" }}>
                <span>
                  {row.label} <span className="faint">({row.w})</span>
                </span>
                <div className="fbar">
                  <span style={{ width: `${row.v}%` }} />
                </div>
                <span className="fval">{oneDp(row.v)}</span>
              </div>
            ))}
            <div className="notice" style={{ marginTop: 14, marginBottom: 0 }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
                <path d="M20 6 9 17l-5-5" />
              </svg>
              <span>Ticket closure alone earns no impact credit — every component reflects a verified outcome.</span>
            </div>
          </div>
        </div>

        <div className="panel" style={{ marginBottom: 0 }}>
          <div className="ph">
            <b>Coverage by capability</b>
          </div>
          <div className="pbody">
            {coverageByCap
              .sort((a, b) => a.coverage - b.coverage)
              .map((c) => (
                <div key={c.cap} className="spread" style={{ padding: "6px 0" }}>
                  <span style={{ width: 220, fontSize: 13 }}>{CAP_LABEL[c.cap]}</span>
                  <HealthBar value={c.coverage} width={180} />
                </div>
              ))}
          </div>
        </div>
      </div>

      <div className="grid cols-3" style={{ alignItems: "start" }}>
        <div className="panel" style={{ marginBottom: 0 }}>
          <div className="ph">
            <b>Customers below threshold</b>
          </div>
          <div>
            {belowThreshold.length === 0 && <div className="empty-note">None below 80.</div>}
            {belowThreshold.map((m) => (
              <Link key={m.customer.id} href={`/customers/${m.customer.id}`} className="jt-row">
                <div className="tt2">
                  <b>{m.customer.displayName}</b>
                </div>
                <span className={`s-${scoreStatus(m.scores.health)}`} style={{ fontWeight: 600 }}>
                  {oneDp(m.scores.health)}
                </span>
              </Link>
            ))}
          </div>
        </div>

        <div className="panel" style={{ marginBottom: 0 }}>
          <div className="ph">
            <b>Critical unverified controls</b>
          </div>
          <div>
            {criticalUnverified.length === 0 && <div className="empty-note">None.</div>}
            {criticalUnverified.map((m) => (
              <Link key={m.customer.id} href={`/customers/${m.customer.id}`} className="jt-row">
                <div className="tt2">
                  <b>{m.customer.displayName}</b>
                </div>
                <span className="s-danger" style={{ fontWeight: 600 }}>
                  {m.scores.unverifiedCriticalControls}
                </span>
              </Link>
            ))}
          </div>
        </div>

        <div className="panel" style={{ marginBottom: 0 }}>
          <div className="ph">
            <b>Top health improvers</b>
            <span className="sub2">30-day</span>
          </div>
          <div>
            {impactByCustomer.map((c) => (
              <div key={c.name} className="jt-row">
                <div className="tt2">
                  <b>{c.name}</b>
                </div>
                <Trend value={c.delta} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {showCommercials ? (
        <div className="panel" style={{ marginTop: 18 }}>
          <div className="ph">
            <b>Renewal risk</b>
            <span className="sub2">commercial · role-restricted</span>
          </div>
          <div className="pbody">
            {renewalRows.length === 0 && <div className="empty-note">No accounts at renewal risk.</div>}
            {renewalRows.map((r) => (
              <div key={r.id} className="spread" style={{ padding: "8px 0" }}>
                <span>
                  {r.name} <span className="faint" style={{ fontSize: 12 }}>· {r.tier}</span>
                </span>
                <span className={`pill ${r.band === "High" ? "err" : "warn"}`}>
                  <span className="dot" />
                  {r.band} renewal risk
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="notice" style={{ marginTop: 18 }}>
          <span>
            Commercial overlays (renewal risk, account value) are restricted to executive and account
            roles. You are viewing as <b>{identity.roles[0]}</b>.
          </span>
        </div>
      )}
    </PageShell>
  );
}
