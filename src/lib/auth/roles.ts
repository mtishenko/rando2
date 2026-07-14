/**
 * Roles and permissions (PRD-015). Roles come from Entra ID group claims in
 * production; the permission mapping here is the authoritative policy the API and
 * UI both consult. UI hiding is never the authorization mechanism — every gated
 * action is also checked here at the API boundary (do/dont: "Render by policy AND
 * enforce at the API").
 */

export type Role =
  | "PlatformAdmin"
  | "SecurityAdmin"
  | "ServiceManager"
  | "Engineer"
  | "AccountManager"
  | "ExecutiveViewer"
  | "CustomerAdmin"
  | "CustomerViewer";

export type Permission =
  | "portfolio:view" // internal dashboards (command center, exec, customers)
  | "risk:manage" // acknowledge, assign, create work, update state
  | "exception:approve" // approve risk acceptances / N/A changes
  | "automation:approve" // approve automation policies / high-impact actions
  | "commercials:view" // renewal risk, tier value, account commercials
  | "cost:view" // internal unit cost / margin (COGS) — admin only
  | "admin:manage" // tenants, users, metrics, connectors, feature flags
  | "portal:view"; // customer portal (own tenant only)

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  PlatformAdmin: [
    "portfolio:view",
    "risk:manage",
    "exception:approve",
    "automation:approve",
    "commercials:view",
    "cost:view",
    "admin:manage",
  ],
  SecurityAdmin: ["portfolio:view", "risk:manage", "exception:approve", "automation:approve"],
  ServiceManager: ["portfolio:view", "risk:manage", "exception:approve"],
  Engineer: ["portfolio:view", "risk:manage"],
  AccountManager: ["portfolio:view", "commercials:view"],
  ExecutiveViewer: ["portfolio:view", "commercials:view"],
  CustomerAdmin: ["portal:view"],
  CustomerViewer: ["portal:view"],
};

export const ALL_ROLES = Object.keys(ROLE_PERMISSIONS) as Role[];

export const ALL_PERMISSIONS: Permission[] = [
  "portfolio:view",
  "risk:manage",
  "exception:approve",
  "automation:approve",
  "commercials:view",
  "cost:view",
  "admin:manage",
  "portal:view",
];

export function permissionsFor(roles: Role[]): Set<Permission> {
  const set = new Set<Permission>();
  for (const r of roles) for (const p of ROLE_PERMISSIONS[r] ?? []) set.add(p);
  return set;
}

export function roleHasPermission(roles: Role[], permission: Permission): boolean {
  return roles.some((r) => (ROLE_PERMISSIONS[r] ?? []).includes(permission));
}

/** Customer roles are tenant/customer-scoped and can never see internal surfaces. */
export function isCustomerRole(role: Role): boolean {
  return role === "CustomerAdmin" || role === "CustomerViewer";
}
