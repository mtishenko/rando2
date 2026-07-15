import type { EvidenceContext } from "@/lib/ai/evidence";
import type { ReasoningOutput } from "@/lib/ai/schema";
import type { TaskId } from "@/lib/ai/prompts";
import { getMetric } from "@/lib/metrics/catalog";
import { metricStateLabel } from "@/lib/ui/format";

/**
 * Deterministic, fully-grounded assembler used as the fallback when no model is
 * configured (and as the reference the eval harness checks against). It only ever
 * restates supplied evidence — it cannot invent facts — so it satisfies the same
 * grounding contract the model must meet.
 */

function effortFor(criticality: string): number {
  switch (criticality) {
    case "Critical":
      return 4;
    case "High":
      return 3;
    case "Medium":
      return 2;
    default:
      return 1;
  }
}

export function deterministicReasoning(taskId: TaskId, evidence: EvidenceContext): ReasoningOutput {
  // No usable evidence → explicit insufficient-evidence response.
  if (evidence.findings.length === 0) {
    return {
      status: "INSUFFICIENT_EVIDENCE",
      summary: `No open findings available for ${evidence.customer_name}.`,
      business_impact: "",
      technical_reasoning: "",
      recommended_action: "",
      estimated_effort_hours: 0,
      suggested_owner_role: "",
      confidence: evidence.confidence,
      supporting_finding_ids: [],
      assumptions: [],
      missing_evidence: [
        "No applicable metric observations were supplied for this subject.",
        "Verify capability contracting and connector health, then re-evaluate.",
      ],
      requires_human_approval: false,
    };
  }

  const driving = evidence.findings[0];
  const drivingDef = getMetric(driving.metric_id);
  const hasHighImpact = evidence.findings.some(
    (f) => f.criticality === "Critical" || f.criticality === "High",
  );

  const stateSummary = evidence.findings
    .map((f) => `${f.metric_name} (${metricStateLabel(f.state as never)})`)
    .join("; ");

  const summary =
    taskId === "qbr-narrative"
      ? `${evidence.customer_name} has ${evidence.findings.length} open finding(s) this period; the most material is ${driving.metric_name}.`
      : `${evidence.customer_name}: ${driving.metric_name} — ${driving.evidence || metricStateLabel(driving.state as never)}.`;

  const technical =
    taskId === "risk-correlation"
      ? `The findings share the ${evidence.capability ?? "customer"} capability and point to a common gap. Contributing signals: ${stateSummary}.`
      : `Priority ${evidence.priority_score ?? "n/a"} (${evidence.priority_band ?? "n/a"}) is driven by ${driving.metric_name} at ${driving.criticality} criticality. Signals: ${stateSummary}.`;

  return {
    status: "OK",
    summary,
    business_impact: drivingDef.businessRisk,
    technical_reasoning: technical,
    recommended_action: drivingDef.remediation,
    estimated_effort_hours: effortFor(driving.criticality),
    suggested_owner_role: drivingDef.ownerRole,
    confidence: evidence.confidence,
    supporting_finding_ids: evidence.allowed_finding_ids,
    assumptions: [
      "Impact reflects verified outcomes only; ticket closure alone earns no credit.",
      "Generated from deterministic evidence assembly (no model call).",
    ],
    missing_evidence: [],
    requires_human_approval: hasHighImpact,
  };
}
