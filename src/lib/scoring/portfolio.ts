import type {
  Customer,
  CustomerScores,
  CustomerTier,
  ImpactBreakdown,
} from "@/lib/types";
import { clamp01 } from "@/lib/scoring/state";
import { round1 } from "@/lib/scoring/customer";

/** Tier weighting inputs for portfolio aggregation. */
const TIER_WEIGHT: Record<CustomerTier, number> = {
  Strategic: 4,
  Enterprise: 3,
  Core: 2,
  Foundation: 1,
};

/** No single customer may contribute more than this share of a weighted pool. */
const SINGLE_CUSTOMER_CAP = 0.2;

interface Weighted {
  value: number;
  weight: number;
}

/** Weighted mean with a per-item cap so one large item cannot dominate. */
function cappedWeightedMean(items: Weighted[]): number {
  const totalRaw = items.reduce((s, i) => s + i.weight, 0);
  if (totalRaw === 0) return 0;
  const cap = totalRaw * SINGLE_CUSTOMER_CAP;
  const capped = items.map((i) => ({ value: i.value, weight: Math.min(i.weight, cap) }));
  const total = capped.reduce((s, i) => s + i.weight, 0);
  if (total === 0) return 0;
  return capped.reduce((s, i) => s + i.value * i.weight, 0) / total;
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

/**
 * Portfolio aggregation of a customer-level metric (SCORING_MODEL.md):
 *   50% equal customer weighting
 *   30% customer-tier weighting
 *   20% managed-population weighting
 */
export function aggregatePortfolioMetric(
  customers: Customer[],
  valueFor: (c: Customer) => number,
): number {
  if (customers.length === 0) return 0;
  const equal = mean(customers.map(valueFor));
  const tier = cappedWeightedMean(
    customers.map((c) => ({ value: valueFor(c), weight: TIER_WEIGHT[c.tier] })),
  );
  const population = cappedWeightedMean(
    customers.map((c) => ({ value: valueFor(c), weight: Math.max(1, c.managedPopulation) })),
  );
  return round1(0.5 * equal + 0.3 * tier + 0.2 * population);
}

export interface ImpactInputs {
  /** 0..1 share of open critical risk that was verifiably reduced this period. */
  verifiedRiskReduction: number;
  /** Portfolio health improvement in points, normalized to 0..1 (÷ typical 10pt swing). */
  healthImprovementPoints: number;
  /** Portfolio coverage improvement in points. */
  coverageImprovementPoints: number;
  /** 0..1 share of recurring incidents prevented. */
  recurrencePrevention: number;
  /** 0..1 durable-control / automation improvement. */
  durableControlImprovement: number;
}

/**
 * Edgefi Impact composite (SCORING_MODEL.md weights). Ticket closure alone earns
 * no credit — every input here reflects a verified outcome.
 */
export function computeImpact(inputs: ImpactInputs): ImpactBreakdown {
  const riskReduction = clamp01(inputs.verifiedRiskReduction) * 100;
  const healthImprovement = clamp01(inputs.healthImprovementPoints / 10) * 100;
  const coverageImprovement = clamp01(inputs.coverageImprovementPoints / 10) * 100;
  const recurrence = clamp01(inputs.recurrencePrevention) * 100;
  const durable = clamp01(inputs.durableControlImprovement) * 100;
  const total =
    0.35 * riskReduction +
    0.25 * healthImprovement +
    0.2 * coverageImprovement +
    0.1 * recurrence +
    0.1 * durable;
  return {
    verifiedRiskReduction: round1(riskReduction),
    healthImprovement: round1(healthImprovement),
    coverageImprovement: round1(coverageImprovement),
    recurrencePrevention: round1(recurrence),
    durableControlImprovement: round1(durable),
    total: round1(total),
  };
}

export function meanScore(scores: CustomerScores[], key: "health" | "coverage"): number {
  return mean(scores.map((s) => s[key]));
}
