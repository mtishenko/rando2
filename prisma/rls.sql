-- Edgefi Pulse — PostgreSQL row-level security (ARCHITECTURE.md / SECURITY_REQUIREMENTS.md).
--
-- Every tenant-scoped table only exposes rows whose "tenantId" matches the tenant
-- bound to the current connection. The application binds it per request/transaction:
--
--     SET app.current_tenant = '<tenant-uuid>';   -- or SET LOCAL inside a tx
--
-- Run this AFTER `prisma migrate` (Prisma does not manage RLS):
--     psql "$DATABASE_URL" -f prisma/rls.sql
--
-- Connect the application as a NON-superuser, non-owner role — BYPASSRLS and table
-- owners are exempt from these policies.

DO $$
DECLARE
  t text;
  tenant_tables text[] := ARRAY[
    'Customer','CustomerProfile','CustomerCapability','Integration',
    'MetricDefinition','MetricObservation','Finding','RiskEvent',
    'Recommendation','WorkItem','Exception','ScoreSnapshot','AuditEvent'
  ];
BEGIN
  FOREACH t IN ARRAY tenant_tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY;', t);

    -- Reads: only rows for the bound tenant.
    EXECUTE format($f$
      CREATE POLICY tenant_isolation_select ON %I
      FOR SELECT USING ("tenantId" = current_setting('app.current_tenant', true));
    $f$, t);

    -- Writes: inserted/updated rows must belong to the bound tenant.
    EXECUTE format($f$
      CREATE POLICY tenant_isolation_modify ON %I
      FOR ALL
      USING ("tenantId" = current_setting('app.current_tenant', true))
      WITH CHECK ("tenantId" = current_setting('app.current_tenant', true));
    $f$, t);
  END LOOP;
END $$;
