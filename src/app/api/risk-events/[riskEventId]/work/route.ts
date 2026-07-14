import { NextResponse } from "next/server";
import { getRiskEvent } from "@/lib/data/compute";
import { workflowEngine } from "@/lib/workflow/instance";
import { REFERENCE_NOW } from "@/lib/data/generate";

/** GET /api/risk-events/{id}/work — current work item for this event. */
export async function GET(_req: Request, { params }: { params: Promise<{ riskEventId: string }> }) {
  const { riskEventId } = await params;
  const item = workflowEngine.getWorkItem(riskEventId);
  return NextResponse.json({ work_item: item ?? null });
}

/**
 * POST /api/risk-events/{id}/work — create accountable HaloPSA work for a risk
 * event. Idempotent (one ticket per event); queues on Halo outage.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ riskEventId: string }> }) {
  const { riskEventId } = await params;
  const found = getRiskEvent(riskEventId);
  if (!found) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const result = await workflowEngine.createWork(
    found.event,
    found.model.customer.displayName,
    REFERENCE_NOW,
  );
  if ("queued" in result) {
    return NextResponse.json({ status: "queued", reason: "halo_unreachable" }, { status: 202 });
  }
  return NextResponse.json({ status: "created", work_item: result });
}
