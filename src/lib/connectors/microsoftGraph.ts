import type { MetricObservation } from "@/lib/types";
import type { Connector, ConnectorContext, SourceEvent } from "@/lib/connectors/types";
import { stableId } from "@/lib/util/rng";
import fixture from "@/lib/connectors/fixtures/graph.identity.json";

/** Microsoft Graph / Entra ID connector — identity_security capability. */
interface GraphUser {
  id: string;
  upn: string;
  isPrivileged: boolean;
  mfaRegistered: boolean;
}

export class MicrosoftGraphConnector implements Connector {
  readonly source = "microsoft_graph";
  readonly capability = "identity_security" as const;

  async fetchRaw(): Promise<unknown> {
    return fixture;
  }

  toEvents(raw: unknown, ctx: ConnectorContext): SourceEvent[] {
    const users = ((raw as { users?: GraphUser[] })?.users ?? []) as GraphUser[];
    const events = users.map<SourceEvent>((u) => ({
      event_id: stableId(`evt|${ctx.customerId}|${this.source}|${u.id}`),
      event_type: "identity.user.state",
      tenant_id: ctx.tenantId,
      customer_id: ctx.customerId,
      source: this.source,
      source_record_id: u.id,
      occurred_at: ctx.now,
      received_at: ctx.now,
      schema_version: "1.0",
      payload: { ...u },
      trace_id: ctx.traceId,
    }));
    events.push({
      event_id: stableId(`evt|${ctx.customerId}|${this.source}|tenant`),
      event_type: "identity.tenant.policy",
      tenant_id: ctx.tenantId,
      customer_id: ctx.customerId,
      source: this.source,
      source_record_id: "tenant-policy",
      occurred_at: ctx.now,
      received_at: ctx.now,
      schema_version: "1.0",
      payload: { legacyAuthBlocked: (raw as { legacyAuthBlocked?: boolean })?.legacyAuthBlocked ?? false },
      trace_id: ctx.traceId,
    });
    return events;
  }

  normalize(events: SourceEvent[], ctx: ConnectorContext): MetricObservation[] {
    const users = events
      .filter((e) => e.event_type === "identity.user.state")
      .map((e) => e.payload as unknown as GraphUser);
    const policy = events.find((e) => e.event_type === "identity.tenant.policy");
    if (users.length === 0) return [];

    const privileged = users.filter((u) => u.isPrivileged);
    const privMfa = privileged.filter((u) => u.mfaRegistered);
    const allMfa = users.filter((u) => u.mfaRegistered);
    const legacyBlocked = Boolean((policy?.payload as { legacyAuthBlocked?: boolean })?.legacyAuthBlocked);

    const common = {
      customerId: ctx.customerId,
      observedAt: ctx.now,
      ageHours: 0,
      source: "Microsoft Graph / Entra ID",
      sourceReliability: 0.98,
      evidenceQuality: 0.98,
    };
    const privCov = privileged.length ? privMfa.length / privileged.length : 1;
    const userCov = users.length ? allMfa.length / users.length : 1;

    return [
      {
        ...common,
        metricId: "IDENTITY-001",
        state: privCov >= 0.98 ? "PASS" : privCov > 0 ? "PARTIAL" : "FAIL",
        value: round3(privCov),
        populationExpected: privileged.length,
        populationObserved: privMfa.length,
        evidenceNote: `${privMfa.length}/${privileged.length} privileged accounts have MFA`,
      },
      {
        ...common,
        metricId: "IDENTITY-002",
        state: userCov >= 0.98 ? "PASS" : "PARTIAL",
        value: round3(userCov),
        populationExpected: users.length,
        populationObserved: allMfa.length,
        evidenceNote: `${allMfa.length}/${users.length} users have MFA`,
      },
      {
        ...common,
        metricId: "IDENTITY-003",
        state: legacyBlocked ? "PASS" : "FAIL",
        value: legacyBlocked ? 1 : 0,
        populationExpected: 0,
        populationObserved: 0,
        evidenceNote: legacyBlocked ? "Legacy authentication is blocked" : "Legacy authentication is NOT blocked",
      },
    ];
  }
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
