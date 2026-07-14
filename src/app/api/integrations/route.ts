import { NextResponse } from "next/server";
import { getPortfolioModel } from "@/lib/data/compute";

/** GET /api/integrations — integration health across the portfolio. */
export function GET() {
  const pm = getPortfolioModel();
  const integrations = pm.customers.flatMap((m) =>
    m.integrations.map((i) => ({ ...i, customer_name: m.customer.displayName })),
  );
  const total = integrations.length;
  const healthy = integrations.filter((i) => i.state === "HEALTHY").length;
  return NextResponse.json({
    summary: { total, healthy, healthy_pct: Math.round((healthy / total) * 1000) / 10 },
    integrations,
  });
}
