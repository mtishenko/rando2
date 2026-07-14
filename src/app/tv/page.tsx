import Link from "next/link";
import { getPortfolioModel } from "@/lib/data/compute";
import { scoreBand, signed, ageLabel, oneDp } from "@/lib/ui/format";
import { Trend } from "@/components/ui";
import LiveClock from "@/components/LiveClock";

export const dynamic = "force-static";

export default function TvPage() {
  const { commandCenter: cc } = getPortfolioModel();
  const p = cc.portfolio;
  const rows = cc.topAttention;

  return (
    <div className="tv">
      <div className="tv-head">
        <div className="tv-title">
          <span className="brand-mark">P</span>
          <div className="stack" style={{ gap: 2 }}>
            <h1>Edgefi Pulse</h1>
            <span className="brand-sub">Operations Command Center</span>
          </div>
        </div>
        <div className="tv-meta">
          <div className="stack">
            <span className="lbl">Operating day</span>
            <span className="big">{cc.operatingDay}</span>
          </div>
          <div className="stack">
            <span className="lbl">Data freshness</span>
            <span className="big">{oneDp(cc.dataFreshnessHours)}h</span>
          </div>
          <div className="stack">
            <span className="lbl">Last refresh</span>
            <LiveClock />
          </div>
        </div>
      </div>

      <div className="tv-metrics">
        <div className="tv-metric">
          <div className="metric-label">Customer Health</div>
          <div className="metric-value">
            <span className={`band-${scoreBand(p.health)}`}>{oneDp(p.health)}</span>
          </div>
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
        </div>

        <div className="tv-metric">
          <div className="metric-label">Measurement Coverage</div>
          <div className="metric-value">
            <span className={`band-${scoreBand(p.coverage)}`}>{oneDp(p.coverage)}</span>
            <span className="metric-unit">%</span>
          </div>
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
        </div>

        <div className="tv-metric">
          <div className="metric-label">Edgefi Impact · this month</div>
          <div className="metric-value">
            <span className="band-good">{oneDp(p.impact.total)}</span>
          </div>
          <div className="metric-foot">
            <span>
              <b>{p.risksResolvedThisMonth}</b> risks resolved
            </span>
            <span>
              <b>+{oneDp(p.coverageGainedThisMonth)}</b> coverage gained
            </span>
            <span>
              <b>{p.recurrencesPrevented}</b> recurrences prevented
            </span>
          </div>
        </div>
      </div>

      {rows.length >= 1 ? (
        <div className="tv-table-wrap">
          <table className="tv-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Customer</th>
                <th>Priority</th>
                <th>Health</th>
                <th>7-day</th>
                <th>Primary reason</th>
                <th>Age</th>
                <th>Owner</th>
                <th>Next best action</th>
                <th className="num">Exp. Δ</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.customer.id}>
                  <td className="rank">{r.rank}</td>
                  <td className="cust">{r.customer.displayName}</td>
                  <td>
                    <span className={`pill band-${r.priorityBand.toLowerCase()}`}>
                      {r.priorityBand} · {r.priorityScore}
                    </span>
                  </td>
                  <td>
                    <span className={`band-${scoreBand(r.scores.health)}`} style={{ fontWeight: 700 }}>
                      {oneDp(r.scores.health)}
                    </span>
                  </td>
                  <td>
                    <Trend value={r.health7dChange} />
                  </td>
                  <td className="dim">{r.primaryReason}</td>
                  <td className="dim">{ageLabel(r.riskAgeDays)}</td>
                  <td className="dim">{r.owner ?? "—"}</td>
                  <td className="dim" style={{ maxWidth: 320 }}>
                    {r.nextBestAction}
                  </td>
                  <td className="num band-good">+{signed(r.expectedImprovement).replace("+", "")}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="tv-caption">
            <span>
              Ranked by priority (business impact, urgency, trend, exposure, confidence) — not lowest
              health. Display names only; no hosts, users, IPs, or CVEs shown.
            </span>
            <Link href="/" className="link">
              Open Command Center →
            </Link>
          </div>
        </div>
      ) : (
        <EmptyState wins={cc.verifiedWins} />
      )}
    </div>
  );
}

function EmptyState({ wins }: { wins: { customer: string; description: string; impactPoints: number }[] }) {
  return (
    <div className="tv-table-wrap" style={{ padding: 28 }}>
      <h2 style={{ marginBottom: 6 }}>All clear — no customers require action today</h2>
      <p className="dim" style={{ marginTop: 0 }}>
        Recent verified wins and coverage improvements:
      </p>
      <div className="wins">
        {wins.map((w) => (
          <div className="win" key={w.customer}>
            <div className="amt">+{w.impactPoints}</div>
            <div style={{ fontWeight: 700, marginTop: 4 }}>{w.customer}</div>
            <div className="dim" style={{ fontSize: 13 }}>
              {w.description}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
