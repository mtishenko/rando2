import type {
  CollectionResult,
  Connector,
  ConnectorContext,
  ConnectorHealth,
} from "@/lib/connectors/types";

export const HEALTHY_INIT: ConnectorHealth = {
  state: "HEALTHY",
  lastSuccessAt: null,
  lastFailureAt: null,
  failureCount: 0,
  errorCode: null,
};

function classifyError(err: unknown): { state: ConnectorHealth["state"]; code: string } {
  const msg = String(err instanceof Error ? err.message : err).toLowerCase();
  if (msg.includes("auth") || msg.includes("401") || msg.includes("403")) {
    return { state: "AUTH_FAILED", code: "AUTH_FAILED" };
  }
  if (msg.includes("429") || msg.includes("rate")) {
    return { state: "RATE_LIMITED", code: "RATE_LIMITED" };
  }
  return { state: "OFFLINE", code: "COLLECTION_ERROR" };
}

export interface RunOptions {
  /** Override the connector's fetch (inject a recorded fixture for contract tests). */
  fetchRaw?: (ctx: ConnectorContext) => Promise<unknown>;
  /** Health from the previous run, so failure counts accumulate. */
  priorHealth?: ConnectorHealth;
}

/**
 * Run a connector end-to-end with the processing guarantees from ARCHITECTURE.md:
 * idempotent ingestion + deduplication (by source_record_id), source lineage,
 * health tracking, and a dead-letter path. Fetch failures degrade the integration
 * to a health state rather than throwing.
 */
export async function runCollection(
  connector: Connector,
  ctx: ConnectorContext,
  opts: RunOptions = {},
): Promise<CollectionResult> {
  const prior = opts.priorHealth ?? HEALTHY_INIT;
  const fetchRaw = opts.fetchRaw ?? connector.fetchRaw.bind(connector);

  let raw: unknown;
  try {
    raw = await fetchRaw(ctx);
  } catch (err) {
    const { state, code } = classifyError(err);
    return {
      events: [],
      observations: [],
      deadLettered: [],
      health: {
        state,
        lastSuccessAt: prior.lastSuccessAt,
        lastFailureAt: ctx.now,
        failureCount: prior.failureCount + 1,
        errorCode: code,
      },
    };
  }

  const rawEvents = connector.toEvents(raw, ctx);

  // Idempotent dedupe by source_record_id — replaying the same records is a no-op.
  const deadLettered: CollectionResult["deadLettered"] = [];
  const seen = new Set<string>();
  const events = [];
  for (const e of rawEvents) {
    if (!e.source_record_id) {
      deadLettered.push({ source_record_id: "", reason: "missing source_record_id" });
      continue;
    }
    if (seen.has(e.source_record_id)) continue;
    seen.add(e.source_record_id);
    events.push(e);
  }

  const observations = connector.normalize(events, ctx);

  return {
    events,
    observations,
    deadLettered,
    health: {
      state: "HEALTHY",
      lastSuccessAt: ctx.now,
      lastFailureAt: prior.lastFailureAt,
      failureCount: 0,
      errorCode: null,
    },
  };
}
