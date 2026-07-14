import type { HaloTicket, TicketDraft } from "@/lib/workflow/types";
import { stableId } from "@/lib/util/rng";

/**
 * HaloPSA client boundary. A production implementation calls the Halo REST API;
 * the in-memory implementation below backs tests and the demo. Keeping this an
 * interface means the workflow engine never depends on Halo transport details.
 */
export interface HaloClient {
  createTicket(draft: TicketDraft, now: string): Promise<HaloTicket>;
  updateTicket(id: string, patch: Partial<HaloTicket>, now: string): Promise<HaloTicket>;
  getTicket(id: string): Promise<HaloTicket | null>;
}

/** Deterministic in-memory HaloPSA stand-in. `outage` makes writes fail so the
 *  engine's queue-on-outage behavior can be exercised. */
export class InMemoryHaloClient implements HaloClient {
  private tickets = new Map<string, HaloTicket>();
  outage = false;

  async createTicket(draft: TicketDraft, now: string): Promise<HaloTicket> {
    if (this.outage) throw new Error("Halo API unreachable (503)");
    const id = stableId(`halo|${draft.riskEventId}`);
    const ticket: HaloTicket = {
      id,
      riskEventId: draft.riskEventId,
      customerId: draft.customerId,
      subject: draft.subject,
      details: draft.details,
      priority: draft.priority,
      status: "new",
      assignedTo: draft.assignedTo,
      verificationCriteria: draft.verificationCriteria,
      createdAt: now,
      updatedAt: now,
    };
    this.tickets.set(id, ticket);
    return ticket;
  }

  async updateTicket(id: string, patch: Partial<HaloTicket>, now: string): Promise<HaloTicket> {
    if (this.outage) throw new Error("Halo API unreachable (503)");
    const existing = this.tickets.get(id);
    if (!existing) throw new Error(`Ticket not found: ${id}`);
    const updated = { ...existing, ...patch, updatedAt: now };
    this.tickets.set(id, updated);
    return updated;
  }

  async getTicket(id: string): Promise<HaloTicket | null> {
    return this.tickets.get(id) ?? null;
  }

  /** Test/demo helper — set the vendor-side status. */
  async _setStatus(id: string, status: HaloTicket["status"], now: string): Promise<void> {
    const t = this.tickets.get(id);
    if (t) this.tickets.set(id, { ...t, status, updatedAt: now });
  }

  count(): number {
    return this.tickets.size;
  }
}
