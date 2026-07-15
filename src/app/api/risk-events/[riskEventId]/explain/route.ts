import { NextResponse } from "next/server";
import { getRiskEvent } from "@/lib/data/compute";
import { buildRiskEventEvidence } from "@/lib/ai/evidence";
import { reason } from "@/lib/ai/reason";

/**
 * POST /api/risk-events/{id}/explain — grounded change explanation for a risk
 * event (PRD-007). Returns the validated reasoning output plus grounding
 * metadata. The AI cannot mark the event passed or resolved.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ riskEventId: string }> }) {
  const { riskEventId } = await params;
  const found = getRiskEvent(riskEventId);
  if (!found) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const evidence = buildRiskEventEvidence(found.event, found.model);
  const { output, grounding, validation } = await reason("change-explanation", evidence);

  return NextResponse.json({ reasoning: output, grounding, validation });
}
