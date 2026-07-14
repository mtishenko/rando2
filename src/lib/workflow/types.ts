import type { RiskEventState } from "@/lib/types";

/** HaloPSA ticket status (subset we map). */
export type HaloStatus = "new" | "in_progress" | "on_hold" | "resolved" | "closed";

export type HaloPriority = "critical" | "high" | "medium" | "low";

export interface HaloTicket {
  id: string;
  riskEventId: string;
  customerId: string;
  subject: string;
  details: string;
  priority: HaloPriority;
  status: HaloStatus;
  assignedTo: string | null;
  verificationCriteria: string;
  createdAt: string;
  updatedAt: string;
}

/** Input to create a ticket — carries impact, evidence, remediation, verification
 *  criteria, and projected improvement (PRD-008). */
export interface TicketDraft {
  riskEventId: string;
  customerId: string;
  subject: string;
  details: string;
  priority: HaloPriority;
  assignedTo: string | null;
  verificationCriteria: string;
}

/** Pulse-side record linking a risk event to its Halo ticket. */
export interface WorkItem {
  id: string;
  riskEventId: string;
  customerId: string;
  haloTicketId: string;
  pulseState: RiskEventState;
  verified: boolean;
  updatedAt: string;
}

/** A ticket update that could not be delivered (outage) and must be retried
 *  (PRD-008 "Outages queue updates"). */
export interface QueuedUpdate {
  riskEventId: string;
  draft: TicketDraft;
}
