import { describe, it, expect } from "vitest";
import { CONNECTORS, connectorBySource, connectorsForCapability } from "@/lib/connectors/registry";
import { runCollection } from "@/lib/connectors/base";
import type { ConnectorContext } from "@/lib/connectors/types";
import { METRICS_BY_ID } from "@/lib/metrics/catalog";
import { computeCoverage } from "@/lib/scoring/customer";
import { REFERENCE_NOW } from "@/lib/data/generate";

const ctx: ConnectorContext = {
  tenantId: "t1",
  customerId: "c1",
  now: REFERENCE_NOW,
  traceId: "trace",
};

describe("Connector registry", () => {
  it("resolves connectors by source and capability", () => {
    expect(connectorBySource("crowdstrike")?.capability).toBe("edr");
    expect(connectorsForCapability("identity_security").map((c) => c.source)).toContain(
      "microsoft_graph",
    );
    expect(CONNECTORS.length).toBeGreaterThanOrEqual(4);
  });

  it("every connector emits well-formed events and metric-catalog observations", async () => {
    for (const connector of CONNECTORS) {
      const result = await runCollection(connector, ctx);
      expect(result.events.length).toBeGreaterThan(0);
      expect(result.observations.length).toBeGreaterThan(0);
      for (const e of result.events) {
        expect(e.source).toBe(connector.source);
        expect(e.tenant_id).toBe(ctx.tenantId);
        expect(e.source_record_id).toBeTruthy();
      }
      // Every normalized observation references a real, matching-capability metric.
      for (const o of result.observations) {
        const def = METRICS_BY_ID[o.metricId];
        expect(def, `unknown metric ${o.metricId}`).toBeTruthy();
        expect(def.capability).toBe(connector.capability);
      }
      // Observations carry usable evidence, so coverage over them is complete.
      expect(computeCoverage(result.observations)).toBe(100);
    }
  });

  it("Microsoft Graph flags a privileged MFA gap and blocked legacy auth", async () => {
    const c = connectorBySource("microsoft_graph")!;
    const { observations } = await runCollection(c, ctx);
    const byId = Object.fromEntries(observations.map((o) => [o.metricId, o]));
    expect(byId["IDENTITY-001"].state).toBe("PARTIAL"); // 2/3 privileged have MFA
    expect(byId["IDENTITY-003"].state).toBe("PASS"); // legacy auth blocked
  });

  it("MSP360 flags failing backup jobs", async () => {
    const c = connectorBySource("msp360")!;
    const { observations } = await runCollection(c, ctx);
    const byId = Object.fromEntries(observations.map((o) => [o.metricId, o]));
    expect(byId["BACKUP-002"].state).toBe("PARTIAL"); // 2 of 9 failing
    expect(byId["BACKUP-003"].state).toBe("FAIL"); // a failure older than 24h
  });

  it("CrowdStrike flags a degraded sensor", async () => {
    const c = connectorBySource("crowdstrike")!;
    const { observations } = await runCollection(c, ctx);
    const byId = Object.fromEntries(observations.map((o) => [o.metricId, o]));
    expect(byId["EDR-002"].state).toBe("PARTIAL"); // one unhealthy sensor
    expect(byId["EDR-004"].state).toBe("PASS"); // no open critical detections
  });
});
