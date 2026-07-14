import type { RiskEvent, RiskEventState } from "@/lib/types";
import type { HaloClient } from "@/lib/workflow/halo";
import type {
  HaloPriority,
  HaloStatus,
  QueuedUpdate,
  TicketDraft,
  WorkItem,
} from "@/lib/workflow/types";
import { capabilityLabel } from "@/lib/risk/events";
import { redactText } from "@/lib/ai/redaction";
import { stableId } from "@/lib/util/rng";

function mapPriority(band: RiskEvent["priorityBand"]): HaloPriority {
  return band.toLowerCase() as HaloPriority;
}

/**
 * Draft a HaloPSA ticket for a risk event. The body carries impact, remediation,
 * verification criteria, and projected improvement (PRD-008). Host/IP/CVE details
 * are redacted; the capability label — not the vendor-specific metric title — is
 * used in the subject.
 */
export function draftTicket(event: RiskEvent, customerName: string): TicketDraft {
  const details = redactText(
    [
      `Customer: ${customerName}`,
      `Impact: ${event.businessImpact}`,
      `Primary reason: ${event.primaryReason}`,
      `Remediation: ${event.recommendation.action}`,
      `Projected improvement: +${event.recommendation.expectedHealthImprovement} health points`,
      `Verification: risk is resolved only when ${event.verificationMetricId ?? "the driving control"} passes.`,
    ].join("\n"),
  );
  return {
    riskEventId: event.id,
    customerId: event.customerId,
    subject: `[${event.priorityBand}] ${capabilityLabel(event.capability)} — ${customerName}`,
    details,
    priority: mapPriority(event.priorityBand),
    assignedTo: event.owner,
    verificationCriteria: `${event.verificationMetricId ?? "driving control"} must pass`,
  };
}

/** Map a Halo status to a Pulse state, applying the verification gate on close. */
export function haloStatusToPulse(
  status: HaloStatus,
  verificationSatisfied: boolean,
  priorState: RiskEventState | null,
): RiskEventState {
  switch (status) {
    case "new":
      return "ASSIGNED";
    case "in_progress":
      return "IN_PROGRESS";
    case "on_hold":
      return "PENDING_VENDOR";
    case "resolved":
    case "closed":
      // Halo closure never resolves Pulse without verification (PRD-008).
      if (verificationSatisfied) return "VERIFIED_RESOLVED";
      // A ticket closed without verification, after we'd already verified, reopens.
      return priorState === "VERIFIED_RESOLVED" ? "REOPENED" : "MITIGATED";
    default:
      return "OPEN";
  }
}

/**
 * Workflow engine (ARCHITECTURE component 8). Creates one persistent ticket per
 * risk event (duplicate prevention), synchronizes status bidirectionally, gates
 * resolution on verification, and queues updates when Halo is unreachable.
 */
export class WorkflowEngine {
  private work = new Map<string, WorkItem>();
  private queue: QueuedUpdate[] = [];

  constructor(private halo: HaloClient) {}

  getWorkItem(riskEventId: string): WorkItem | undefined {
    return this.work.get(riskEventId);
  }

  queuedCount(): number {
    return this.queue.length;
  }

  /**
   * Create accountable work for a risk event. Idempotent: a second call for the
   * same event returns the existing work item and creates no second ticket. If
   * Halo is unreachable the request is queued (not lost) and retried by flush().
   */
  async createWork(event: RiskEvent, customerName: string, now: string): Promise<WorkItem | { queued: true }> {
    const existing = this.work.get(event.id);
    if (existing) return existing;

    const draft = draftTicket(event, customerName);
    try {
      const ticket = await this.halo.createTicket(draft, now);
      const item: WorkItem = {
        id: stableId(`work|${event.id}`),
        riskEventId: event.id,
        customerId: event.customerId,
        haloTicketId: ticket.id,
        pulseState: "ASSIGNED",
        verified: false,
        updatedAt: now,
      };
      this.work.set(event.id, item);
      return item;
    } catch {
      this.queue.push({ riskEventId: event.id, draft });
      return { queued: true };
    }
  }

  /** Retry queued creations after an outage clears. */
  async flush(now: string): Promise<number> {
    const pending = this.queue;
    this.queue = [];
    let created = 0;
    for (const q of pending) {
      if (this.work.has(q.riskEventId)) continue;
      try {
        const ticket = await this.halo.createTicket(q.draft, now);
        this.work.set(q.riskEventId, {
          id: stableId(`work|${q.riskEventId}`),
          riskEventId: q.riskEventId,
          customerId: q.draft.customerId,
          haloTicketId: ticket.id,
          pulseState: "ASSIGNED",
          verified: false,
          updatedAt: now,
        });
        created++;
      } catch {
        this.queue.push(q); // still down — keep it queued
      }
    }
    return created;
  }

  /**
   * Pull the ticket's current status from Halo and reconcile the Pulse state,
   * applying the verification gate. `verificationSatisfied` is the deterministic
   * signal from the scoring engine — the AI/workflow layers can never set it.
   */
  async syncFromHalo(riskEventId: string, verificationSatisfied: boolean, now: string): Promise<WorkItem | null> {
    const item = this.work.get(riskEventId);
    if (!item) return null;
    const ticket = await this.halo.getTicket(item.haloTicketId);
    if (!ticket) return item;

    const next = haloStatusToPulse(ticket.status, verificationSatisfied, item.pulseState);
    const updated: WorkItem = {
      ...item,
      pulseState: next,
      verified: next === "VERIFIED_RESOLVED",
      updatedAt: now,
    };
    this.work.set(riskEventId, updated);
    return updated;
  }
}
