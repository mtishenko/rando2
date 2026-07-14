import { NextResponse } from "next/server";
import { getRiskEvent } from "@/lib/data/compute";

/** GET /api/risk-events/{riskEventId} — risk event detail. */
export async function GET(_req: Request, { params }: { params: Promise<{ riskEventId: string }> }) {
  const { riskEventId } = await params;
  const found = getRiskEvent(riskEventId);
  if (!found) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ risk_event: found.event, customer_id: found.model.customer.id });
}

/**
 * PATCH /api/risk-events/{riskEventId} — update owner, status, or acknowledgement.
 * Resolution to VERIFIED_RESOLVED is gated: it is only accepted when the event's
 * verification metric is passing (SCORING_MODEL / TESTING_STRATEGY scenario 3).
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ riskEventId: string }> }) {
  const { riskEventId } = await params;
  const found = getRiskEvent(riskEventId);
  if (!found) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as {
    state?: string;
    owner?: string;
    acknowledged?: boolean;
  };

  if (body.state === "VERIFIED_RESOLVED" && !found.event.verificationSatisfied) {
    return NextResponse.json(
      {
        error: "verification_required",
        message: `Cannot resolve: verification metric ${found.event.verificationMetricId} is not passing.`,
        verification_metric_id: found.event.verificationMetricId,
      },
      { status: 409 },
    );
  }

  return NextResponse.json({
    ok: true,
    risk_event_id: riskEventId,
    applied: {
      state: body.state ?? found.event.state,
      owner: body.owner ?? found.event.owner,
      acknowledged: body.acknowledged ?? false,
    },
    audit: {
      action: "risk_event.update",
      model_version: "2026.07.0",
    },
  });
}
