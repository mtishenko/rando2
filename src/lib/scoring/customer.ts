import type {
  CategoryScore,
  Customer,
  CustomerScores,
  MetricCategory,
  MetricDefinition,
  MetricObservation,
} from "@/lib/types";
import { METRICS_BY_ID } from "@/lib/metrics/catalog";
import { observationConfidence } from "@/lib/scoring/confidence";
import {
  hasUsableEvidence,
  isApplicable,
  isScorable,
  isUnverified,
  metricScore,
} from "@/lib/scoring/state";

/**
 * Effective weight for a metric/observation. MVP uses the catalog base weight;
 * CustomerMetricConfiguration overrides would be applied here.
 */
export function effectiveWeight(def: MetricDefinition): number {
  return def.weight;
}

const CATEGORIES: MetricCategory[] = [
  "Security",
  "Reliability",
  "Experience",
  "Coverage",
  "Compliance",
];

/**
 * Customer Health = Σ(metric_score × effective_weight) / Σ(effective_weight for scorable metrics)
 * Only scorable metrics (PASS/PARTIAL/FAIL/EXCEPTION_ACTIVE) participate.
 */
export function computeHealth(observations: MetricObservation[]): number {
  let num = 0;
  let den = 0;
  for (const obs of observations) {
    const def = METRICS_BY_ID[obs.metricId];
    if (!def || !isScorable(obs.state)) continue;
    const w = effectiveWeight(def);
    num += metricScore(obs) * w;
    den += w;
  }
  return den === 0 ? 0 : round1((num / den) * 100);
}

/**
 * Measurement Coverage = Σ(weight of applicable metrics with usable evidence)
 *                        / Σ(weight of all applicable metrics)
 */
export function computeCoverage(observations: MetricObservation[]): number {
  let num = 0;
  let den = 0;
  for (const obs of observations) {
    const def = METRICS_BY_ID[obs.metricId];
    if (!def || !isApplicable(obs.state)) continue;
    const w = effectiveWeight(def);
    den += w;
    if (hasUsableEvidence(obs.state)) num += w;
  }
  return den === 0 ? 100 : round1((num / den) * 100);
}

/**
 * Aggregate Evidence Confidence — weighted mean of per-observation confidence
 * over all applicable metrics. Missing/error observations carry near-zero
 * evidence quality and stale observations carry low freshness, so both pull
 * confidence down without touching health.
 */
export function computeConfidence(observations: MetricObservation[]): number {
  let num = 0;
  let den = 0;
  for (const obs of observations) {
    const def = METRICS_BY_ID[obs.metricId];
    if (!def || !isApplicable(obs.state)) continue;
    const w = effectiveWeight(def);
    den += w;
    num += observationConfidence(def, obs) * w;
  }
  return den === 0 ? 0 : round3(num / den);
}

export function computeCategoryScores(observations: MetricObservation[]): CategoryScore[] {
  return CATEGORIES.map((category) => {
    let num = 0;
    let den = 0;
    let count = 0;
    for (const obs of observations) {
      const def = METRICS_BY_ID[obs.metricId];
      if (!def || def.category !== category || !isScorable(obs.state)) continue;
      const w = effectiveWeight(def);
      num += metricScore(obs) * w;
      den += w;
      count += 1;
    }
    return {
      category,
      score: den === 0 ? 0 : round1((num / den) * 100),
      weight: den,
      scorableMetricCount: count,
    };
  }).filter((c) => c.scorableMetricCount > 0);
}

export function countUnverifiedCriticalControls(observations: MetricObservation[]): number {
  let n = 0;
  for (const obs of observations) {
    const def = METRICS_BY_ID[obs.metricId];
    if (!def) continue;
    if (def.criticality === "Critical" && isUnverified(obs.state)) n += 1;
  }
  return n;
}

export interface TrendInputs {
  healthDelta30d: number;
  coverageDelta30d: number;
  health7dChange: number;
}

export function computeCustomerScores(
  customer: Customer,
  observations: MetricObservation[],
  trend: TrendInputs,
): CustomerScores {
  const applicable = observations.filter((o) => isApplicable(o.state));
  const scorable = observations.filter((o) => isScorable(o.state));
  return {
    customerId: customer.id,
    health: computeHealth(observations),
    coverage: computeCoverage(observations),
    confidence: computeConfidence(observations),
    categoryScores: computeCategoryScores(observations),
    unverifiedCriticalControls: countUnverifiedCriticalControls(observations),
    scorableMetricCount: scorable.length,
    applicableMetricCount: applicable.length,
    healthDelta30d: trend.healthDelta30d,
    coverageDelta30d: trend.coverageDelta30d,
    health7dChange: trend.health7dChange,
  };
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
export function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
