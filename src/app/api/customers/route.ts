import { NextResponse } from "next/server";
import { getPortfolioModel } from "@/lib/data/compute";

/** GET /api/customers — list visible customers with headline scores. */
export function GET() {
  const pm = getPortfolioModel();
  return NextResponse.json({
    customers: pm.customers.map((m) => ({
      id: m.customer.id,
      display_name: m.customer.displayName,
      tier: m.customer.tier,
      industry: m.customer.industry,
      health: m.scores.health,
      coverage: m.scores.coverage,
      confidence: m.scores.confidence,
      open_events: m.events.length,
      unverified_critical_controls: m.scores.unverifiedCriticalControls,
    })),
  });
}
