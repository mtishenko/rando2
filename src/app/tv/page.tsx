import Link from "next/link";
import { getPortfolioModel } from "@/lib/data/compute";
import { scoreStatus, oneDp, ageLabel } from "@/lib/ui/format";
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
        <div className="tv-brand">
          <span className="mark">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/logomark_purple.png" alt="edgefi" />
          </span>
          <b>
            edgefi <span>pulse</span>
          </b>
        </div>
        <div className="tv-meta">
          <div className="stack">
            <span className="micro">operating day</span>
            <span className="big">{cc.operatingDay}</span>
          </div>
          <div className="stack">
            <span className="micro">data freshness</span>
            <span className="big">{oneDp(cc.dataFreshnessHours)}h</span>
          </div>
          <div className="stack">
            <span className="micro">last refresh</span>
            <span className="big">
              <LiveClock />
            </span>
          </div>
        </div>
      </div>

      <div className="tv-metrics">
        <div className="tv-metric">
          <div className="ml">customer health</div>
          <div className="mv">
            <span className={`s-${scoreStatus(p.health)}`}>{oneDp(p.health)}</span>
          </div>
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
        </div>

        <div className="tv-metric">
          <div className="ml">measurement coverage</div>
          <div className="mv">
            <span className={`s-${scoreStatus(p.coverage)}`}>{oneDp(p.coverage)}</span>
            <span className="mu">%</span>
          </div>
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
        </div>

        <div className="tv-metric">
          <div className="ml">edgefi impact · this month</div>
          <div className="mv">
            <span className="s-edgefi">{oneDp(p.impact.total)}</span>
          </div>
          <div className="mfoot">
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
          <table>
            <thead>
              <tr>
                <th style={{ width: 40 }}>#</th>
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
                  <td className="mono faint">{r.rank}</td>
                  <td className="cust">{r.customer.displayName}</td>
                  <td>
                    <span className={`pill p-${r.priorityBand.toLowerCase()}`}>
                      <span className="dot" />
                      {r.priorityBand} · {r.priorityScore}
                    </span>
                  </td>
                  <td>
                    <span className={`s-${scoreStatus(r.scores.health)}`} style={{ fontWeight: 600 }}>
                      {oneDp(r.scores.health)}
                    </span>
                  </td>
                  <td>
                    <Trend value={r.health7dChange} />
                  </td>
                  <td className="muted">{r.primaryReason}</td>
                  <td className="muted">{ageLabel(r.riskAgeDays)}</td>
                  <td className="muted">{r.owner ?? "—"}</td>
                  <td className="muted" style={{ maxWidth: 300 }}>
                    {r.nextBestAction}
                  </td>
                  <td className="num s-ok" style={{ fontWeight: 600 }}>
                    +{oneDp(r.expectedImprovement)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="tv-caption">
            <span>
              Ranked by priority — business impact, urgency, trend, exposure, and confidence.
              Approved display names only; no users, hosts, IPs, or CVEs.
            </span>
            <span className="tagline">
              <span className="cdot" />
              Contain the chaos.
            </span>
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
    <div className="tv-table-wrap" style={{ padding: 26 }}>
      <h2 style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-.4px" }}>
        All clear — no customers require action today
      </h2>
      <p className="muted" style={{ margin: "6px 0 18px" }}>
        Recent verified wins and coverage improvements:
      </p>
      <div className="wins">
        {wins.map((w) => (
          <div className="win" key={w.customer}>
            <div className="amt">+{w.impactPoints}</div>
            <div style={{ fontWeight: 600, marginTop: 4 }}>{w.customer}</div>
            <div className="muted" style={{ fontSize: 13 }}>
              {w.description}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
