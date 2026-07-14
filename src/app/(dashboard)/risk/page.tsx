import Link from "next/link";
import { getPortfolioModel } from "@/lib/data/compute";
import { ageLabel, riskStateLabel } from "@/lib/ui/format";

export const dynamic = "force-static";

export default function RiskListPage() {
  const pm = getPortfolioModel();
  const nameById = new Map(pm.customers.map((m) => [m.customer.id, m.customer.displayName]));
  const events = pm.allEvents.slice(0, 60);

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Risk Events</h1>
          <div className="page-sub">
            {pm.allEvents.length} open events across the portfolio · ranked by priority
          </div>
        </div>
      </div>

      <div className="panel">
        <div style={{ overflowX: "auto" }}>
          <table className="table">
            <thead>
              <tr>
                <th className="rank">#</th>
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
                <tr key={e.id}>
                  <td className="rank">{i + 1}</td>
                  <td>
                    <Link href={`/risk-events/${e.id}`} className="link" style={{ fontWeight: 600 }}>
                      {e.title}
                    </Link>
                    <div className="muted" style={{ fontSize: 12 }}>
                      {e.primaryReason}
                    </div>
                  </td>
                  <td className="dim">{nameById.get(e.customerId)}</td>
                  <td>
                    <span className={`pill band-${e.priorityBand.toLowerCase()}`}>
                      {e.priorityBand} · {e.priorityScore}
                    </span>
                  </td>
                  <td className="dim">{riskStateLabel(e.state)}</td>
                  <td className="dim">{ageLabel(e.ageDays)}</td>
                  <td className="dim">{e.owner ?? "—"}</td>
                  <td>
                    <span className={e.verificationSatisfied ? "band-excellent" : "band-poor"}>
                      {e.verificationSatisfied ? "Verified" : "Pending"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
