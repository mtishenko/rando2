import { describe, it, expect } from "vitest";
import { getPortfolioModel } from "@/lib/data/compute";
import { buildPortalView } from "@/lib/ui/portal";
import { hasSensitiveContent } from "@/lib/ai/redaction";
import { METRIC_CATALOG } from "@/lib/metrics/catalog";

/** Vendor / product names that must never appear on a customer-facing surface. */
const VENDOR_NAMES = ["CrowdStrike", "Huntress", "MSP360", "NinjaOne", "Meraki", "UniFi", "ControlMap", "IT Glue", "HaloPSA", "Defender", "Entra"];

describe("Customer portal display safety (PRD-010)", () => {
  const models = getPortfolioModel().customers;

  it("never leaks metric IDs, vendor names, or sensitive content", () => {
    for (const model of models) {
      const v = buildPortalView(model);
      const strings = [
        ...v.workingOn.flatMap((w) => [w.capability, w.headline, w.status]),
        ...v.needsYou.flatMap((w) => [w.capability, w.headline]),
        ...v.acceptedRisks.flatMap((r) => [r.capability, r.note]),
      ];
      for (const s of strings) {
        expect(hasSensitiveContent(s), `sensitive content in "${s}"`).toBe(false);
        for (const metric of METRIC_CATALOG) {
          expect(s.includes(metric.id), `metric ID ${metric.id} leaked in "${s}"`).toBe(false);
        }
        for (const vendor of VENDOR_NAMES) {
          expect(s.includes(vendor), `vendor ${vendor} leaked in "${s}"`).toBe(false);
        }
      }
    }
  });

  it("distinguishes confirmed failures from unverified controls", () => {
    // Meridian's identity data is stale (a visibility gap) — its identity event
    // must read as "visibility". Harborview has failing backups — "issue".
    const byName = (n: string) => models.find((m) => m.customer.displayName === n)!;
    const meridian = buildPortalView(byName("Meridian Logistics"));
    const harborview = buildPortalView(byName("Harborview Health"));

    const meridianIdentity = meridian.workingOn.find((w) => w.capability.includes("Identity"));
    expect(meridianIdentity?.kind).toBe("visibility");

    const harborBackup = harborview.workingOn.find((w) => w.capability.includes("Backup"));
    expect(harborBackup?.kind).toBe("issue");
  });

  it("surfaces approved exceptions as accepted risks", () => {
    // Everest has an approved M365 forwarding exception.
    const everest = buildPortalView(
      models.find((m) => m.customer.displayName === "Everest Capital")!,
    );
    expect(everest.acceptedRisks.length).toBeGreaterThanOrEqual(1);
  });
});
