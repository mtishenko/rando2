import Link from "next/link";
import { notFound } from "next/navigation";
import { getRiskEvent, getPortfolioModel } from "@/lib/data/compute";
import { getMetric } from "@/lib/metrics/catalog";
import { oneDp, riskStateLabel, metricStateClass, metricStateLabel, ageLabel } from "@/lib/ui/format";
import PageShell from "@/components/PageShell";
import { buildRiskEventEvidence } from "@/lib/ai/evidence";
import { reason } from "@/lib/ai/reason";

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

  // Grounded AI change explanation (deterministic when no model is configured).
  const evidence = buildRiskEventEvidence(e, m);
  const ai = await reason("change-explanation", evidence);

  return (
    <PageShell
      title={e.title}
      sub={
        <>
          <Link href={`/customers/${m.customer.id}`} className="link">
            {m.customer.displayName}
          </Link>{" "}
          / {riskStateLabel(e.state)} · first seen {ageLabel(e.ageDays)} ago · trend {e.trend} ·
          recurrence ×{e.recurrenceCount}
        </>
      }
      actions={
        <span className={`pill p-${e.priorityBand.toLowerCase()}`} style={{ fontSize: 13, padding: "6px 12px" }}>
          <span className="dot" />
          {e.priorityBand} · {e.priorityScore}/1000
        </span>
      }
    >
      <div className="grid cols-2" style={{ alignItems: "start", marginBottom: 18 }}>
        <div className="panel" style={{ marginBottom: 0 }}>
          <div className="ph">
            <b>Business impact</b>
          </div>
          <div className="pbody">
            <p style={{ fontSize: 14.5, lineHeight: 1.55, marginBottom: 14 }}>{e.businessImpact}</p>
            <dl className="kv">
              <dt>Capability</dt>
              <dd>{e.capability.replace(/_/g, " ")}</dd>
              <dt>Category</dt>
              <dd>{e.category}</dd>
              <dt>Confidence</dt>
              <dd>{oneDp(e.confidence * 100)}%</dd>
              <dt>Owner</dt>
              <dd>{e.owner ?? "unassigned"}</dd>
            </dl>
            {e.tvInclusionReasons.length > 0 && (
              <>
                <div className="divider" />
                <div className="micro" style={{ marginBottom: 6 }}>
                  TV inclusion reasons
                </div>
                <div>
                  {e.tvInclusionReasons.map((r) => (
                    <span className="rtag" key={r}>
                      {r}
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="panel" style={{ marginBottom: 0 }}>
          <div className="ph">
            <b>Priority explainability</b>
            <span className="sub2">normalized 0–1000</span>
          </div>
          <div className="pbody">
            <p className="muted" style={{ fontSize: 12, marginBottom: 10 }}>
              Severity × Business criticality × Exposure × Trend × Age × Population × Confidence ×
              Responsibility.
            </p>
            {factorRows.map((f) => (
              <div className="factor" key={f.label}>
                <span>{f.label}</span>
                <div className="fbar">
                  <span style={{ width: `${f.value * 100}%` }} />
                </div>
                <span className="fval">{f.value.toFixed(2)}</span>
              </div>
            ))}
            {(b.boosts.length > 0 || b.reductions.length > 0) && <div className="divider" />}
            {b.boosts.map((x) => (
              <span className="rtag" key={x.label} style={{ borderColor: "var(--warn)", color: "var(--warn)" }}>
                ↑ {x.label} ×{x.factor}
              </span>
            ))}
            {b.reductions.map((x) => (
              <span className="rtag" key={x.label} style={{ borderColor: "var(--ok)", color: "var(--ok)" }}>
                ↓ {x.label} ×{x.factor}
              </span>
            ))}
            <div className="spread" style={{ marginTop: 14 }}>
              <span className="muted" style={{ fontSize: 12 }}>
                normalized base {b.raw.toFixed(3)}
              </span>
              <span style={{ fontWeight: 700, fontSize: 20 }} className="mono">
                {e.priorityScore}
                <span className="faint" style={{ fontSize: 14 }}>
                  /1000
                </span>
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid cols-2" style={{ alignItems: "start" }}>
        <div className="panel" style={{ marginBottom: 0 }}>
          <div className="ph">
            <b>Recommended next best action</b>
          </div>
          <div className="pbody">
            <p style={{ fontSize: 14.5, fontWeight: 550, marginBottom: 14 }}>{e.recommendation.action}</p>
            <dl className="kv">
              <dt>Suggested owner role</dt>
              <dd>{e.recommendation.suggestedOwnerRole}</dd>
              <dt>Estimated effort</dt>
              <dd>{e.recommendation.estimatedEffortHours} hours</dd>
              <dt>Expected health improvement</dt>
              <dd className="s-ok">+{oneDp(e.recommendation.expectedHealthImprovement)} pts</dd>
              <dt>Expected risk reduction</dt>
              <dd>{Math.round(e.recommendation.expectedRiskReduction * 100)}%</dd>
              <dt>Approval required</dt>
              <dd>{e.recommendation.requiresHumanApproval ? "Yes — human approval" : "No"}</dd>
            </dl>
            <div className="row" style={{ marginTop: 16 }}>
              <button className="btn btn-pri">Create HaloPSA ticket</button>
              <button className="btn btn-ghost">Assign owner</button>
            </div>
          </div>
        </div>

        <div className="panel" style={{ marginBottom: 0 }}>
          <div className="ph">
            <b>Verification gate</b>
          </div>
          <div className="pbody">
            <div
              className="notice"
              style={{
                marginBottom: 16,
                borderColor: e.verificationSatisfied ? "var(--ok)" : "var(--warn)",
                background: e.verificationSatisfied ? "var(--ok-bg)" : "var(--warn-bg)",
                color: e.verificationSatisfied ? "var(--ok)" : "var(--warn)",
              }}
            >
              <span>
                {e.verificationSatisfied ? (
                  <>
                    Verification satisfied — <b>{e.verificationMetricId}</b> is passing. This event
                    may be marked verified resolved.
                  </>
                ) : (
                  <>
                    Not yet verified. Resolution requires <b>{e.verificationMetricId}</b> to pass. A
                    closed ticket alone does not resolve this event — work earns credit only after a
                    verified outcome.
                  </>
                )}
              </span>
            </div>
            <div className="micro" style={{ marginBottom: 8 }}>
              Contributing metrics ({e.metricIds.length})
            </div>
            <table>
              <tbody>
                {e.metricIds.map((mid) => {
                  const def = getMetric(mid);
                  const obs = m.observations.find((o) => o.metricId === mid)!;
                  return (
                    <tr key={mid}>
                      <td style={{ padding: "12px 0" }}>
                        <div style={{ fontWeight: 550 }}>{def.name}</div>
                        <div className="faint mono" style={{ fontSize: 11 }}>
                          {def.id}
                        </div>
                      </td>
                      <td style={{ padding: "12px 0" }}>
                        <span className={`mchip ${metricStateClass(obs.state)}`}>
                          {metricStateLabel(obs.state)}
                        </span>
                      </td>
                      <td className="muted" style={{ padding: "12px 0", fontSize: 13 }}>
                        {obs.evidenceNote}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="panel" style={{ marginTop: 18 }}>
        <div className="ph">
          <b>AI reasoning · change explanation</b>
          <span className="sub2">
            {ai.grounding.engine === "model" ? "model" : "deterministic"} ·{" "}
            {ai.grounding.prompt_id}@{ai.grounding.prompt_version}
          </span>
        </div>
        <div className="pbody">
          {ai.output.status === "INSUFFICIENT_EVIDENCE" ? (
            <div className="notice" style={{ marginBottom: 0 }}>
              <span>
                Insufficient evidence. {ai.output.missing_evidence.join(" ")}
              </span>
            </div>
          ) : (
            <>
              <p style={{ fontSize: 14.5, lineHeight: 1.55, marginTop: 0 }}>{ai.output.summary}</p>
              <dl className="kv" style={{ marginBottom: 14 }}>
                <dt>Business impact</dt>
                <dd>{ai.output.business_impact}</dd>
                <dt>Technical reasoning</dt>
                <dd>{ai.output.technical_reasoning}</dd>
                <dt>Recommended action</dt>
                <dd>{ai.output.recommended_action}</dd>
                <dt>Suggested owner</dt>
                <dd>{ai.output.suggested_owner_role}</dd>
                <dt>Estimated effort</dt>
                <dd>{ai.output.estimated_effort_hours} hours</dd>
                <dt>Confidence</dt>
                <dd>{oneDp(ai.output.confidence * 100)}%</dd>
                <dt>Approval required</dt>
                <dd>{ai.output.requires_human_approval ? "Yes — human approval" : "No"}</dd>
              </dl>
            </>
          )}
          <div className="divider" />
          <div className="micro" style={{ marginBottom: 6 }}>
            Grounding
          </div>
          <div style={{ fontSize: 12.5 }} className="muted">
            Cites {ai.grounding.supporting_finding_ids.length} finding(s) ·{" "}
            {ai.grounding.sources.length > 0 ? ai.grounding.sources.join(", ") : "no external sources"} ·
            model {ai.grounding.model_version} ·{" "}
            {ai.validation.valid ? "validated" : `validation issues: ${ai.validation.issues.join("; ")}`}
          </div>
          <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
            The reasoning layer explains and drafts only — it cannot mark a control passed or an event
            resolved, and every claim is grounded in the redacted evidence above.
          </div>
        </div>
      </div>
    </PageShell>
  );
}
