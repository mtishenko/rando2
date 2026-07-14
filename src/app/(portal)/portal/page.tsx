import Link from "next/link";
import { getPortfolioModel } from "@/lib/data/compute";

export const dynamic = "force-static";

/**
 * Demo entry point. In production this route resolves to the signed-in customer's
 * own tenant — a customer never sees other organizations (tenant isolation,
 * PRD-010). Here we list the seed customers so the portal is browsable.
 */
export default function PortalIndex() {
  const pm = getPortfolioModel();
  const customers = [...pm.customers].sort((a, b) =>
    a.customer.displayName.localeCompare(b.customer.displayName),
  );

  return (
    <>
      <h1 className="page-title" style={{ fontSize: 23 }}>
        Your organization
      </h1>
      <div className="page-sub" style={{ marginBottom: 18 }}>
        Select your organization to open its portal. In production you would land here signed in — you
        only ever see your own account.
      </div>
      <div className="panel">
        {customers.map((m) => (
          <Link
            key={m.customer.id}
            href={`/portal/${m.customer.id}`}
            className="work-item"
            style={{ textDecoration: "none", padding: "14px 20px" }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600 }}>{m.customer.displayName}</div>
              <div className="faint" style={{ fontSize: 12 }}>
                {m.customer.tier} · {m.customer.industry}
              </div>
            </div>
            <span className="link">Open portal →</span>
          </Link>
        ))}
      </div>
    </>
  );
}
