import Link from "next/link";
import { notFound } from "next/navigation";
import { getRiskEvent, getPortfolioModel } from "@/lib/data/compute";
import { getMetric } from "@/lib/metrics/catalog";
import { oneDp, riskStateLabel, metricStateClass, metricStateLabel, ageLabel } from "@/lib/ui/format";

export const dynamic = "force-static";

export function generateStaticParams() {
  return getPortfolioModel().allEvents.map((e) => ({ id: e.id }));
}

const FACTOR_LABELS: Record<string, string> = {
  severity: "Severity",
  businessCriticality: "Business criticality",
  exposure: "Exposure",
  trend: "Trend",
  age: "Age",
  population: "Population affected",
  confidence: "Confidence",
  responsibility: "Responsibility",
};

export default async function RiskEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const found = getRiskEvent(id);
  if (!found) notFound();
  const { event: e, model: m } = found;
  const b = e.breakdown;

  const factorRows = (
    ["severity", "businessCriticality", "exposure", "trend", "age", "population", "confidence", "responsibility"] as const
  ).map((k) => ({ label: FACTOR_LABELS[k], value: b[k] as number }));

  return (
    <>
      <div className="page-head">
        <div>
          <div className="muted" style={{ fontSize: 13, marginBottom: 4 }}>
            <Link href="/" className="link">
              Command Center
            </Link>{" "}
            /{" "}
            <Link href={`/customers/${m.customer.id}`} className="link">
              {m.customer.displayName}
            </Link>
          </div>
          <h1 className="page-title">{e.title}</h1>
          <div className="page-sub">
            {riskStateLabel(e.state)} · first seen {ageLabel(e.ageDays)} ago · trend {e.trend} ·
            recurrence ×{e.recurrenceCount}
          </div>
        </div>
        <div className="stack" style={{ alignItems: "flex-end", gap: 8 }}>
          <span className={`pill band-${e.priorityBand.toLowerCase()}`} style={{ fontSize: 15, padding: "6px 14px" }}>
            {e.priorityBand} · {e.priorityScore}/1000
          </span>
          <span className="muted" style={{ fontSize: 12 }}>
            Owner: <b>{e.owner ?? "unassigned"}</b>
          </span>
        </div>
      </div>

      <div className="grid cols-2" style={{ alignItems: "start", marginBottom: 18 }}>
        <div className="panel">
          <div className="panel-title">Business impact</div>
          <p style={{ marginTop: 0, fontSize: 15, lineHeight: 1.5 }}>{e.businessImpact}</p>
          <div className="divider" />
          <dl className="kv">
            <dt>Capability</dt>
            <dd>{e.capability.replace(/_/g, " ")}</dd>
            <dt>Category</dt>
            <dd>{e.category}</dd>
            <dt>Confidence</dt>
            <dd>{oneDp(e.confidence * 100)}%</dd>
            <dt>Primary reason</dt>
            <dd>{e.primaryReason}</dd>
          </dl>
          {e.tvInclusionReasons.length > 0 && (
            <>
              <div className="divider" />
              <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
                TV inclusion reasons
              </div>
              <div className="reason-tags">
                {e.tvInclusionReasons.map((r) => (
                  <span className="tag" key={r}>
                    {r}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="panel">
          <div className="panel-title">Priority explainability</div>
          <p className="muted" style={{ marginTop: 0, fontSize: 12 }}>
            Priority = Severity × Business criticality × Exposure × Trend × Age × Population ×
            Confidence × Responsibility, normalized 0–1000.
          </p>
          {factorRows.map((f) => (
            <div className="factor" key={f.label}>
              <span>{f.label}</span>
              <div className="fbar">
                <span style={{ width: `${f.value * 100}%` }} />
              </div>
              <span className="mono dim" style={{ textAlign: "right" }}>
                {f.value.toFixed(2)}
              </span>
            </div>
          ))}
          <div className="divider" />
          {b.boosts.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <span className="muted" style={{ fontSize: 12 }}>
                Boosts:{" "}
              </span>
              {b.boosts.map((x) => (
                <span className="tag" key={x.label} style={{ borderColor: "var(--band-high)" }}>
                  {x.label} ×{x.factor}
                </span>
              ))}
            </div>
          )}
          {b.reductions.length > 0 && (
            <div>
              <span className="muted" style={{ fontSize: 12 }}>
                Reductions:{" "}
              </span>
              {b.reductions.map((x) => (
                <span className="tag" key={x.label} style={{ borderColor: "var(--excellent)" }}>
                  {x.label} ×{x.factor}
                </span>
              ))}
            </div>
          )}
          <div className="spread" style={{ marginTop: 12 }}>
            <span className="muted" style={{ fontSize: 12 }}>
              Normalized base {b.raw.toFixed(3)}
            </span>
            <span style={{ fontWeight: 800, fontSize: 20 }}>{e.priorityScore}/1000</span>
          </div>
        </div>
      </div>

      <div className="grid cols-2" style={{ alignItems: "start", marginBottom: 18 }}>
        <div className="panel">
          <div className="panel-title">Recommended next best action</div>
          <p style={{ marginTop: 0, fontSize: 15, fontWeight: 600 }}>{e.recommendation.action}</p>
          <dl className="kv" style={{ marginTop: 12 }}>
            <dt>Suggested owner role</dt>
            <dd>{e.recommendation.suggestedOwnerRole}</dd>
            <dt>Estimated effort</dt>
            <dd>{e.recommendation.estimatedEffortHours} hours</dd>
            <dt>Expected health improvement</dt>
            <dd className="band-good">+{oneDp(e.recommendation.expectedHealthImprovement)} pts</dd>
            <dt>Expected risk reduction</dt>
            <dd>{Math.round(e.recommendation.expectedRiskReduction * 100)}%</dd>
            <dt>Approval required</dt>
            <dd>{e.recommendation.requiresHumanApproval ? "Yes — human approval" : "No"}</dd>
          </dl>
          <div className="row" style={{ marginTop: 14, gap: 10 }}>
            <button className="btn btn-accent">Create HaloPSA ticket</button>
            <button className="btn">Assign owner</button>
          </div>
        </div>

        <div className="panel">
          <div className="panel-title">Verification gate</div>
          <div
            className="notice"
            style={{
              borderColor: e.verificationSatisfied ? "rgba(52,211,153,0.4)" : "rgba(251,146,60,0.4)",
              background: e.verificationSatisfied ? "rgba(52,211,153,0.08)" : "rgba(251,146,60,0.08)",
            }}
          >
            {e.verificationSatisfied ? (
              <>
                Verification satisfied — <b>{e.verificationMetricId}</b> is passing. This event may be
                marked <b>Verified Resolved</b>.
              </>
            ) : (
              <>
                Not yet verified. Resolution requires <b>{e.verificationMetricId}</b> to pass. A closed
                ticket alone does not resolve this event — work only earns credit after a verified
                outcome.
              </>
            )}
          </div>
          <div className="divider" />
          <div className="panel-title" style={{ marginBottom: 8 }}>
            Contributing metrics ({e.metricIds.length})
          </div>
          <table className="table">
            <tbody>
              {e.metricIds.map((mid) => {
                const def = getMetric(mid);
                const obs = m.observations.find((o) => o.metricId === mid)!;
                return (
                  <tr key={mid}>
                    <td>
                      <span style={{ fontWeight: 600 }}>{def.name}</span>
                      <div className="muted mono" style={{ fontSize: 11 }}>
                        {def.id}
                      </div>
                    </td>
                    <td>
                      <span className={`chip ${metricStateClass(obs.state)}`}>
                        {metricStateLabel(obs.state)}
                      </span>
                    </td>
                    <td className="dim" style={{ fontSize: 13 }}>
                      {obs.evidenceNote}
                    </td>
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
