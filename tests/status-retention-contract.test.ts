import { PackageStatus } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  isPackageStatusTransitionAllowed,
  packageStatusTransitionMatrix,
} from "@/lib/content/statusTransitions";

const allPackageStatuses = Object.values(PackageStatus);

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

describe("PackageStatus transition contract", () => {
  it("covers every PackageStatus and rejects illegal jumps before update/audit", async () => {
    vi.doMock("@/lib/db", () => ({ prisma: {} }));
    const { transitionContentPackageStatusInTransaction } = await import(
      "@/lib/content/repository"
    );
    const tx = {
      contentPackage: {
        update: vi.fn(),
        findUniqueOrThrow: vi.fn(),
      },
      statusTransition: { create: vi.fn() },
    };

    expect(Object.keys(packageStatusTransitionMatrix).sort()).toEqual(
      [...allPackageStatuses].sort(),
    );
    expect(isPackageStatusTransitionAllowed(PackageStatus.archived, PackageStatus.selected)).toBe(
      false,
    );
    expect(isPackageStatusTransitionAllowed(PackageStatus.assigned, PackageStatus.approved)).toBe(
      false,
    );
    expect(
      isPackageStatusTransitionAllowed(
        PackageStatus.compliance_checked,
        PackageStatus.owner_approval_required,
      ),
    ).toBe(true);
    expect(
      isPackageStatusTransitionAllowed(PackageStatus.compliance_checked, PackageStatus.exported),
    ).toBe(false);
    expect(
      isPackageStatusTransitionAllowed(
        PackageStatus.owner_approval_required,
        PackageStatus.approved,
      ),
    ).toBe(true);
    expect(
      isPackageStatusTransitionAllowed(
        PackageStatus.owner_approval_required,
        PackageStatus.exported,
      ),
    ).toBe(false);
    expect(isPackageStatusTransitionAllowed(PackageStatus.approved, PackageStatus.exported)).toBe(
      true,
    );
    await expect(
      transitionContentPackageStatusInTransaction(tx as never, {
        id: "pkg_1",
        fromStatus: PackageStatus.archived,
        toStatus: PackageStatus.selected,
      }),
    ).rejects.toThrow("Illegal package status transition");
    expect(tx.contentPackage.update).not.toHaveBeenCalled();
    expect(tx.statusTransition.create).not.toHaveBeenCalled();
  });

  it("treats same-status updates as idempotent and creates no audit row", async () => {
    vi.doMock("@/lib/db", () => ({ prisma: {} }));
    const { transitionContentPackageStatusInTransaction } = await import(
      "@/lib/content/repository"
    );
    const packageRecord = { id: "pkg_1", status: PackageStatus.assigned };
    const tx = {
      contentPackage: {
        update: vi.fn(),
        findUniqueOrThrow: vi.fn(async () => packageRecord),
      },
      statusTransition: { create: vi.fn() },
    };

    await expect(
      transitionContentPackageStatusInTransaction(tx as never, {
        id: "pkg_1",
        fromStatus: PackageStatus.assigned,
        toStatus: PackageStatus.assigned,
        reason: "No-op drag",
      }),
    ).resolves.toBe(packageRecord);
    expect(tx.contentPackage.findUniqueOrThrow).toHaveBeenCalledWith({ where: { id: "pkg_1" } });
    expect(tx.contentPackage.update).not.toHaveBeenCalled();
    expect(tx.statusTransition.create).not.toHaveBeenCalled();
  });

  it("keeps normal service compliance checks behind draft existence and same-status no-op", async () => {
    const runComplianceCheck = vi.fn(async () => ({ id: "check_1" }));
    const loadContentPackageRecord = vi
      .fn()
      .mockResolvedValueOnce({ id: "pkg_1", status: PackageStatus.assigned, drafts: [] })
      .mockResolvedValueOnce({
        id: "pkg_2",
        status: PackageStatus.compliance_checked,
        drafts: [{ id: "draft_1" }],
      })
      .mockResolvedValueOnce({
        id: "pkg_3",
        status: PackageStatus.blog_draft_generated,
        drafts: [{ id: "draft_2" }],
      })
      .mockResolvedValueOnce({
        id: "pkg_3",
        status: PackageStatus.owner_approval_required,
        drafts: [{ id: "draft_2" }],
      });
    const transitionContentPackageStatus = vi.fn();
    vi.doMock("@/lib/compliance/service", () => ({ runComplianceCheck }));
    vi.doMock("@/lib/content/repository", () => ({
      listContentPackageRecords: vi.fn(async () => []),
      loadContentPackageRecord,
      transitionContentPackageStatus,
      updateContentPackageProgress: vi.fn(),
    }));
    vi.doMock("@/lib/content/serializers", () => ({
      serializeContentPackage: vi.fn((value) => ({ id: value.id, status: value.status })),
      serializeDraft: vi.fn((value) => value),
    }));
    vi.doMock("@/lib/db", () => ({ prisma: {} }));
    vi.doMock("@/lib/ai/runtime", () => ({ createRuntimeAIAdapter: vi.fn() }));
    vi.doMock("@/lib/company-profile/service", () => ({ getOrCreateCompanyProfile: vi.fn() }));
    vi.doMock("@/lib/content/generationContext", () => ({ loadContentGenerationContext: vi.fn() }));
    vi.doMock("@/lib/content/placement", () => ({ serializeActivePlacementProducts: vi.fn() }));
    vi.doMock("@/lib/content/titleCandidates", () => ({
      createHomefeedTitleCandidates: vi.fn(() => []),
      createThumbnailCandidates: vi.fn(() => []),
    }));
    vi.doMock("@/lib/logging/costBudget", () => ({
      AI_GENERATION_COST_USD: { contentBlogDraft: 0.01 },
      assertAiBudgetAllows: vi.fn(),
    }));
    vi.doMock("@/lib/logging/costLogger", () => ({ recordCostLog: vi.fn() }));

    const { ContentPackageStatusBlockedError, updateContentPackageStatus } = await import(
      "@/lib/content/service"
    );
    await expect(
      updateContentPackageStatus("pkg_1", { status: PackageStatus.compliance_checked }),
    ).rejects.toBeInstanceOf(ContentPackageStatusBlockedError);
    await expect(
      updateContentPackageStatus("pkg_2", { status: PackageStatus.compliance_checked }),
    ).resolves.toEqual({ id: "pkg_2", status: PackageStatus.compliance_checked });
    expect(runComplianceCheck).not.toHaveBeenCalled();
    await expect(
      updateContentPackageStatus("pkg_3", { status: PackageStatus.compliance_checked }),
    ).resolves.toEqual({ id: "pkg_3", status: PackageStatus.owner_approval_required });

    expect(runComplianceCheck).toHaveBeenCalledTimes(1);
    expect(runComplianceCheck).toHaveBeenCalledWith({ content_package_id: "pkg_3" });
    expect(transitionContentPackageStatus).not.toHaveBeenCalled();
  });
});
describe("export owner-approval gate", () => {
  it("blocks export before owner approval even when compliance allows export", async () => {
    const createManyAndReturn = vi.fn();
    vi.doMock("@/lib/db", () => ({
      prisma: {
        contentPackage: {
          findUnique: vi.fn(async () => ({
            id: "pkg_1",
            status: PackageStatus.owner_approval_required,
            progress: 0.75,
            drafts: [
              {
                id: "draft_1",
                bodyMarkdown: "# Ready package",
                updatedAt: new Date("2026-07-06T00:00:00.000Z"),
              },
            ],
            complianceChecks: [
              {
                id: "check_1",
                draftId: "draft_1",
                exportAllowed: true,
                checkedAt: new Date("2026-07-07T00:00:00.000Z"),
                complianceIssues: [],
              },
            ],
          })),
        },
        export: { createManyAndReturn },
      },
    }));
    vi.doMock("@/lib/logging/costLogger", () => ({ recordCostLog: vi.fn() }));

    const { exportContentPackage } = await import("@/lib/export/service");

    await expect(exportContentPackage("pkg_1")).resolves.toEqual({
      kind: "blocked",
      reason: "Owner approval is required before export.",
    });
    expect(createManyAndReturn).not.toHaveBeenCalled();
  });
});

