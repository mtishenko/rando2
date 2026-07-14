import { cookies } from "next/headers";
import { identityForRole, type Identity } from "@/lib/auth/identity";
import { ALL_ROLES, type Role } from "@/lib/auth/roles";

/**
 * Resolve the current identity in a server component from the `pulse_role` cookie
 * (demo). In production this validates the Entra ID session token instead. Kept in
 * a separate module so `next/headers` is never pulled into unit tests.
 */
export async function getServerIdentity(): Promise<Identity> {
  const store = await cookies();
  const value = store.get("pulse_role")?.value;
  const role: Role = ALL_ROLES.find((r) => r.toLowerCase() === (value ?? "").toLowerCase()) ?? "ServiceManager";
  return identityForRole(role);
}
