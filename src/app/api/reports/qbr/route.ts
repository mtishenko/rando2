import { NextResponse } from "next/server";
import { getCustomerModel } from "@/lib/data/compute";
import { REFERENCE_NOW } from "@/lib/data/generate";
import { buildCustomerEvidence } from "@/lib/ai/evidence";
import { reason } from "@/lib/ai/reason";

/**
 * POST /api/reports/qbr — generate a grounded QBR narrative via the AI reasoning
 * layer (PRD-013). The reasoning layer uses the model when configured and the
 * deterministic grounded assembler otherwise; either way the output is validated
 * and carries full grounding metadata (customer, findings, sources, timestamps,
 * model + prompt version). Report generation never changes live configuration.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { customer_id?: string };
  if (!body.customer_id) {
    return NextResponse.json({ error: "customer_id_required" }, { status: 400 });
  }
  const model = getCustomerModel(body.customer_id);
  if (!model) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const evidence = buildCustomerEvidence(model);
  const { output, grounding, validation } = await reason("qbr-narrative", evidence);

  return NextResponse.json({
    customer_id: model.customer.id,
    customer_name: model.customer.displayName,
    period_ending: REFERENCE_NOW,
    scores: {
      health: model.scores.health,
      coverage: model.scores.coverage,
      confidence: model.scores.confidence,
    },
    reasoning: output,
    grounding,
    validation,
  });
}
