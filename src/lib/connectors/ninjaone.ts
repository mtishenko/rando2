import type { MetricObservation } from "@/lib/types";
import type { Connector, ConnectorContext, SourceEvent } from "@/lib/connectors/types";
import { stableId } from "@/lib/util/rng";
import fixture from "@/lib/connectors/fixtures/ninjaone.devices.json";

/**
 * NinjaOne (RMM) connector — endpoint_management capability. Maps raw device
 * records into canonical events, then normalizes them into DEVICE-001 (RMM agent
 * coverage), PATCH-001 (critical patch compliance), DEVICE-002 (devices offline),
 * and PATCH-002 (unsupported OS) observations.
 *
 * `fetchRaw` here returns a recorded fixture so the connector runs in the demo. A
 * production deployment replaces it with an authenticated NinjaOne API call using
 * the integration's stored credentials — nothing else changes.
 */

interface NinjaDevice {
  id: string;
  hostname: string;
  agentInstalled: boolean;
  lastSeenMinutes: number;
  patchStatus: string;
  osSupported: boolean;
}

const OFFLINE_THRESHOLD_MINUTES = 24 * 60; // 24h

export class NinjaOneConnector implements Connector {
  readonly source = "ninjaone";
  readonly capability = "endpoint_management" as const;

  async fetchRaw(): Promise<unknown> {
    // Demo: recorded response. Production: authenticated NinjaOne API call.
    return fixture;
  }

  toEvents(raw: unknown, ctx: ConnectorContext): SourceEvent[] {
    const devices = ((raw as { devices?: NinjaDevice[] })?.devices ?? []) as NinjaDevice[];
    return devices.map((d) => ({
      event_id: stableId(`evt|${ctx.customerId}|${this.source}|${d.id}`),
      event_type: "asset.endpoint.inventory",
      tenant_id: ctx.tenantId,
      customer_id: ctx.customerId,
      source: this.source,
      source_record_id: d.id,
      occurred_at: ctx.now,
      received_at: ctx.now,
      schema_version: "1.0",
      payload: { ...d },
      trace_id: ctx.traceId,
    }));
  }

  normalize(events: SourceEvent[], ctx: ConnectorContext): MetricObservation[] {
    const devices = events.map((e) => e.payload as unknown as NinjaDevice);
    const total = devices.length;
    if (total === 0) return [];

    const managed = devices.filter((d) => d.agentInstalled);
    const offline = managed.filter((d) => d.lastSeenMinutes > OFFLINE_THRESHOLD_MINUTES);
    const patchable = managed.filter((d) => d.patchStatus !== "unknown");
    const compliant = patchable.filter((d) => d.patchStatus === "compliant");
    const unsupported = devices.filter((d) => !d.osSupported);

    const base = (metricId: string): Omit<MetricObservation, "state" | "value" | "evidenceNote"> => ({
      customerId: ctx.customerId,
      metricId,
      observedAt: ctx.now,
      ageHours: 0,
      source: "NinjaOne",
      populationExpected: total,
      populationObserved: managed.length,
      sourceReliability: 0.97,
      evidenceQuality: 0.97,
    });

    const coverage = managed.length / total;
    const patchRate = patchable.length ? compliant.length / patchable.length : 1;
    const offlineRate = managed.length ? offline.length / managed.length : 0;

    return [
      {
        ...base("DEVICE-001"),
        state: coverage >= 0.99 ? "PASS" : "PARTIAL",
        value: round3(coverage),
        populationObserved: managed.length,
        evidenceNote: `${managed.length}/${total} devices reporting an RMM agent`,
      },
      {
        ...base("PATCH-001"),
        state: patchRate >= 0.98 ? "PASS" : "PARTIAL",
        value: round3(patchRate),
        populationExpected: patchable.length,
        populationObserved: compliant.length,
        evidenceNote: `${compliant.length}/${patchable.length} managed devices patch-compliant`,
      },
      {
        ...base("DEVICE-002"),
        state: offlineRate < 0.02 ? "PASS" : "PARTIAL",
        value: round3(1 - offlineRate),
        populationExpected: managed.length,
        populationObserved: managed.length - offline.length,
        evidenceNote: `${offline.length} device(s) offline beyond ${OFFLINE_THRESHOLD_MINUTES / 60}h`,
      },
      {
        ...base("PATCH-002"),
        state: unsupported.length === 0 ? "PASS" : "FAIL",
        value: unsupported.length === 0 ? 1 : 0,
        populationExpected: total,
        populationObserved: total - unsupported.length,
        evidenceNote: `${unsupported.length} device(s) running an unsupported operating system`,
      },
    ];
  }
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
