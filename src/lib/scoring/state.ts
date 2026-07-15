import type { MetricObservation, MetricState } from "@/lib/types";

/**
 * State semantics (SCORING_MODEL.md + DATA_MODEL.md).
 *
 * The key rule from the PRD: missing/stale/error/unknown data does NOT silently
 * disappear and does NOT falsely lower health. Instead it is excluded from the
 * health calculation (not "scorable") while reducing coverage and confidence and
 * creating work.
 */

/** Metric applies to this customer (they are contracted + it is relevant). */
export function isApplicable(state: MetricState): boolean {
  return state !== "NOT_APPLICABLE" && state !== "NOT_PURCHASED";
}

/**
 * Metric contributes a numeric score to Customer Health. Only states where we
 * have a real, trustworthy pass/partial/fail evaluation count. An active
 * exception counts as a pass (the risk is formally accepted).
 */
export function isScorable(state: MetricState): boolean {
  return (
    state === "PASS" ||
    state === "PARTIAL" ||
    state === "FAIL" ||
    state === "EXCEPTION_ACTIVE"
  );
}

/**
 * We have usable evidence for this metric (drives Coverage). Same set as
 * scorable — everything else means we cannot see or trust the control.
 */
export function hasUsableEvidence(state: MetricState): boolean {
  return isScorable(state);
}

/** Applicable but with no usable evidence — an unverified control. */
export function isUnverified(state: MetricState): boolean {
  return isApplicable(state) && !hasUsableEvidence(state);
}

/** 0..1 health contribution for a scorable observation. */
export function metricScore(obs: MetricObservation): number {
  switch (obs.state) {
    case "PASS":
    case "EXCEPTION_ACTIVE":
      return 1;
    case "FAIL":
      return 0;
    case "PARTIAL":
      return clamp01(obs.value);
    default:
      return 0; // not scorable — callers must gate on isScorable first
  }
}

export function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

export function clamp(n: number, lo: number, hi: number): number {
  if (Number.isNaN(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}
