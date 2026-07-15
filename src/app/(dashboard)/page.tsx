import Link from "next/link";
import { getPortfolioModel } from "@/lib/data/compute";
import { toSummary } from "@/lib/ui/summary";
import { oneDp } from "@/lib/ui/format";
import { Metric, Trend } from "@/components/ui";
import AttentionBoard from "@/components/AttentionBoard";
import PageShell from "@/components/PageShell";

export const dynamic = "force-static";

export default function CommandCenterPage() {
  const pm = getPortfolioModel();
  const p = pm.portfolio;
  const summaries = pm.customers.map(toSummary);

  return (
    <PageShell
      title="Command center"
      sub={`${pm.commandCenter.operatingDay} · ${summaries.length} managed customers · data freshness ${oneDp(
        pm.commandCenter.dataFreshnessHours,
      )}h`}
      actions={
        <Link href="/tv" className="btn btn-pri">
          Launch office TV
        </Link>
      }
    >
      <div className="grid cols-3" style={{ marginBottom: 22 }}>
        <Metric label="Customer health" value={p.health}>
          <div className="mfoot">
            <span>
              30-day <Trend value={p.healthDelta30d} />
            </span>
            <span>
              target <b>≥ 85</b>
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
            <span>
              <b>{p.unhealthyIntegrations}</b> unhealthy integrations
            </span>
          </div>
        </Metric>

        <Metric label="edgefi impact · this month" value={p.impact.total} tone="edgefi">
          <div className="mfoot">
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

      <AttentionBoard customers={summaries} />

      <div className="notice">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8h.01M11 12h1v4h1" />
        </svg>
        <span>
          Evidence confidence across the portfolio is <b>{oneDp(p.confidence * 100)}%</b>. Missing,
          stale, and error states reduce coverage and confidence and create work — they never
          silently improve health.
        </span>
      </div>
    </PageShell>
  );
}
