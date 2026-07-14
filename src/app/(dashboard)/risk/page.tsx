import Link from "next/link";
import { getPortfolioModel } from "@/lib/data/compute";
import { ageLabel, riskStateLabel } from "@/lib/ui/format";
import PageShell from "@/components/PageShell";

export const dynamic = "force-static";

export default function RiskListPage() {
  const pm = getPortfolioModel();
  const nameById = new Map(pm.customers.map((m) => [m.customer.id, m.customer.displayName]));
  const events = pm.allEvents.slice(0, 60);

  return (
    <PageShell
      title="Risk events"
      sub={`${pm.allEvents.length} open events across the portfolio · ranked by priority`}
    >
      <div className="panel">
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th style={{ width: 34 }}>#</th>
                <th>Risk event</th>
                <th>Customer</th>
                <th>Priority</th>
                <th>State</th>
                <th>Age</th>
                <th>Owner</th>
                <th>Verified?</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e, i) => (
                <tr key={e.id} className="click">
                  <td className="mono faint">{i + 1}</td>
                  <td>
                    <Link href={`/risk-events/${e.id}`} className="link">
                      {e.title}
                    </Link>
                    <div className="faint" style={{ fontSize: 12 }}>
                      {e.primaryReason}
                    </div>
                  </td>
                  <td className="muted">{nameById.get(e.customerId)}</td>
                  <td>
                    <span className={`pill p-${e.priorityBand.toLowerCase()}`}>
                      <span className="dot" />
                      {e.priorityBand} · {e.priorityScore}
                    </span>
                  </td>
                  <td className="muted">{riskStateLabel(e.state)}</td>
                  <td className="muted">{ageLabel(e.ageDays)}</td>
                  <td className="muted">{e.owner ?? "—"}</td>
                  <td>
                    {e.verificationSatisfied ? (
                      <span className="pill ok">
                        <span className="dot" />
                        Verified
                      </span>
                    ) : (
                      <span className="pill mut">
                        <span className="dot" />
                        Pending
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </PageShell>
  );
}
