import Link from "next/link";
import { getPortfolioModel } from "@/lib/data/compute";
import { toSummary } from "@/lib/ui/summary";
import { scoreBand, oneDp } from "@/lib/ui/format";
import { Metric, Trend } from "@/components/ui";
import AttentionBoard from "@/components/AttentionBoard";

export const dynamic = "force-static";

export default function CommandCenterPage() {
  const pm = getPortfolioModel();
  const p = pm.portfolio;
  const summaries = pm.customers.map(toSummary);

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Command Center</h1>
          <div className="page-sub">
            {pm.commandCenter.operatingDay} · {summaries.length} managed customers · data freshness{" "}
            {oneDp(pm.commandCenter.dataFreshnessHours)}h
          </div>
        </div>
        <Link href="/tv" className="btn btn-accent">
          ▦ Launch Office TV
        </Link>
      </div>

      <div className="grid cols-3" style={{ marginBottom: 18 }}>
        <Metric label="Customer Health" value={oneDp(p.health)} band={scoreBand(p.health)}>
          <div className="metric-foot">
            <span>
              30-day <Trend value={p.healthDelta30d} />
            </span>
            <span>
              Target <b>≥ 85</b>
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
            <span>
              <b>{p.unhealthyIntegrations}</b> unhealthy integrations
            </span>
          </div>
        </Metric>

        <Metric label="Edgefi Impact · this month" value={oneDp(p.impact.total)} band="good">
          <div className="metric-foot">
            <span>
              <b>{p.risksResolvedThisMonth}</b> resolved
            </span>
            <span>
              <b>+{oneDp(p.coverageGainedThisMonth)}</b> coverage
            </span>
            <span>
              <b>{p.recurrencesPrevented}</b> recurrences prevented
            </span>
          </div>
        </Metric>
      </div>

      <div className="panel-title" style={{ paddingLeft: 2 }}>
        Customers requiring attention
      </div>
      <AttentionBoard customers={summaries} />

      <div className="notice" style={{ marginTop: 16 }}>
        Confidence supporting metric: portfolio evidence confidence is{" "}
        <b>{oneDp(p.confidence * 100)}%</b>. Missing, stale, and error states reduce coverage and
        confidence and create work — they never silently improve health.
      </div>
    </>
  );
}
