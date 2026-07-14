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
| AI reasoning | `src/lib/ai/` | Grounded change explanations & QBR narratives via the Claude API, with redaction, prompt registry, output validation, and a deterministic fallback |
| Customer portal | `src/lib/ui/portal.ts`, `src/app/(portal)/` | Customer-facing posture view with strict display safety (capability-level, vendor-free) |
| Connector SDK | `src/lib/connectors/` | Canonical event envelope, connector interface, health/idempotency, NinjaOne example + fixture + contract test |
| Persistence | `prisma/` | Postgres schema (canonical model, tenant-scoped), RLS policies, seed from the deterministic model |
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

## AI reasoning layer (Phase 7)

`src/lib/ai/` implements the grounded reasoning layer from `AI_GOVERNANCE.md` /
PRD-007, using the **Claude API** (`@anthropic-ai/sdk`, model `claude-opus-4-8`,
adaptive thinking, structured outputs):

- **Evidence builder + redaction** — assembles a redacted evidence package (the
  only facts the model may use); usernames, hosts, IPs, and CVEs are stripped
  before anything reaches the model.
- **Prompt registry** — versioned prompts (`change-explanation`,
  `risk-correlation`, `recommendation-draft`, `qbr-narrative`) enforcing the
  governance contract: ground in evidence only, never mark pass/resolved, return
  strict JSON, escalate `INSUFFICIENT_EVIDENCE`.
- **Output validation** — rejects outputs that cite findings not in the evidence,
  leak sensitive content, fail to ground an OK verdict, or under-flag high-impact
  approval. An invalid or refused model output never reaches the caller.
- **Grounding metadata** — every result carries customer ID, risk-event ID, cited
  finding IDs, sources, evidence timestamps, and model + prompt version.
- **Deterministic fallback** — when `ANTHROPIC_API_KEY` (or `ANTHROPIC_AUTH_TOKEN`)
  is unset, a deterministic grounded assembler produces the same-shape output, so
  the app runs end-to-end in dev and CI. Set a key to switch to live model calls.
- **Eval harness** — `src/lib/ai/evaluate.ts` scores grounding accuracy,
  unsupported-claim rate, JSON compliance, and status accuracy (TESTING_STRATEGY
  "AI Evaluation").

Surfaced at `POST /api/risk-events/{id}/explain`, `POST /api/reports/qbr`, and the
AI panel on each risk-event page.

## Customer portal (Phase 8)

`/portal/[id]` is the customer-facing surface (PRD-010). It shows a customer their
Health, Coverage, Evidence Confidence, controls-verified count, progress deltas,
what edgefi is working on for them, accepted risks, and reports — with **strict
display safety**:

- **No internal detail leaks** — capability-level, vendor-free wording only; never
  metric IDs, product names, usernames, hosts, IPs, or CVEs. Enforced by
  `src/lib/ui/portal.test.ts`, which scans every customer-facing string.
- **Confirmed failures vs unverified controls are distinguished** — an event driven
  by a real FAIL reads as an **Issue**; one driven by missing/stale/error data reads
  as a **Visibility** gap (e.g. Cascade's missing sensor data), never conflated.
- **Every statement maps to evidence**, and the entry point is tenant-isolated (a
  customer only sees their own organization).

## Connector SDK (Phases 2 & 6)

`src/lib/connectors/` is the ingestion framework (ARCHITECTURE.md Connector Layer).
Vendor logic is isolated behind a capability-based `Connector` interface; the
platform stays vendor-neutral. `runCollection` provides the ARCHITECTURE processing
guarantees — the canonical event envelope, idempotent ingestion + dedup by
`source_record_id`, source lineage, health tracking, and a dead-letter path — and
degrades a failed fetch to an integration health state instead of throwing.

The shipped **NinjaOne** example maps a recorded device fixture → canonical events
→ `MetricObservation`s (RMM coverage, patch compliance, offline devices,
unsupported OS) that flow straight into the scoring engine. `connectors.test.ts` is
the contract test (TESTING_STRATEGY "Contract Tests"): envelope completeness,
normalized states, idempotent dedup, health-on-auth-failure, and end-to-end into
`computeHealth` / `computeCoverage`. A production connector only swaps `fetchRaw`
for an authenticated API call.

## Persistence (Phases 1–2)

`prisma/` is the ready-to-run Postgres target for the canonical model:

- `schema.prisma` — every entity from DATA_MODEL.md, `tenantId` on all of them.
- `rls.sql` — PostgreSQL **row-level security** so tenant isolation is enforced in
  the database, keyed on `app.current_tenant` (bound per transaction).
- `repository.ts` — the tenant-scoped access pattern (`withTenant` binds the tenant
  before every query; RLS does the rest).
- `seed.ts` — loads the **same deterministic data** the app renders into the DB, so
  the two never diverge.

```bash
export DATABASE_URL=postgres://…
npm install            # generates the Prisma client
npm run db:migrate     # create tables
npm run db:rls         # apply row-level security
npm run db:seed        # load seed data
```

The running app still uses the in-memory model; `prisma/` is excluded from the app
build (it depends on the generated client). It is the seam to swap the in-memory
source for Postgres once a database is provisioned.

## Design system

The entire UI follows the **edgefi design system** (`edgefi-design` skill):
Poppins, a neutral white canvas, and the color laws — **ink = action**, **purple =
edgefi's presence only** (impact number and chart fills, never interactive),
**chartreuse = one signature moment** (the "Contain the chaos." tagline dot), 1px
borders, no card shadows, no gradients. The shipped tokens and component library
live in `src/app/tokens.css` and `src/app/edgefi-ui.css`; the Pulse-specific layer
(hero metrics, health bars, priority pills) is in `src/app/globals.css` and derives
every value from the system.

## Notes

- All data is **deterministic** (seeded PRNG + a fixed reference time), so scores,
  IDs, and the dashboard are reproducible and testable.
- The TV view is TV-safe: **display names only** — no users, hosts, IPs, CVEs, or
  ticket contents, per TV_DASHBOARD_SPEC.md.
