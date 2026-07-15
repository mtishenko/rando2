import { describe, it, expect } from "vitest";
import { roleHasPermission, permissionsFor, ALL_ROLES } from "@/lib/auth/roles";
import { identityForRole } from "@/lib/auth/identity";
import {
  can,
  requirePermission,
  requireCustomerScope,
  serializeForIdentity,
  AuthzError,
} from "@/lib/auth/guard";

describe("RBAC policy (PRD-015)", () => {
  it("grants risk:manage to operators but not to viewers", () => {
    expect(roleHasPermission(["Engineer"], "risk:manage")).toBe(true);
    expect(roleHasPermission(["ServiceManager"], "risk:manage")).toBe(true);
    expect(roleHasPermission(["ExecutiveViewer"], "risk:manage")).toBe(false);
    expect(roleHasPermission(["CustomerViewer"], "risk:manage")).toBe(false);
  });

  it("restricts cost:view to Platform Admin only", () => {
    const canSeeCost = ALL_ROLES.filter((r) => roleHasPermission([r], "cost:view"));
    expect(canSeeCost).toEqual(["PlatformAdmin"]);
  });

  it("restricts commercials to exec / account / admin", () => {
    expect(roleHasPermission(["ExecutiveViewer"], "commercials:view")).toBe(true);
    expect(roleHasPermission(["AccountManager"], "commercials:view")).toBe(true);
    expect(roleHasPermission(["Engineer"], "commercials:view")).toBe(false);
  });

  it("customer roles get only portal access", () => {
    expect([...permissionsFor(["CustomerAdmin"])]).toEqual(["portal:view"]);
    expect(roleHasPermission(["CustomerAdmin"], "portfolio:view")).toBe(false);
  });
});

describe("Guards", () => {
  it("requirePermission throws for insufficient role", () => {
    const exec = identityForRole("ExecutiveViewer");
    expect(() => requirePermission(exec, "risk:manage")).toThrow(AuthzError);
    expect(can(exec, "commercials:view")).toBe(true);
  });

  it("blocks customer users from other customers", () => {
    const customer = identityForRole("CustomerAdmin");
    expect(customer.customerId).toBeTruthy();
    expect(() => requireCustomerScope(customer, "some-other-customer")).toThrow(AuthzError);
    // Their own customer is allowed.
    expect(() => requireCustomerScope(customer, customer.customerId!)).not.toThrow();
  });
});

describe("Field gating at the serializer", () => {
  const row = { name: "Acme", health: 88, renewalRisk: "high", unitCost: 1234 };

  it("strips commercials and cost for an engineer", () => {
    const out = serializeForIdentity(identityForRole("Engineer"), row, {
      commercials: ["renewalRisk"],
      cost: ["unitCost"],
    });
    expect(out.renewalRisk).toBeUndefined();
    expect(out.unitCost).toBeUndefined();
    expect(out.health).toBe(88);
  });

  it("keeps commercials for an executive but still strips cost", () => {
    const out = serializeForIdentity(identityForRole("ExecutiveViewer"), row, {
      commercials: ["renewalRisk"],
      cost: ["unitCost"],
    });
    expect(out.renewalRisk).toBe("high");
    expect(out.unitCost).toBeUndefined();
  });

  it("keeps everything for a platform admin", () => {
    const out = serializeForIdentity(identityForRole("PlatformAdmin"), row, {
      commercials: ["renewalRisk"],
      cost: ["unitCost"],
    });
    expect(out.renewalRisk).toBe("high");
    expect(out.unitCost).toBe(1234);
  });
});
