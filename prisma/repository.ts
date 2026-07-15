/**
 * Tenant-scoped repository pattern (reference).
 *
 * Every data-access path binds the tenant on the connection before querying, so
 * the RLS policies in prisma/rls.sql enforce isolation in the database — not just
 * in application code (defense in depth; ARCHITECTURE.md "Enforce tenant scoping
 * in the repository and with PostgreSQL row-level security"). Run all tenant work
 * through `withTenant` so a missing bind can never leak across tenants.
 *
 * Excluded from the Next build (see tsconfig "exclude") — it depends on the
 * generated Prisma client. Move into `src/` once `prisma generate` has run.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Run `fn` inside a transaction with `app.current_tenant` bound, so every query
 * it makes is filtered to that tenant by row-level security. `SET LOCAL` scopes
 * the binding to the transaction.
 */
export async function withTenant<T>(
  tenantId: string,
  fn: (tx: Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    // Parameterized set to avoid injection; RLS reads current_setting('app.current_tenant').
    await tx.$executeRaw`SELECT set_config('app.current_tenant', ${tenantId}, true)`;
    return fn(tx);
  });
}

// Example: only ever returns the bound tenant's customers.
export function listCustomers(tenantId: string) {
  return withTenant(tenantId, (tx) => tx.customer.findMany({ orderBy: { displayName: "asc" } }));
}

export function getRiskEvent(tenantId: string, riskEventId: string) {
  return withTenant(tenantId, (tx) =>
    tx.riskEvent.findUnique({
      where: { id: riskEventId },
      include: { recommendations: true, findings: true },
    }),
  );
}
