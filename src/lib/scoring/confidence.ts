import type { MetricDefinition, MetricObservation } from "@/lib/types";
import { clamp01 } from "@/lib/scoring/state";

/**
 * Evidence Confidence factors (SCORING_MODEL.md):
 *   Confidence = Freshness × Source Reliability × Population Completeness × Evidence Quality
 * Each factor ranges 0..1.
 */

/**
 * Freshness decays with age relative to the metric's freshness threshold.
 * Within threshold: 1.0 → 0.8 (mild decay). Beyond threshold: falls toward 0.
 * DATA_STALE / SOURCE_ERROR / EXPECTED_DATA_MISSING observations carry large
 * ages (or explicit low reliability) so this naturally sinks their confidence.
 */
export function freshnessFactor(def: MetricDefinition, obs: MetricObservation): number {
  const threshold = def.freshnessThresholdHours;
  if (threshold <= 0) return 1;
  const ratio = obs.ageHours / threshold;
  if (ratio <= 1) return clamp01(1 - 0.2 * ratio); // 1.0 .. 0.8
  return clamp01(0.8 - 0.6 * (ratio - 1)); // decays past threshold
}

export function populationCompleteness(def: MetricDefinition, obs: MetricObservation): number {
  if (!def.populationBased) return 1;
  if (obs.populationExpected <= 0) return 1;
  return clamp01(obs.populationObserved / obs.populationExpected);
}

/** Per-observation confidence (0..1). */
export function observationConfidence(
  def: MetricDefinition,
  obs: MetricObservation,
): number {
  const freshness = freshnessFactor(def, obs);
  const reliability = clamp01(obs.sourceReliability);
  const population = populationCompleteness(def, obs);
  const quality = clamp01(obs.evidenceQuality);
  return clamp01(freshness * reliability * population * quality);
}
