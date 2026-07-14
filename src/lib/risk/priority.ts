import type {
  Customer,
  MetricDefinition,
  MetricObservation,
  PriorityBreakdown,
} from "@/lib/types";
import { CRITICALITY_SEVERITY } from "@/lib/metrics/catalog";
import { clamp01 } from "@/lib/scoring/state";

/**
 * Priority Score (SCORING_MODEL.md):
 *   Priority = Severity × Business Criticality × Exposure × Trend × Age
 *              × Population × Confidence × Responsibility, normalized to 0–1000.
 *
 * The eight factors are each expressed on 0..1. We normalize the product with a
 * geometric mean (so eight sub-unity factors don't collapse toward zero) to get
 * a base in 0..1, then apply explicit boosts/reductions and scale to 0–1000.
 * Every factor is retained in the returned breakdown for full explainability.
 */

/** How much a state contributes to severity on top of criticality. */
function stateSeverityMultiplier(state: MetricObservation["state"]): number {
  switch (state) {
    case "FAIL":
      return 1.0;
    case "PARTIAL":
      return 0.6;
    case "EXPECTED_DATA_MISSING":
      return 0.55;
    case "SOURCE_ERROR":
      return 0.5;
    case "DATA_STALE":
      return 0.45;
    case "UNKNOWN":
      return 0.4;
    default:
      return 0.3;
  }
}

/** Exposure by capability — internet-facing / identity / EDR gaps are more exposed. */
function exposureFor(def: MetricDefinition): number {
  switch (def.capability) {
    case "identity_security":
    case "edr":
    case "m365_security":
      return 1.0;
    case "network_management":
    case "mdr":
      return 0.85;
    case "backup":
      return 0.8;
    case "endpoint_management":
      return 0.7;
    case "service_management":
      return 0.6;
    case "documentation":
    case "grc":
      return 0.5;
    default:
      return 0.6;
  }
}

export interface PriorityContext {
  customer: Customer;
  def: MetricDefinition;
  obs: MetricObservation;
  trend: "improving" | "flat" | "worsening";
  ageDays: number;
  recurrenceCount: number;
  confidence: number;
  /** Edgefi responsibility for this capability (0..1). */
  responsibility: number;
  hasApprovedException: boolean;
  hasCompensatingControl: boolean;
  activeFundedRemediation: boolean;
  executiveEscalation: boolean;
  owner: string | null;
}

export function computePriority(ctx: PriorityContext): PriorityBreakdown {
  const { def, obs } = ctx;

  const severity = clamp01(
    CRITICALITY_SEVERITY[def.criticality] * stateSeverityMultiplier(obs.state),
  );
  const businessCriticality = clamp01(0.2 + (ctx.customer.criticality / 5) * 0.8);
  const exposure = exposureFor(def);
  const trend = ctx.trend === "worsening" ? 1.0 : ctx.trend === "flat" ? 0.7 : 0.4;
  const age = clamp01(0.4 + Math.min(ctx.ageDays, 30) / 30 * 0.6);

  let population = 0.6;
  if (def.populationBased && obs.populationExpected > 0) {
    const affected = (obs.populationExpected - obs.populationObserved) / obs.populationExpected;
    population = clamp01(0.3 + affected * 0.7);
  }

  // Low confidence should not bury an unverified critical control, so floor it.
  const confidence = clamp01(0.5 + ctx.confidence * 0.5);
  const responsibility = clamp01(ctx.responsibility);

  const factors = [
    severity,
    businessCriticality,
    exposure,
    trend,
    age,
    population,
    confidence,
    responsibility,
  ];
  const product = factors.reduce((p, f) => p * Math.max(f, 0.0001), 1);
  const base = Math.pow(product, 1 / factors.length); // geometric mean, 0..1

  const boosts: { label: string; factor: number }[] = [];
  const reductions: { label: string; factor: number }[] = [];

  // --- Boosts (SCORING_MODEL.md) ---
  if (def.id === "EDR-004" || def.id === "IDENTITY-005" || def.id === "HUNTRESS-002") {
    if (obs.state === "FAIL") boosts.push({ label: "Active compromise indicator", factor: 1.35 });
  }
  if ((def.id === "BACKUP-002" || def.id === "BACKUP-003") && obs.state === "FAIL") {
    boosts.push({ label: "Failed production backup", factor: 1.3 });
  }
  if ((def.id === "IDENTITY-001" || def.id === "IDENTITY-004") && obs.state === "FAIL") {
    boosts.push({ label: "Privileged identity exposure", factor: 1.25 });
  }
  if (def.capability === "network_management" && def.category === "Security") {
    boosts.push({ label: "Internet-facing asset", factor: 1.15 });
  }
  if (def.category === "Compliance" && obs.state === "FAIL") {
    boosts.push({ label: "Regulatory deadline", factor: 1.15 });
  }
  if (ctx.recurrenceCount >= 2) {
    boosts.push({ label: "Recurrence", factor: 1.2 });
  }
  if (ctx.executiveEscalation) {
    boosts.push({ label: "Executive escalation", factor: 1.3 });
  }
  if (!ctx.owner) {
    boosts.push({ label: "No owner assigned", factor: 1.1 });
  }

  // --- Reductions (SCORING_MODEL.md) ---
  if (ctx.hasApprovedException || obs.state === "EXCEPTION_ACTIVE") {
    reductions.push({ label: "Approved exception", factor: 0.4 });
  }
  if (ctx.hasCompensatingControl) {
    reductions.push({ label: "Strong compensating control", factor: 0.7 });
  }
  if (ctx.activeFundedRemediation) {
    reductions.push({ label: "Active funded remediation", factor: 0.75 });
  }

  let multiplier = 1;
  for (const b of boosts) multiplier *= b.factor;
  for (const r of reductions) multiplier *= r.factor;

  const raw = clamp01(base * multiplier);

  return {
    severity,
    businessCriticality,
    exposure,
    trend,
    age,
    population,
    confidence,
    responsibility,
    boosts,
    reductions,
    raw,
  };
}

export function priorityScore(breakdown: PriorityBreakdown): number {
  return Math.round(breakdown.raw * 1000);
}

export function priorityBand(score: number): "Critical" | "High" | "Medium" | "Low" {
  if (score >= 750) return "Critical";
  if (score >= 550) return "High";
  if (score >= 350) return "Medium";
  return "Low";
}
