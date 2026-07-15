import type { EvidenceContext } from "@/lib/ai/evidence";
import type { TaskId } from "@/lib/ai/prompts";
import { reason } from "@/lib/ai/reason";
import { hasSensitiveContent } from "@/lib/ai/redaction";

/**
 * AI evaluation harness (TESTING_STRATEGY "AI Evaluation": grounding, unsupported
 * statement rate, JSON compliance, regression scenarios). Runs reasoning across a
 * set of cases and reports aggregate quality metrics.
 */

export interface EvalCase {
  taskId: TaskId;
  evidence: EvidenceContext;
  expectStatus: "OK" | "INSUFFICIENT_EVIDENCE";
}

export interface EvalReport {
  total: number;
  groundingAccuracy: number; // share with only valid cited findings
  unsupportedClaimRate: number; // share with any sensitive/leaked content
  jsonComplianceRate: number; // share structurally valid per validator
  statusAccuracy: number; // share whose status matched expectation
  cases: {
    customerId: string;
    riskEventId: string | null;
    status: string;
    grounded: boolean;
    clean: boolean;
    valid: boolean;
    statusMatched: boolean;
  }[];
}

export async function runEvaluation(cases: EvalCase[]): Promise<EvalReport> {
  const results: EvalReport["cases"] = [];

  for (const c of cases) {
    const { output, grounding, validation } = await reason(c.taskId, c.evidence);
    const allowed = new Set(c.evidence.allowed_finding_ids);
    const grounded = output.supporting_finding_ids.every((id) => allowed.has(id));
    const clean = ![
      output.summary,
      output.business_impact,
      output.technical_reasoning,
      output.recommended_action,
    ].some(hasSensitiveContent);

    results.push({
      customerId: grounding.customer_id,
      riskEventId: grounding.risk_event_id,
      status: output.status,
      grounded,
      clean,
      valid: validation.valid,
      statusMatched: output.status === c.expectStatus,
    });
  }

  const total = results.length || 1;
  const share = (pred: (r: EvalReport["cases"][number]) => boolean) =>
    results.filter(pred).length / total;

  return {
    total: results.length,
    groundingAccuracy: share((r) => r.grounded),
    unsupportedClaimRate: share((r) => !r.clean),
    jsonComplianceRate: share((r) => r.valid),
    statusAccuracy: share((r) => r.statusMatched),
    cases: results,
  };
}
