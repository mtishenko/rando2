import type { MetricObservation } from "@/lib/types";
import type { Connector, ConnectorContext, SourceEvent } from "@/lib/connectors/types";
import { stableId } from "@/lib/util/rng";
import fixture from "@/lib/connectors/fixtures/msp360.backups.json";

/** MSP360 connector — backup capability. */
interface BackupSystem {
  id: string;
  name: string;
  protected: boolean;
  lastJobStatus: "success" | "failed";
  lastFailureHours: number;
}

export class MSP360Connector implements Connector {
  readonly source = "msp360";
  readonly capability = "backup" as const;

  async fetchRaw(): Promise<unknown> {
    return fixture;
  }

  toEvents(raw: unknown, ctx: ConnectorContext): SourceEvent[] {
    const systems = ((raw as { systems?: BackupSystem[] })?.systems ?? []) as BackupSystem[];
    const expected = (raw as { expectedSystems?: number })?.expectedSystems ?? systems.length;
    return systems.map<SourceEvent>((s) => ({
      event_id: stableId(`evt|${ctx.customerId}|${this.source}|${s.id}`),
      event_type: "backup.system.job",
      tenant_id: ctx.tenantId,
      customer_id: ctx.customerId,
      source: this.source,
      source_record_id: s.id,
      occurred_at: ctx.now,
      received_at: ctx.now,
      schema_version: "1.0",
      payload: { ...s, expectedSystems: expected },
      trace_id: ctx.traceId,
    }));
  }

  normalize(events: SourceEvent[], ctx: ConnectorContext): MetricObservation[] {
    const systems = events.map((e) => e.payload as unknown as BackupSystem);
    if (systems.length === 0) return [];
    const expected = (events[0].payload as { expectedSystems?: number }).expectedSystems ?? systems.length;

    const protectedSystems = systems.filter((s) => s.protected);
    const succeeded = protectedSystems.filter((s) => s.lastJobStatus === "success");
    const failed = protectedSystems.filter((s) => s.lastJobStatus === "failed");
    const worstFailureHours = Math.max(0, ...failed.map((s) => s.lastFailureHours));

    const common = {
      customerId: ctx.customerId,
      observedAt: ctx.now,
      ageHours: 0,
      source: "MSP360",
      sourceReliability: 0.96,
      evidenceQuality: 0.96,
    };
    const protCov = expected ? protectedSystems.length / expected : 1;
    const jobRate = protectedSystems.length ? succeeded.length / protectedSystems.length : 1;

    return [
      {
        ...common,
        metricId: "BACKUP-001",
        state: protCov >= 1 ? "PASS" : "PARTIAL",
        value: round3(protCov),
        populationExpected: expected,
        populationObserved: protectedSystems.length,
        evidenceNote: `${protectedSystems.length}/${expected} critical systems protected`,
      },
      {
        ...common,
        metricId: "BACKUP-002",
        state: jobRate >= 0.98 ? "PASS" : jobRate > 0 ? "PARTIAL" : "FAIL",
        value: round3(jobRate),
        populationExpected: protectedSystems.length,
        populationObserved: succeeded.length,
        evidenceNote: `${failed.length} of ${protectedSystems.length} backup jobs failing`,
      },
      {
        ...common,
        metricId: "BACKUP-003",
        state: worstFailureHours < 24 ? "PASS" : "FAIL",
        value: worstFailureHours < 24 ? 1 : 0,
        populationExpected: 0,
        populationObserved: 0,
        evidenceNote:
          worstFailureHours < 24
            ? "No backup failure older than 24h"
            : `Oldest backup failure is ${worstFailureHours}h old`,
      },
    ];
  }
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
