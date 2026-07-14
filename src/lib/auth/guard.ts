import type { Identity } from "@/lib/auth/identity";
import type { Permission } from "@/lib/auth/roles";
import { roleHasPermission } from "@/lib/auth/roles";

export class AuthzError extends Error {
  constructor(
    public code: "forbidden" | "cross_tenant",
    message: string,
  ) {
    super(message);
    this.name = "AuthzError";
  }
}

export function can(identity: Identity, permission: Permission): boolean {
  return roleHasPermission(identity.roles, permission);
}

/** Throws AuthzError if the identity lacks the permission. */
export function requirePermission(identity: Identity, permission: Permission): void {
  if (!can(identity, permission)) {
    throw new AuthzError("forbidden", `Requires ${permission}`);
  }
}

/** Customer principals may only act within their own customer scope. */
export function requireCustomerScope(identity: Identity, customerId: string): void {
  if (identity.customerId && identity.customerId !== customerId) {
    throw new AuthzError("cross_tenant", "Customer users cannot access other customers");
  }
}

/**
 * Strip role-gated fields from an object before it leaves the API (do/dont:
 * "COGS is INTERNAL-tagged, admin-only, stripped at the API serializer"; PRD-012:
 * "Commercial overlays are role restricted"). Removing at the serializer means UI
 * hiding is never the only line of defense.
 */
export function serializeForIdentity<T extends Record<string, unknown>>(
  identity: Identity,
  data: T,
  gated: { commercials?: (keyof T)[]; cost?: (keyof T)[] } = {},
): Partial<T> {
  const out: Partial<T> = { ...data };
  if (!can(identity, "commercials:view")) for (const k of gated.commercials ?? []) delete out[k];
  if (!can(identity, "cost:view")) for (const k of gated.cost ?? []) delete out[k];
  return out;
}

/** Map an AuthzError to an HTTP status. */
export function authzStatus(err: AuthzError): number {
  return err.code === "cross_tenant" ? 404 : 403; // 404 hides existence cross-tenant
}
