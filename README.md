# Edgefi Pulse

Operational intelligence for Edgefi's managed-services practice. Pulse ingests data
from Edgefi's systems, normalizes it into a common customer model, continuously
evaluates **health, coverage, confidence, and risk**, and determines the next
highest-value action for the team.

This repository is the **first build slice**: a runnable Next.js + TypeScript app
implementing the deterministic **scoring / risk / priority engine** and the flagship
**Office TV Command Center**, backed by realistic seeded data. It corresponds to
Phases 3–5 of the [implementation roadmap](#prd-mapping) (Normalization & Scoring,
Risk & Workflow, Command Center) with the AI reasoning layer represented by a
grounded, deterministic QBR assembler.

> The complete product requirements package (VISION, PRD-MASTER, ARCHITECTURE,
> DATA_MODEL, SCORING_MODEL, METRIC_CATALOG, 15 sub-PRDs, etc.) describes a
> multi-quarter platform. This slice makes the core value demonstrable end-to-end
> today; connectors to live vendor systems, HaloPSA sync, Entra SSO, and the
> customer portal are subsequent phases.

## Quick start

```bash
npm install
npm run dev      # http://localhost:3000
# or
npm run build && npm start
npm test         # scoring + acceptance-scenario suite (Vitest)
```

## What's here

| Area | Path | Notes |
|---|---|---|
| Canonical model | `src/lib/types.ts` | Entities, metric/integration/risk state enums (DATA_MODEL.md) |
| Metric registry | `src/lib/metrics/catalog.ts` | All 42 metrics from METRIC_CATALOG.md, versioned, weighted by criticality |
| Scoring engine | `src/lib/scoring/` | Health, Coverage, Confidence, Impact, portfolio rollup (SCORING_MODEL.md) |
| Risk engine | `src/lib/risk/` | Finding→risk-event grouping, 0–1000 priority with boosts/reductions, recommendations, verification gate |
| Seed data | `src/lib/data/` | 14 deterministic customers; the 5 acceptance scenarios baked in |
| UI | `src/app/` | Office TV, Command Center, Customer & Risk-event drill-downs, Executive, Integrations, Metric Registry |
| API | `src/app/api/` | REST routes matching `api/openapi-outline.yaml` |
| Tests | `src/lib/**/*.test.ts` | Formula tests + the 5 required acceptance scenarios |

## Scoring model (as implemented)

- **Customer Health** = `Σ(metric_score × weight) / Σ(weight for scorable metrics)`.
  Only `PASS/PARTIAL/FAIL/EXCEPTION_ACTIVE` are scorable — **missing, stale, error,
  and unknown states never silently lower health**; they reduce coverage/confidence
  and create work instead.
- **Measurement Coverage** = weight of applicable metrics with usable evidence ÷
  weight of all applicable metrics. `NOT_PURCHASED` / `NOT_APPLICABLE` are excluded.
- **Evidence Confidence** = `Freshness × Source reliability × Population completeness
  × Evidence quality`, weight-averaged across applicable metrics.
- **Edgefi Impact** = 35% verified risk reduction, 25% health improvement, 20%
  coverage improvement, 10% recurrence prevention, 10% durable-control improvement.
  Ticket closure alone earns no credit.
- **Priority (0–1000)** = geometric-mean normalization of Severity × Business
  criticality × Exposure × Trend × Age × Population × Confidence × Responsibility,
  then explicit boosts (failed backup, active compromise, privileged exposure,
  recurrence, exec escalation, no owner…) and reductions (approved exception,
  compensating control, funded remediation). Every factor is shown on the risk
  drill-down for full explainability.
- **Portfolio aggregation** = 50% equal / 30% tier / 20% managed-population, with a
  per-customer cap so no single account dominates.

## Required acceptance scenarios (TESTING_STRATEGY.md)

All five are covered by `src/lib/data/acceptance.test.ts`:

1. Failed production backups move **Harborview Health** into the TV top ten.
2. Missing CrowdStrike data at **Cascade** lowers coverage and creates an
   unverified-control event — without falsely lowering health.
3. A closed Halo ticket at **Summit Financial** leaves the event `MITIGATED`, not
   `VERIFIED_RESOLVED`, until a successful backup is observed (also enforced by the
   `PATCH /api/risk-events/{id}` 409 verification gate).
4. **Cedar Legal** (no ControlMap contract) is not penalized — GRC metrics are
   `NOT_PURCHASED` and create no event.
5. A stale Microsoft Graph connector at **Meridian** lowers confidence and surfaces
   an integration issue.

## PRD mapping

| Roadmap phase | Status in this build |
|---|---|
| 1 · Core platform | Model, metric registry, audit-ready structures (in-memory) |
| 3 · Normalization & scoring | ✅ full scoring engine + snapshots-ready outputs |
| 4 · Risk & workflow | ✅ risk events, priority, recommendations, verification gate |
| 5 · Command Center | ✅ Office TV, service-manager console, drill-downs, executive |
| 7 · AI layer | Grounded, deterministic QBR assembler (`POST /api/reports/qbr`) |
| 2 · Integrations, 6 · more integrations, 8 · portal | Represented by seeded data; live connectors are next |

## Notes

- All data is **deterministic** (seeded PRNG + a fixed reference time), so scores,
  IDs, and the dashboard are reproducible and testable.
- The TV view is TV-safe: **display names only** — no users, hosts, IPs, CVEs, or
  ticket contents, per TV_DASHBOARD_SPEC.md.
