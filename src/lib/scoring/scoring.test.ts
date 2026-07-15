import { describe, it, expect } from "vitest";
import type { MetricObservation, MetricState } from "@/lib/types";
import { computeHealth, computeCoverage, computeConfidence } from "@/lib/scoring/customer";
import { getMetric } from "@/lib/metrics/catalog";

function obs(metricId: string, state: MetricState, overrides: Partial<MetricObservation> = {}): MetricObservation {
  const def = getMetric(metricId);
  return {
    customerId: "c1",
    metricId,
    state,
    value: state === "PASS" ? 1 : state === "FAIL" ? 0 : 0.5,
    observedAt: "2026-07-14T14:00:00.000Z",
    ageHours: 1,
    source: def.source,
    populationExpected: def.populationBased ? 100 : 0,
    populationObserved: def.populationBased ? (state === "PASS" ? 100 : 50) : 0,
    sourceReliability: 0.98,
    evidenceQuality: 0.98,
    evidenceNote: "",
    ...overrides,
  };
}

describe("Customer Health", () => {
  it("is a weighted mean of scorable metrics only", () => {
    // Two PASS + one FAIL of equal weight (all Critical -> weight 10).
    const observations = [
      obs("EDR-004", "PASS"),
      obs("IDENTITY-005", "PASS"),
      obs("BACKUP-002", "FAIL"),
    ];
    // (1*10 + 1*10 + 0*10) / 30 = 0.6667 -> 66.7
    expect(computeHealth(observations)).toBeCloseTo(66.7, 1);
  });

  it("gives identical output for identical input (determinism)", () => {
    const a = [obs("EDR-004", "PASS"), obs("BACKUP-002", "FAIL")];
    const b = [obs("EDR-004", "PASS"), obs("BACKUP-002", "FAIL")];
    expect(computeHealth(a)).toBe(computeHealth(b));
  });

  it("excludes missing/stale/error data from health (no false lowering)", () => {
    const healthy = [obs("EDR-004", "PASS")];
    const withMissing = [obs("EDR-004", "PASS"), obs("EDR-001", "EXPECTED_DATA_MISSING")];
    // Missing data must NOT drag health down.
    expect(computeHealth(withMissing)).toBe(computeHealth(healthy));
  });

  it("counts an active exception as a pass for health", () => {
    const observations = [obs("M365-002", "EXCEPTION_ACTIVE"), obs("BACKUP-002", "FAIL")];
    // weights: M365-002 High=6, BACKUP-002 Critical=10 -> (6 + 0)/16 = 37.5
    expect(computeHealth(observations)).toBeCloseTo(37.5, 1);
  });
});

describe("Measurement Coverage", () => {
  it("drops when applicable evidence is missing", () => {
    const full = [obs("EDR-001", "PASS"), obs("EDR-004", "PASS")];
    const partial = [obs("EDR-001", "EXPECTED_DATA_MISSING"), obs("EDR-004", "PASS")];
    expect(computeCoverage(full)).toBe(100);
    expect(computeCoverage(partial)).toBeLessThan(100);
  });

  it("ignores not-purchased capabilities entirely", () => {
    const observations = [obs("EDR-004", "PASS"), obs("GRC-001", "NOT_PURCHASED")];
    // NOT_PURCHASED is not applicable -> coverage stays 100.
    expect(computeCoverage(observations)).toBe(100);
  });
});

describe("Evidence Confidence", () => {
  it("falls when data is stale", () => {
    const fresh = [obs("IDENTITY-001", "PASS", { ageHours: 1 })];
    const stale = [obs("IDENTITY-001", "DATA_STALE", { ageHours: 240, sourceReliability: 0.6 })];
    expect(computeConfidence(stale)).toBeLessThan(computeConfidence(fresh));
  });
});
