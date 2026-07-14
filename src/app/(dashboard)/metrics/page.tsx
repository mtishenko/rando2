import { METRIC_CATALOG } from "@/lib/metrics/catalog";
import type { Criticality } from "@/lib/types";
import PageShell from "@/components/PageShell";

export const dynamic = "force-static";

const CRIT_PILL: Record<Criticality, string> = {
  Critical: "err",
  High: "warn",
  Medium: "mut",
  Low: "mut",
};

export default function MetricsPage() {
  const byCategory = METRIC_CATALOG.reduce<Record<string, typeof METRIC_CATALOG>>((acc, m) => {
    (acc[m.category] ??= []).push(m);
    return acc;
  }, {});

  return (
    <PageShell
      title="Metric registry"
      sub={`${METRIC_CATALOG.length} versioned metrics · model v${METRIC_CATALOG[0].version} · every score component maps to one metric version`}
    >
      {Object.entries(byCategory).map(([category, metrics]) => (
        <div className="panel" key={category}>
          <div className="ph">
            <b>{category}</b>
            <span className="sub2">{metrics.length} metrics</span>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Metric</th>
                  <th>Capability</th>
                  <th>Source</th>
                  <th>Target</th>
                  <th>Criticality</th>
                  <th className="num">Weight</th>
                  <th className="num">Freshness</th>
                </tr>
              </thead>
              <tbody>
                {metrics.map((m) => (
                  <tr key={m.id}>
                    <td className="mono faint" style={{ fontSize: 12 }}>
                      {m.id}
                    </td>
                    <td>
                      <div style={{ fontWeight: 550 }}>{m.name}</div>
                      <div className="faint" style={{ fontSize: 12, maxWidth: 360 }}>
                        {m.businessRisk}
                      </div>
                    </td>
                    <td className="muted" style={{ fontSize: 13 }}>
                      {m.capability.replace(/_/g, " ")}
                    </td>
                    <td className="muted" style={{ fontSize: 13 }}>
                      {m.source}
                    </td>
                    <td className="muted">{m.target}</td>
                    <td>
                      <span className={`pill ${CRIT_PILL[m.criticality]}`}>
                        <span className="dot" />
                        {m.criticality}
                      </span>
                    </td>
                    <td className="num muted">{m.weight}</td>
                    <td className="num muted">{m.freshnessThresholdHours}h</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </PageShell>
  );
}
