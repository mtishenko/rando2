import { getPortfolioModel } from "@/lib/data/compute";
import { getMetric } from "@/lib/metrics/catalog";
import { CONNECTORS } from "@/lib/connectors/registry";
import { ALL_ROLES, ALL_PERMISSIONS, permissionsFor } from "@/lib/auth/roles";
import PageShell from "@/components/PageShell";
import { getServerIdentity } from "@/lib/auth/server";
import { can } from "@/lib/auth/guard";

// Dynamic: reads identity (cookie) to enforce admin-only access.
export const dynamic = "force-dynamic";

const FEATURE_FLAGS = [
  { key: "ai_reasoning", label: "AI reasoning layer", on: true },
  { key: "halo_sync", label: "HaloPSA bidirectional sync", on: true },
  { key: "automation_remediation", label: "Low-risk auto-remediation", on: false },
  { key: "customer_portal", label: "Customer portal", on: true },
];

export default async function AdminPage() {
  const identity = await getServerIdentity();
  if (!can(identity, "admin:manage")) {
    return (
      <PageShell title="Administration" sub="Tenants, roles, connectors, metrics, and audit">
        <div className="notice">
          <span>
            Administration is restricted to Platform Admins. You are viewing as{" "}
            <b>{identity.roles[0]}</b>. Privileged changes are role-restricted and audited.
          </span>
        </div>
      </PageShell>
    );
  }

  const pm = getPortfolioModel();
  const integrations = pm.customers.flatMap((m) => m.integrations);
  const unhealthy = integrations.filter((i) => i.state !== "HEALTHY").length;

  // Active exceptions and their (mock) expirations.
  const exceptions = pm.customers.flatMap((m) =>
    m.observations
      .filter((o) => o.state === "EXCEPTION_ACTIVE")
      .map((o) => ({ customer: m.customer.displayName, metric: getMetric(o.metricId).name })),
  );

  return (
    <PageShell title="Administration" sub="Roles, connectors, metrics, feature flags, and audit">
      <div className="panel">
        <div className="ph">
          <b>Roles &amp; permissions</b>
          <span className="sub2">{ALL_ROLES.length} roles</span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>Role</th>
                {ALL_PERMISSIONS.map((p) => (
                  <th key={p} className="num" style={{ fontSize: 9.5 }}>
                    {p}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ALL_ROLES.map((r) => {
                const perms = permissionsFor([r]);
                return (
                  <tr key={r}>
                    <td style={{ fontWeight: 600 }}>{r}</td>
                    {ALL_PERMISSIONS.map((p) => (
                      <td key={p} className="num">
                        {perms.has(p) ? <span className="s-ok">✓</span> : <span className="faint">·</span>}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid cols-2" style={{ alignItems: "start" }}>
        <div className="panel" style={{ marginBottom: 0 }}>
          <div className="ph">
            <b>Connectors</b>
            <span className="sub2">
              {CONNECTORS.length} registered · {unhealthy} sources need attention
            </span>
          </div>
          <div className="pbody">
            {CONNECTORS.map((c) => (
              <div key={c.source} className="spread" style={{ padding: "7px 0" }}>
                <span style={{ fontWeight: 550 }}>{c.source}</span>
                <span className="muted" style={{ fontSize: 13 }}>
                  {c.capability.replace(/_/g, " ")}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="panel" style={{ marginBottom: 0 }}>
          <div className="ph">
            <b>Feature flags</b>
          </div>
          <div className="pbody">
            {FEATURE_FLAGS.map((f) => (
              <div key={f.key} className="spread" style={{ padding: "7px 0" }}>
                <span>{f.label}</span>
                <span className={`pill ${f.on ? "ok" : "mut"}`}>
                  <span className="dot" />
                  {f.on ? "On" : "Off"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="ph">
          <b>Active exceptions</b>
          <span className="sub2">expired exceptions reopen automatically</span>
        </div>
        <div className="pbody">
          {exceptions.length === 0 && <div className="empty-note">No active exceptions.</div>}
          {exceptions.map((x, i) => (
            <div key={i} className="spread" style={{ padding: "7px 0" }}>
              <span>
                {x.customer} <span className="faint">· {x.metric}</span>
              </span>
              <span className="pill warn">
                <span className="dot" />
                Approved risk acceptance
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="notice">
        <span>
          Privileged changes (metric versions, exceptions, automation policies, connector credentials)
          are role-restricted and written to an immutable audit trail. Access is revoked automatically
          when a user is removed from the directory.
        </span>
      </div>
    </PageShell>
  );
}
