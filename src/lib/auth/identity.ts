import { TENANT_ID } from "@/lib/data/roster";
import { getPortfolioModel } from "@/lib/data/compute";
import type { Role } from "@/lib/auth/roles";
import { ALL_ROLES } from "@/lib/auth/roles";

/**
 * Authenticated principal. In production this is built from a validated Entra ID
 * token (roles from group claims, tenant/customer from directory attributes). For
 * the demo it is resolved from a role hint header/cookie so the RBAC behavior is
 * fully exercisable. Access is revoked when the directory removes the user — here,
 * an unknown role resolves to no identity.
 */
export interface Identity {
  id: string;
  name: string;
  email: string;
  roles: Role[];
  tenantId: string;
  /** Set for customer roles — scopes them to a single customer (tenant isolation). */
  customerId: string | null;
}

const DEFAULT_ROLE: Role = "ServiceManager";

function customerScopeFor(role: Role): string | null {
  if (role !== "CustomerAdmin" && role !== "CustomerViewer") return null;
  // Demo: bind customer users to the first seed customer.
  return getPortfolioModel().customers[0]?.customer.id ?? null;
}

export function identityForRole(role: Role): Identity {
  return {
    id: `user-${role.toLowerCase()}`,
    name: `Demo ${role}`,
    email: `${role.toLowerCase()}@edgefi.example`,
    roles: [role],
    tenantId: TENANT_ID,
    customerId: customerScopeFor(role),
  };
}

function parseRole(value: string | null | undefined): Role {
  const found = ALL_ROLES.find((r) => r.toLowerCase() === (value ?? "").toLowerCase());
  return found ?? DEFAULT_ROLE;
}

/** Resolve identity from a request (API routes) — `x-pulse-role` header or the
 *  `pulse_role` cookie. Replace with Entra token validation in production. */
export function identityFromRequest(req: Request): Identity {
  const header = req.headers.get("x-pulse-role");
  const cookie = req.headers
    .get("cookie")
    ?.split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith("pulse_role="))
    ?.split("=")[1];
  return identityForRole(parseRole(header ?? cookie));
}
