import { getPortfolioModel } from "@/lib/data/compute";
import type { IntegrationState } from "@/lib/types";
import { oneDp } from "@/lib/ui/format";
import PageShell from "@/components/PageShell";

export const dynamic = "force-static";

/** Integration state → status-pill variant (canonical pill semantics). */
const STATE_PILL: Record<IntegrationState, string> = {
  HEALTHY: "ok",
  DEGRADED: "warn",
  RATE_LIMITED: "warn",
  AUTH_FAILED: "err",
  OFFLINE: "err",
  NOT_CONFIGURED: "mut",
  DISABLED: "mut",
};

export default function IntegrationsPage() {
  const pm = getPortfolioModel();
  const rows = pm.customers.flatMap((m) =>
    m.integrations.map((i) => ({ ...i, customerName: m.customer.displayName })),
  );

  const total = rows.length;
  const healthy = rows.filter((r) => r.state === "HEALTHY").length;
  const unhealthy = rows.filter((r) => r.state !== "HEALTHY");
  const criticalUnhealthy = unhealthy.filter((r) => r.critical);

  return (
    <PageShell
      title="Integration health"
      sub={`${healthy}/${total} healthy (${oneDp((healthy / total) * 100)}%) · ${criticalUnhealthy.length} critical sources need attention`}
    >
      <div className="stats">
        <div className="stat">
          <div className="n">{total}</div>
          <div className="l">Total integrations</div>
        </div>
        <div className="stat">
          <div className="n s-ok">{healthy}</div>
          <div className="l">Healthy</div>
        </div>
        <div className={`stat${unhealthy.length ? " hot" : ""}`}>
          <div className="n">{unhealthy.length}</div>
          <div className="l">Need attention</div>
        </div>
        <div className={`stat${criticalUnhealthy.length ? " hot" : ""}`}>
          <div className="n">{criticalUnhealthy.length}</div>
          <div className="l">Critical sources down</div>
        </div>
      </div>

      <div className="panel">
        <div className="ph">
          <b>Sources needing attention</b>
          <span className="sub2">{unhealthy.length} sources</span>
        </div>
        <div style={{ overflowX: "auto" }}>
          {unhealthy.length === 0 ? (
            <div className="empty-note">All integrations healthy.</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Source</th>
                  <th>Customer</th>
                  <th>State</th>
                  <th>Last success</th>
                  <th className="num">Failures</th>
                </tr>
              </thead>
              <tbody>
                {unhealthy
                  .sort((a, b) => Number(b.critical) - Number(a.critical) || b.failureCount - a.failureCount)
                  .map((r, i) => (
                    <tr key={i}>
                      <td>
                        <span style={{ fontWeight: 550 }}>{r.type}</span>
                        {r.critical && (
                          <span className="rtag" style={{ marginLeft: 6 }}>
                            critical source
                          </span>
                        )}
                      </td>
                      <td className="muted">{r.customerName}</td>
                      <td>
                        <span className={`pill ${STATE_PILL[r.state]}`}>
                          <span className="dot" />
                          {r.state}
                        </span>
                      </td>
                      <td className="muted">{oneDp(r.lastSuccessAgeHours)}h ago</td>
                      <td className="num muted">{r.failureCount}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="panel">
        <div className="ph">
          <b>All integrations</b>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>Source</th>
                <th>Customer</th>
                <th>Capability</th>
                <th>State</th>
                <th className="num">Last success</th>
                <th className="num">Failures</th>
              </tr>
            </thead>
            <tbody>
              {rows
                .sort((a, b) => a.customerName.localeCompare(b.customerName))
                .map((r, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 550 }}>{r.type}</td>
                    <td className="muted">{r.customerName}</td>
                    <td className="muted">{r.capability.replace(/_/g, " ")}</td>
                    <td>
                      <span className={`pill ${STATE_PILL[r.state]}`}>
                        <span className="dot" />
                        {r.state}
                      </span>
                    </td>
                    <td className="num muted">{oneDp(r.lastSuccessAgeHours)}h</td>
                    <td className="num muted">{r.failureCount}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </PageShell>
  );
}
