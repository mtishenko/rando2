import type { Capability, IntegrationState, MetricObservation } from "@/lib/types";

/**
 * Canonical event envelope (ARCHITECTURE.md "Canonical Event Envelope"). Every
 * connector emits raw vendor records as these, giving the platform idempotent
 * ingestion, deduplication, source lineage, and replay.
 */
export interface SourceEvent {
  event_id: string;
  event_type: string;
  tenant_id: string;
  customer_id: string;
  source: string;
  source_record_id: string;
  occurred_at: string; // ISO-8601
  received_at: string; // ISO-8601
  schema_version: string;
  payload: Record<string, unknown>;
  trace_id: string;
}

/** Context passed to a collection run. */
export interface ConnectorContext {
  tenantId: string;
  customerId: string;
  /** Deterministic "now" for reproducibility. */
  now: string;
  traceId: string;
}

/** Integration health after a collection run (DATA_MODEL Integration states). */
export interface ConnectorHealth {
  state: IntegrationState;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  failureCount: number;
  errorCode: string | null;
}

export interface CollectionResult {
  events: SourceEvent[];
  observations: MetricObservation[];
  health: ConnectorHealth;
  /** Events that could not be processed (dead-letter queue, ARCHITECTURE.md). */
  deadLettered: { source_record_id: string; reason: string }[];
}

/**
 * A capability connector. Vendor-specific logic lives here; the rest of the
 * platform is capability-based (product principle: "capability-based architecture
 * rather than vendor-specific logic"). `fetchRaw` is the only I/O — inject a
 * fixture-backed implementation to contract-test without hitting the vendor.
 */
export interface Connector {
  /** Vendor/source name (e.g. "ninjaone"). */
  readonly source: string;
  readonly capability: Capability;
  /** Fetch raw records from the vendor API. Throws on auth/network failure. */
  fetchRaw(ctx: ConnectorContext): Promise<unknown>;
  /** Convert a raw vendor response into canonical source events. */
  toEvents(raw: unknown, ctx: ConnectorContext): SourceEvent[];
  /** Normalize canonical events into metric observations the scoring engine consumes. */
  normalize(events: SourceEvent[], ctx: ConnectorContext): MetricObservation[];
}
