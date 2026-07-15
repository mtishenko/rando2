import { describe, it, expect } from "vitest";
import { NinjaOneConnector } from "@/lib/connectors/ninjaone";
import { runCollection, HEALTHY_INIT } from "@/lib/connectors/base";
import type { ConnectorContext } from "@/lib/connectors/types";
import { computeHealth, computeCoverage } from "@/lib/scoring/customer";
import { REFERENCE_NOW } from "@/lib/data/generate";

const ctx: ConnectorContext = {
  tenantId: "tenant-1",
  customerId: "customer-1",
  now: REFERENCE_NOW,
  traceId: "trace-1",
};

describe("NinjaOne connector contract", () => {
  it("emits canonical events with a complete envelope", async () => {
    const c = new NinjaOneConnector();
    const result = await runCollection(c, ctx);
    expect(result.events.length).toBe(12);
    for (const e of result.events) {
      expect(e.tenant_id).toBe(ctx.tenantId);
      expect(e.customer_id).toBe(ctx.customerId);
      expect(e.source).toBe("ninjaone");
      expect(e.source_record_id).toBeTruthy();
      expect(e.trace_id).toBe(ctx.traceId);
      expect(e.schema_version).toBe("1.0");
    }
  });

  it("normalizes to the expected metric states", async () => {
    const c = new NinjaOneConnector();
    const { observations } = await runCollection(c, ctx);
    const byId = Object.fromEntries(observations.map((o) => [o.metricId, o]));

    expect(byId["DEVICE-001"].state).toBe("PARTIAL"); // 11/12 have agents
    expect(byId["PATCH-001"].state).toBe("PARTIAL"); // 9/11 compliant
    expect(byId["PATCH-002"].state).toBe("FAIL"); // one unsupported OS
    expect(byId["DEVICE-002"].state).toBe("PARTIAL"); // one long-offline device
  });

  it("feeds straight into the scoring engine", async () => {
    const c = new NinjaOneConnector();
    const { observations } = await runCollection(c, ctx);
    const health = computeHealth(observations);
    const coverage = computeCoverage(observations);
    expect(health).toBeGreaterThan(0);
    expect(health).toBeLessThan(100);
    expect(coverage).toBe(100); // all four controls have usable evidence
  });

  it("is idempotent — duplicate source records are deduplicated", async () => {
    const c = new NinjaOneConnector();
    const dupFetch = async () => ({
      devices: [
        { id: "dev-1", hostname: "a", agentInstalled: true, lastSeenMinutes: 1, patchStatus: "compliant", osSupported: true },
        { id: "dev-1", hostname: "a", agentInstalled: true, lastSeenMinutes: 1, patchStatus: "compliant", osSupported: true },
        { id: "dev-2", hostname: "b", agentInstalled: true, lastSeenMinutes: 1, patchStatus: "compliant", osSupported: true },
      ],
    });
    const result = await runCollection(c, ctx, { fetchRaw: dupFetch });
    expect(result.events.length).toBe(2); // dev-1 collapsed
  });

  it("degrades to a health state on an auth failure rather than throwing", async () => {
    const c = new NinjaOneConnector();
    const failing = async () => {
      throw new Error("401 auth token rejected");
    };
    const result = await runCollection(c, ctx, { fetchRaw: failing, priorHealth: HEALTHY_INIT });
    expect(result.health.state).toBe("AUTH_FAILED");
    expect(result.health.failureCount).toBe(1);
    expect(result.observations).toEqual([]);
    expect(result.events).toEqual([]);
  });
});
