import { describe, it, expect } from "vitest";
import { WorkflowEngine, draftTicket } from "@/lib/workflow/engine";
import { InMemoryHaloClient } from "@/lib/workflow/halo";
import { getPortfolioModel } from "@/lib/data/compute";
import { hasSensitiveContent } from "@/lib/ai/redaction";
import { REFERENCE_NOW } from "@/lib/data/generate";
import type { WorkItem } from "@/lib/workflow/types";

function firstEvent() {
  const m = getPortfolioModel().customers.find((c) => c.events.length > 0)!;
  return { event: m.events[0], name: m.customer.displayName };
}

describe("HaloPSA workflow (PRD-008)", () => {
  it("drafts a ticket with impact, remediation, and verification, free of sensitive content", () => {
    const { event, name } = firstEvent();
    const draft = draftTicket(event, name);
    expect(draft.subject).toContain(name);
    expect(draft.details).toContain("Remediation:");
    expect(draft.details).toContain("Verification:");
    expect(hasSensitiveContent(draft.details)).toBe(false);
  });

  it("creates one persistent ticket per event (duplicate prevention)", async () => {
    const halo = new InMemoryHaloClient();
    const engine = new WorkflowEngine(halo);
    const { event, name } = firstEvent();

    const first = (await engine.createWork(event, name, REFERENCE_NOW)) as WorkItem;
    const second = (await engine.createWork(event, name, REFERENCE_NOW)) as WorkItem;

    expect(first.haloTicketId).toBe(second.haloTicketId);
    expect(halo.count()).toBe(1);
  });

  it("does not resolve Pulse when Halo closes without verification", async () => {
    const halo = new InMemoryHaloClient();
    const engine = new WorkflowEngine(halo);
    const { event, name } = firstEvent();
    const item = (await engine.createWork(event, name, REFERENCE_NOW)) as WorkItem;

    // Halo ticket closed, but the verification metric has NOT passed.
    await halo._setStatus(item.haloTicketId, "closed", REFERENCE_NOW);
    const synced = await engine.syncFromHalo(event.id, false, REFERENCE_NOW);
    expect(synced!.pulseState).toBe("MITIGATED");
    expect(synced!.verified).toBe(false);

    // Once verification passes, it resolves.
    const resolved = await engine.syncFromHalo(event.id, true, REFERENCE_NOW);
    expect(resolved!.pulseState).toBe("VERIFIED_RESOLVED");
    expect(resolved!.verified).toBe(true);

    // If verification later fails again, the event reopens.
    const reopened = await engine.syncFromHalo(event.id, false, REFERENCE_NOW);
    expect(reopened!.pulseState).toBe("REOPENED");
  });

  it("maps in-progress Halo status to Pulse", async () => {
    const halo = new InMemoryHaloClient();
    const engine = new WorkflowEngine(halo);
    const { event, name } = firstEvent();
    const item = (await engine.createWork(event, name, REFERENCE_NOW)) as WorkItem;
    await halo._setStatus(item.haloTicketId, "in_progress", REFERENCE_NOW);
    const synced = await engine.syncFromHalo(event.id, false, REFERENCE_NOW);
    expect(synced!.pulseState).toBe("IN_PROGRESS");
  });

  it("queues updates during an outage and delivers them on flush", async () => {
    const halo = new InMemoryHaloClient();
    halo.outage = true;
    const engine = new WorkflowEngine(halo);
    const { event, name } = firstEvent();

    const result = await engine.createWork(event, name, REFERENCE_NOW);
    expect(result).toEqual({ queued: true });
    expect(engine.queuedCount()).toBe(1);
    expect(halo.count()).toBe(0);

    halo.outage = false;
    const created = await engine.flush(REFERENCE_NOW);
    expect(created).toBe(1);
    expect(engine.queuedCount()).toBe(0);
    expect(halo.count()).toBe(1);
  });
});
