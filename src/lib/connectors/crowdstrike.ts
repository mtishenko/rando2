import type { MetricObservation } from "@/lib/types";
import type { Connector, ConnectorContext, SourceEvent } from "@/lib/connectors/types";
import { stableId } from "@/lib/util/rng";
import fixture from "@/lib/connectors/fixtures/crowdstrike.sensors.json";

/** CrowdStrike connector — edr capability. */
interface CsHost {
  id: string;
  hostname: string;
  sensorInstalled: boolean;
  sensorHealthy: boolean;
}

export class CrowdStrikeConnector implements Connector {
  readonly source = "crowdstrike";
  readonly capability = "edr" as const;

  async fetchRaw(): Promise<unknown> {
    return fixture;
  }

  toEvents(raw: unknown, ctx: ConnectorContext): SourceEvent[] {
    const hosts = ((raw as { hosts?: CsHost[] })?.hosts ?? []) as CsHost[];
    const expected = (raw as { expectedHosts?: number })?.expectedHosts ?? hosts.length;
    const openCritical = (raw as { openCriticalDetections?: number })?.openCriticalDetections ?? 0;
    return hosts.map<SourceEvent>((h) => ({
      event_id: stableId(`evt|${ctx.customerId}|${this.source}|${h.id}`),
      event_type: "asset.security_sensor.state",
      tenant_id: ctx.tenantId,
      customer_id: ctx.customerId,
      source: this.source,
      source_record_id: h.id,
      occurred_at: ctx.now,
      received_at: ctx.now,
      schema_version: "1.0",
      payload: { ...h, expectedHosts: expected, openCriticalDetections: openCritical },
      trace_id: ctx.traceId,
    }));
  }

  normalize(events: SourceEvent[], ctx: ConnectorContext): MetricObservation[] {
    const hosts = events.map((e) => e.payload as unknown as CsHost);
    if (hosts.length === 0) return [];
    const meta = events[0].payload as { expectedHosts?: number; openCriticalDetections?: number };
    const expected = meta.expectedHosts ?? hosts.length;
    const openCritical = meta.openCriticalDetections ?? 0;

    const installed = hosts.filter((h) => h.sensorInstalled);
    const healthy = installed.filter((h) => h.sensorHealthy);

    const common = {
      customerId: ctx.customerId,
      observedAt: ctx.now,
      ageHours: 0,
      source: "CrowdStrike",
      sourceReliability: 0.98,
      evidenceQuality: 0.98,
    };
    const cov = expected ? installed.length / expected : 1;
    const healthRate = installed.length ? healthy.length / installed.length : 1;

    return [
      {
        ...common,
        metricId: "EDR-001",
        state: cov >= 0.99 ? "PASS" : "PARTIAL",
        value: round3(cov),
        populationExpected: expected,
        populationObserved: installed.length,
        evidenceNote: `${installed.length}/${expected} endpoints have a CrowdStrike sensor`,
      },
      {
        ...common,
        metricId: "EDR-002",
        state: healthRate >= 0.99 ? "PASS" : "PARTIAL",
        value: round3(healthRate),
        populationExpected: installed.length,
        populationObserved: healthy.length,
        evidenceNote: `${healthy.length}/${installed.length} sensors reporting healthy`,
      },
      {
        ...common,
        metricId: "EDR-004",
        state: openCritical === 0 ? "PASS" : "FAIL",
        value: openCritical === 0 ? 1 : 0,
        populationExpected: 0,
        populationObserved: 0,
        evidenceNote:
          openCritical === 0 ? "No open critical detections" : `${openCritical} open critical detection(s)`,
      },
    ];
  }
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
