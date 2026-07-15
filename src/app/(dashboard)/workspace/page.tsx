import Link from "next/link";
import { getPortfolioModel } from "@/lib/data/compute";
import { getMetric } from "@/lib/metrics/catalog";
import { ageLabel, metricStateClass, metricStateLabel } from "@/lib/ui/format";
import PageShell from "@/components/PageShell";
import { getServerIdentity } from "@/lib/auth/server";
import { can } from "@/lib/auth/guard";

// Dynamic: reads identity (cookie) to enforce role-appropriate access.
export const dynamic = "force-dynamic";

export default async function WorkspacePage() {
  const identity = await getServerIdentity();
  if (!can(identity, "risk:manage")) {
    return (
      <PageShell title="Engineer workspace" sub="Assigned work and closure evidence">
        <div className="notice">
          <span>
            The engineer workspace is available to engineers, service managers, and security admins.
            You are viewing as <b>{identity.roles[0]}</b>.
          </span>
        </div>
      </PageShell>
    );
  }

  const pm = getPortfolioModel();
  const modelById = new Map(pm.customers.map((m) => [m.customer.id, m]));
  const queue = pm.allEvents
    .filter((e) => e.owner)
    .sort((a, b) => b.priorityScore - a.priorityScore)
    .slice(0, 20);

  return (
    <PageShell
      title="Engineer workspace"
      sub={`${queue.length} assigned events · evidence, runbooks, and verification in one place`}
    >
      {queue.map((e) => {
        const model = modelById.get(e.customerId)!;
        const def = getMetric(e.metricIds[0]);
        return (
          <div className="panel" key={e.id}>
            <div className="ph">
              <b>
                <Link href={`/risk-events/${e.id}`} className="link">
                  {e.title}
                </Link>
              </b>
              <span className="sub2">
                {model.customer.displayName} · owner {e.owner} · age {ageLabel(e.ageDays)} · recurrence ×
                {e.recurrenceCount}
              </span>
            </div>
            <div className="pbody">
              <div className="grid cols-2" style={{ alignItems: "start" }}>
                <div>
                  <div className="micro" style={{ marginBottom: 8 }}>
                    Technical evidence
                  </div>
                  <table>
                    <tbody>
                      {e.metricIds.map((mid) => {
                        const obs = model.observations.find((o) => o.metricId === mid)!;
                        const d = getMetric(mid);
                        return (
                          <tr key={mid}>
                            <td style={{ padding: "8px 0" }}>
                              <div style={{ fontWeight: 550, fontSize: 13 }}>{d.name}</div>
                              <div className="faint mono" style={{ fontSize: 11 }}>
                                {d.id}
                              </div>
                            </td>
                            <td style={{ padding: "8px 0" }}>
                              <span className={`mchip ${metricStateClass(obs.state)}`}>
                                {metricStateLabel(obs.state)}
                              </span>
                            </td>
                            <td className="muted" style={{ padding: "8px 0", fontSize: 12.5 }}>
                              {obs.evidenceNote}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div>
                  <dl className="kv" style={{ gridTemplateColumns: "150px 1fr" }}>
                    <dt>Runbook</dt>
                    <dd>{def.remediation}</dd>
                    <dt>Estimated effort</dt>
                    <dd>{e.recommendation.estimatedEffortHours} hours</dd>
                    <dt>Verification</dt>
                    <dd>
                      {e.verificationMetricId} must pass —{" "}
                      {e.verificationSatisfied ? (
                        <span className="s-ok">satisfied</span>
                      ) : (
                        <span className="s-warn">pending</span>
                      )}
                    </dd>
                    <dt>Expected gain</dt>
                    <dd className="s-ok">+{e.recommendation.expectedHealthImprovement} pts</dd>
                  </dl>
                  <div className="row" style={{ marginTop: 14 }}>
                    <button className="btn btn-pri btn-sm">Acknowledge</button>
                    <button className="btn btn-ghost btn-sm">Request exception</button>
                    <button className="btn btn-ghost btn-sm" disabled={!e.verificationSatisfied}>
                      Close (verified)
                    </button>
                  </div>
                  {!e.verificationSatisfied && (
                    <div className="faint" style={{ fontSize: 12, marginTop: 8 }}>
                      Closure requires the verification metric to pass.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </PageShell>
  );
}
