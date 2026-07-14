import Link from "next/link";
import { getPortfolioModel } from "@/lib/data/compute";
import type { IntegrationState } from "@/lib/types";
import { oneDp } from "@/lib/ui/format";

export const dynamic = "force-static";

const STATE_CLASS: Record<IntegrationState, string> = {
  HEALTHY: "state-pass",
  DEGRADED: "state-partial",
  RATE_LIMITED: "state-partial",
  AUTH_FAILED: "state-fail",
  OFFLINE: "state-fail",
  NOT_CONFIGURED: "state-na",
  DISABLED: "state-na",
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
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Integration Health</h1>
          <div className="page-sub">
            {healthy}/{total} healthy ({oneDp((healthy / total) * 100)}%) · {criticalUnhealthy.length}{" "}
            critical sources need attention
          </div>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 18 }}>
        <div className="panel-title">Sources needing attention ({unhealthy.length})</div>
        {unhealthy.length === 0 && <div className="muted">All integrations healthy.</div>}
        <div style={{ overflowX: "auto" }}>
          <table className="table">
            <tbody>
              {unhealthy
                .sort((a, b) => Number(b.critical) - Number(a.critical) || b.failureCount - a.failureCount)
                .map((r, i) => (
                  <tr key={i}>
                    <td>
                      <span style={{ fontWeight: 600 }}>{r.type}</span>
                      {r.critical && (
                        <span className="tag" style={{ marginLeft: 8, borderColor: "var(--band-critical)" }}>
                          critical
                        </span>
                      )}
                    </td>
                    <td className="dim">{r.customerName}</td>
                    <td>
                      <span className={`chip ${STATE_CLASS[r.state]}`}>{r.state}</span>
                    </td>
                    <td className="dim">last success {oneDp(r.lastSuccessAgeHours)}h ago</td>
                    <td className="dim">{r.failureCount} failures</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel">
        <div className="panel-title">All integrations</div>
        <div style={{ overflowX: "auto" }}>
          <table className="table">
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
                    <td style={{ fontWeight: 600 }}>{r.type}</td>
                    <td className="dim">{r.customerName}</td>
                    <td className="dim">{r.capability.replace(/_/g, " ")}</td>
                    <td>
                      <span className={`chip ${STATE_CLASS[r.state]}`}>{r.state}</span>
                    </td>
                    <td className="num dim">{oneDp(r.lastSuccessAgeHours)}h</td>
                    <td className="num dim">{r.failureCount}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
