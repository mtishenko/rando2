import { NextResponse } from "next/server";
import { getCustomerModel } from "@/lib/data/compute";
import { REFERENCE_NOW } from "@/lib/data/generate";

/**
 * POST /api/reports/qbr — generate a grounded QBR package.
 *
 * This is a deterministic, evidence-grounded assembler (not a live model call).
 * It honors the AI_GOVERNANCE contract: every output references the customer ID,
 * risk event IDs, supporting finding IDs, sources, evidence timestamps,
 * confidence, model version, and prompt version. When there is insufficient
 * evidence it returns INSUFFICIENT_EVIDENCE rather than inventing content.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { customer_id?: string };
  if (!body.customer_id) {
    return NextResponse.json({ error: "customer_id_required" }, { status: 400 });
  }
  const m = getCustomerModel(body.customer_id);
  if (!m) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const topEvents = m.events.slice(0, 5);
  if (topEvents.length === 0 && m.scores.applicableMetricCount === 0) {
    return NextResponse.json({
      status: "INSUFFICIENT_EVIDENCE",
      customer_id: m.customer.id,
      missing_evidence: ["No applicable metric observations for this customer"],
      verification_steps: ["Confirm capability contracting and connector health"],
    });
  }

  const sources = Array.from(new Set(m.observations.map((o) => o.source))).filter(
    (s) => s !== "All",
  );

  return NextResponse.json({
    status: "OK",
    customer_id: m.customer.id,
    customer_name: m.customer.displayName,
    period_ending: REFERENCE_NOW,
    model_version: "2026.07.0",
    prompt_version: "qbr-narrative@1.0.0",
    confidence: m.scores.confidence,
    summary: `Over the period, ${m.customer.displayName} maintained a Customer Health of ${m.scores.health} with ${m.scores.coverage}% measurement coverage. ${topEvents.length} risk events remain open, led by ${
      topEvents[0]?.title ?? "no critical items"
    }.`,
    business_impact:
      topEvents[0]?.businessImpact ??
      "No material open business risk identified this period.",
    highlights: topEvents.map((e) => ({
      risk_event_id: e.id,
      title: e.title,
      priority_score: e.priorityScore,
      supporting_finding_ids: e.findingIds,
      metric_ids: e.metricIds,
      recommended_action: e.recommendation.action,
      requires_human_approval: e.recommendation.requiresHumanApproval,
    })),
    sources,
    evidence_timestamps: {
      earliest: m.observations
        .map((o) => o.observedAt)
        .filter((t) => t !== REFERENCE_NOW)
        .sort()[0],
      generated_at: REFERENCE_NOW,
    },
    assumptions: [
      "Impact reflects verified outcomes only; ticket closure alone earns no credit.",
      "Scores computed with model version 2026.07.0.",
    ],
    requires_human_approval: true,
  });
}
