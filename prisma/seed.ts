/**
 * Seed the database from the deterministic in-memory model, so a fresh Postgres
 * mirrors exactly what the app renders. Run after migrate + rls:
 *
 *   npm run db:seed
 *
 * Uses the tsconfig "@/*" path alias (tsx honors tsconfig paths).
 */
import { PrismaClient } from "@prisma/client";
import { getPortfolioModel } from "@/lib/data/compute";
import { METRIC_CATALOG } from "@/lib/metrics/catalog";
import { TENANT_ID } from "@/lib/data/roster";
import { REFERENCE_NOW } from "@/lib/data/generate";

const prisma = new PrismaClient();

function hoursAgo(hours: number): Date {
  return new Date(Date.parse(REFERENCE_NOW) - hours * 3600_000);
}

async function main() {
  const pm = getPortfolioModel();

  await prisma.tenant.upsert({
    where: { id: TENANT_ID },
    update: {},
    create: { id: TENANT_ID, name: "Edgefi" },
  });

  for (const m of METRIC_CATALOG) {
    await prisma.metricDefinition.upsert({
      where: { id: m.id },
      update: {},
      create: {
        id: m.id,
        tenantId: TENANT_ID,
        name: m.name,
        category: m.category,
        capability: m.capability,
        source: m.source,
        target: m.target,
        criticality: m.criticality,
        weight: m.weight,
        freshnessThresholdHours: m.freshnessThresholdHours,
        businessRisk: m.businessRisk,
        remediation: m.remediation,
        ownerRole: m.ownerRole,
        populationBased: m.populationBased,
        version: m.version,
      },
    });
  }

  for (const model of pm.customers) {
    const c = model.customer;
    await prisma.customer.upsert({
      where: { id: c.id },
      update: {},
      create: {
        id: c.id,
        tenantId: c.tenantId,
        legalName: c.displayName,
        displayName: c.displayName,
        tier: c.tier,
        industry: c.industry,
        employeeCount: c.employeeCount,
        managedPopulation: c.managedPopulation,
        accountOwner: c.accountOwner,
        serviceManager: c.serviceManager,
        criticality: c.criticality,
        onboardingDate: new Date(c.onboardingDate),
      },
    });

    await prisma.customerCapability.createMany({
      data: c.contractedCapabilities.map((cap) => ({
        tenantId: c.tenantId,
        customerId: c.id,
        capability: cap,
        responsibilityModel: "edgefi_managed",
        contractedState: "active",
      })),
      skipDuplicates: true,
    });

    await prisma.integration.createMany({
      data: model.integrations.map((i) => ({
        tenantId: c.tenantId,
        customerId: c.id,
        type: i.type,
        capability: i.capability,
        state: i.state,
        lastSuccessAt: hoursAgo(i.lastSuccessAgeHours),
        failureCount: i.failureCount,
        critical: i.critical,
      })),
    });

    await prisma.metricObservation.createMany({
      data: model.observations.map((o) => ({
        tenantId: c.tenantId,
        customerId: o.customerId,
        metricId: o.metricId,
        state: o.state,
        value: o.value,
        observedAt: new Date(o.observedAt),
        ageHours: o.ageHours,
        source: o.source,
        populationExpected: o.populationExpected,
        populationObserved: o.populationObserved,
        sourceReliability: o.sourceReliability,
        evidenceQuality: o.evidenceQuality,
        evidenceNote: o.evidenceNote,
      })),
    });

    for (const e of model.events) {
      await prisma.riskEvent.create({
        data: {
          id: e.id,
          tenantId: c.tenantId,
          customerId: e.customerId,
          title: e.title,
          capability: e.capability,
          category: e.category,
          state: e.state,
          priorityScore: e.priorityScore,
          priorityBand: e.priorityBand,
          businessImpact: e.businessImpact,
          primaryReason: e.primaryReason,
          confidence: e.confidence,
          metricIds: e.metricIds,
          firstSeenAt: new Date(e.firstSeenAt),
          lastSeenAt: new Date(e.lastSeenAt),
          ageDays: e.ageDays,
          recurrenceCount: e.recurrenceCount,
          trend: e.trend,
          owner: e.owner,
          verificationMetricId: e.verificationMetricId,
          verificationSatisfied: e.verificationSatisfied,
          breakdown: e.breakdown as object,
          recommendations: {
            create: {
              tenantId: c.tenantId,
              action: e.recommendation.action,
              suggestedOwnerRole: e.recommendation.suggestedOwnerRole,
              estimatedEffortHours: e.recommendation.estimatedEffortHours,
              expectedHealthImprovement: e.recommendation.expectedHealthImprovement,
              expectedRiskReduction: e.recommendation.expectedRiskReduction,
              requiresHumanApproval: e.recommendation.requiresHumanApproval,
            },
          },
        },
      });
    }

    await prisma.scoreSnapshot.create({
      data: {
        tenantId: c.tenantId,
        customerId: c.id,
        modelVersion: "2026.07.0",
        health: model.scores.health,
        coverage: model.scores.coverage,
        confidence: model.scores.confidence,
        capturedAt: new Date(REFERENCE_NOW),
        detail: model.scores as object,
      },
    });
  }

  await prisma.auditEvent.create({
    data: {
      tenantId: TENANT_ID,
      actor: "seed-script",
      action: "seed.load",
      targetType: "tenant",
      targetId: TENANT_ID,
      after: { customers: pm.customers.length, metrics: METRIC_CATALOG.length },
    },
  });

  console.log(
    `Seeded ${pm.customers.length} customers, ${METRIC_CATALOG.length} metric definitions.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
