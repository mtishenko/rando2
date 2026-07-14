import { METRIC_CATALOG } from "@/lib/metrics/catalog";

export const dynamic = "force-static";

export default function MetricsPage() {
  const byCategory = METRIC_CATALOG.reduce<Record<string, typeof METRIC_CATALOG>>((acc, m) => {
    (acc[m.category] ??= []).push(m);
    return acc;
  }, {});

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Metric Registry</h1>
          <div className="page-sub">
            {METRIC_CATALOG.length} versioned metrics · model v{METRIC_CATALOG[0].version} · every score
            component maps to one metric version
          </div>
        </div>
      </div>

      {Object.entries(byCategory).map(([category, metrics]) => (
        <div className="panel" key={category} style={{ marginBottom: 16 }}>
          <div className="panel-title">
            {category} · {metrics.length} metrics
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="table">
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
                    <td className="mono dim" style={{ fontSize: 12 }}>
                      {m.id}
                    </td>
                    <td>
                      <span style={{ fontWeight: 600 }}>{m.name}</span>
                      <div className="muted" style={{ fontSize: 12, maxWidth: 360 }}>
                        {m.businessRisk}
                      </div>
                    </td>
                    <td className="dim" style={{ fontSize: 13 }}>
                      {m.capability.replace(/_/g, " ")}
                    </td>
                    <td className="dim" style={{ fontSize: 13 }}>
                      {m.source}
                    </td>
                    <td className="dim">{m.target}</td>
                    <td>
                      <span
                        className={`pill band-${
                          m.criticality === "Critical"
                            ? "critical"
                            : m.criticality === "High"
                              ? "high"
                              : m.criticality === "Medium"
                                ? "medium"
                                : "low"
                        }`}
                      >
                        {m.criticality}
                      </span>
                    </td>
                    <td className="num dim">{m.weight}</td>
                    <td className="num dim">{m.freshnessThresholdHours}h</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </>
  );
}