describe("retention cleanup contract", () => {
  it("includes raw item expiry and fail-closed agent run predicates in dry-run results", async () => {
    const count = vi.fn(async () => 2);
    const deleteMany = vi.fn(async () => ({ count: 0 }));
    vi.doMock("@/lib/db", () => ({
      prisma: {
        export: { count, deleteMany },
        errorLog: { count, deleteMany },
        costLog: { count, deleteMany },
        rawItem: { count, deleteMany },
        agentRun: { count, deleteMany },
      },
    }));
    const { cleanupRetentionArtifacts } = await import("@/lib/retention/service");
    const now = new Date("2026-07-06T00:00:00.000Z");

    const result = await cleanupRetentionArtifacts({ mode: "dry-run", now });

    expect(result.cutoffs.raw_items).toBe(now);
    expect(result.cutoffs.agent_runs.toISOString()).toBe("2026-06-06T00:00:00.000Z");
    expect(result.cutoffs.triggered_agent_runs.toISOString()).toBe("2026-04-07T00:00:00.000Z");
    expect(result.matched).toEqual({
      exports: 2,
      resolved_errors: 2,
      cost_logs: 2,
      raw_items: 2,
      agent_runs: 2,
    });
    expect(result.deleted).toEqual({
      exports: 0,
      resolved_errors: 0,
      cost_logs: 0,
      raw_items: 0,
      agent_runs: 0,
    });
    expect(result.skipped).toEqual({
      exports: 0,
      resolved_errors: 0,
      cost_logs: 0,
      raw_items: 0,
      agent_runs: 2,
    });
    expect(count).toHaveBeenCalledWith({ where: { expiresAt: { lt: now } } });
    expect(count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        createdAt: { lt: result.cutoffs.agent_runs },
        status: { in: ["completed", "failed", "blocked"] },
        NOT: {
          triggerExecutionId: { not: null },
          createdAt: { gte: result.cutoffs.triggered_agent_runs },
        },
      }),
    });
    expect(count).toHaveBeenCalledWith({
      where: {
        OR: [
          { createdAt: { lt: result.cutoffs.agent_runs }, status: "running" },
          {
            AND: [
              { createdAt: { lt: result.cutoffs.agent_runs } },
              { createdAt: { gte: result.cutoffs.triggered_agent_runs } },
              { status: { in: ["completed", "failed", "blocked"] } },
              { triggerExecutionId: { not: null } },
            ],
          },
        ],
      },
    });
    expect(deleteMany).not.toHaveBeenCalled();
  });
});
