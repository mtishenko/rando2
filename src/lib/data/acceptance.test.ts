import { describe, it, expect } from "vitest";
import { getPortfolioModel, getCustomerModel } from "@/lib/data/compute";
import { stableId } from "@/lib/util/rng";
import { resolvedState } from "@/lib/risk/events";

const idFor = (key: string) => stableId(`customer|${key}`);

/**
 * The five required acceptance scenarios from TESTING_STRATEGY.md, exercised
 * end-to-end against the seeded portfolio model.
 */
describe("Required acceptance scenarios", () => {
  it("1. Failed production backups move a customer into the top ten", () => {
    const { commandCenter } = getPortfolioModel();
    const ranks = commandCenter.topAttention.map((r) => r.customer.id);
    expect(ranks).toContain(idFor("harborview"));

    const row = commandCenter.topAttention.find((r) => r.customer.id === idFor("harborview"))!;
    expect(row.topEvent.capability).toBe("backup");
    expect(row.inclusionReasons).toContain("Failed production backup");
  });

  it("2. Missing CrowdStrike data lowers coverage and creates an unverified-control event, not a false health drop", () => {
    const cascade = getCustomerModel(idFor("cascade"))!;
    // Coverage is reduced by the missing EDR evidence.
    expect(cascade.scores.coverage).toBeLessThan(100);
    // At least one Critical unverified control is recorded.
    expect(cascade.scores.unverifiedCriticalControls).toBeGreaterThanOrEqual(1);
    // A risk event exists for the EDR capability referencing the missing metric.
    const edrEvent = cascade.events.find((e) => e.capability === "edr");
    expect(edrEvent).toBeDefined();
    expect(edrEvent!.metricIds).toContain("EDR-001");
    // Health is NOT dragged down by the missing data (EDR-001 excluded from health).
    // Sanity: health stays healthy despite the missing sensor inventory.
    expect(cascade.scores.health).toBeGreaterThan(85);
  });

  it("3. A closed Halo ticket does not resolve the event until backup success is observed", () => {
    const summit = getCustomerModel(idFor("summit"))!;
    const backupEvent = summit.events.find((e) => e.capability === "backup")!;
    expect(backupEvent).toBeDefined();
    // Ticket closed => event is MITIGATED, but backup still failing.
    expect(backupEvent.state).toBe("MITIGATED");
    expect(backupEvent.verificationSatisfied).toBe(false);
    // Therefore it must NOT be VERIFIED_RESOLVED.
    expect(resolvedState(backupEvent)).not.toBe("VERIFIED_RESOLVED");
    expect(resolvedState(backupEvent)).toBe("MITIGATED");
  });

  it("4. A customer without contracted ControlMap is not penalized", () => {
    const cedar = getCustomerModel(idFor("cedar"))!;
    const grcObs = cedar.observations.filter((o) => o.metricId.startsWith("GRC-"));
    expect(grcObs.length).toBeGreaterThan(0);
    // All GRC metrics are NOT_PURCHASED for Cedar.
    expect(grcObs.every((o) => o.state === "NOT_PURCHASED")).toBe(true);
    // No GRC risk event is created.
    expect(cedar.events.some((e) => e.capability === "grc")).toBe(false);
    // Compare with Lumen (contracted GRC, failing) which IS penalized with an event.
    const lumen = getCustomerModel(idFor("lumen"))!;
    expect(lumen.events.some((e) => e.capability === "grc")).toBe(true);
  });

  it("5. A stale Microsoft Graph connector lowers confidence and creates an integration issue", () => {
    const meridian = getCustomerModel(idFor("meridian"))!;
    const vantage = getCustomerModel(idFor("vantage"))!; // healthy comparison
    // Stale identity evidence lowers confidence relative to a healthy peer.
    expect(meridian.scores.confidence).toBeLessThan(vantage.scores.confidence);
    // The identity integration is not healthy.
    const identityIntegration = meridian.integrations.find(
      (i) => i.capability === "identity_security",
    )!;
    expect(identityIntegration.state).not.toBe("HEALTHY");
    // An identity risk event references a stale metric.
    const idEvent = meridian.events.find((e) => e.capability === "identity_security");
    expect(idEvent).toBeDefined();
  });
});

describe("Portfolio integrity", () => {
  it("produces well-formed portfolio scores in range", () => {
    const { portfolio } = getPortfolioModel();
    expect(portfolio.health).toBeGreaterThanOrEqual(0);
    expect(portfolio.health).toBeLessThanOrEqual(100);
    expect(portfolio.coverage).toBeLessThanOrEqual(100);
    expect(portfolio.confidence).toBeLessThanOrEqual(1);
    expect(portfolio.impact.total).toBeGreaterThanOrEqual(0);
    expect(portfolio.impact.total).toBeLessThanOrEqual(100);
  });

  it("ranks attention by priority score descending", () => {
    const { commandCenter } = getPortfolioModel();
    const scores = commandCenter.topAttention.map((r) => r.priorityScore);
    const sorted = [...scores].sort((a, b) => b - a);
    expect(scores).toEqual(sorted);
  });

  it("keeps every priority score within 0..1000", () => {
    const { allEvents } = getPortfolioModel();
    for (const e of allEvents) {
      expect(e.priorityScore).toBeGreaterThanOrEqual(0);
      expect(e.priorityScore).toBeLessThanOrEqual(1000);
    }
  });
});
