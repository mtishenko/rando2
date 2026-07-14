import type { MetricDefinition, MetricObservation, Recommendation } from "@/lib/types";
import { stableId } from "@/lib/util/rng";
import { clamp01 } from "@/lib/scoring/state";
import { metricScore } from "@/lib/scoring/state";
import { CRITICALITY_SEVERITY } from "@/lib/metrics/catalog";

/** Rough effort estimate (hours) by criticality and whether a population is involved. */
function estimateEffort(def: MetricDefinition, obs: MetricObservation): number {
  const base: Record<string, number> = { Critical: 4, High: 3, Medium: 2, Low: 1 };
  let hours = base[def.criticality] ?? 2;
  if (def.populationBased && obs.populationExpected > 0) {
    const gap = Math.max(0, obs.populationExpected - obs.populationObserved);
    hours += Math.min(8, gap * 0.25);
  }
  return Math.round(hours * 2) / 2;
}

export function buildRecommendation(
  riskEventId: string,
  def: MetricDefinition,
  obs: MetricObservation,
  totalScorableWeight: number,
): Recommendation {
  // If this metric moved to PASS, health gains its weighted share of the deficit.
  const currentScore = obs.state === "PASS" || obs.state === "EXCEPTION_ACTIVE"
    ? 1
    : obs.state === "PARTIAL" || obs.state === "FAIL"
      ? metricScore(obs)
      : 0;
  const deficit = 1 - currentScore;
  const expectedHealthImprovement =
    totalScorableWeight > 0
      ? Math.round((def.weight / totalScorableWeight) * 100 * deficit * 10) / 10
      : 0;
  const expectedRiskReduction = clamp01(CRITICALITY_SEVERITY[def.criticality] * deficit);

  return {
    id: stableId(`rec|${riskEventId}`),
    riskEventId,
    action: def.remediation,
    suggestedOwnerRole: def.ownerRole,
    estimatedEffortHours: estimateEffort(def, obs),
    expectedHealthImprovement,
    expectedRiskReduction: Math.round(expectedRiskReduction * 100) / 100,
    // High-impact remediation requires human approval (AI_GOVERNANCE.md).
    requiresHumanApproval: def.criticality === "Critical" || def.criticality === "High",
  };
}
