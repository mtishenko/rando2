import { NextResponse } from "next/server";
import { getRiskEvent } from "@/lib/data/compute";

/** GET /api/risk-events/{riskEventId}/recommendations — next-best-action(s). */
export async function GET(_req: Request, { params }: { params: Promise<{ riskEventId: string }> }) {
  const { riskEventId } = await params;
  const found = getRiskEvent(riskEventId);
  if (!found) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ recommendations: [found.event.recommendation] });
}
