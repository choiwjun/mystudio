import { prisma } from "@/lib/db";

const dayMs = 24 * 60 * 60 * 1000;

export type RetentionCleanupMode = "dry-run" | "execute";

export type RetentionCleanupInput = {
  readonly mode: RetentionCleanupMode;
  readonly now?: Date;
  readonly exportDays?: number;
  readonly resolvedErrorDays?: number;
  readonly costLogDays?: number;
  readonly agentRunDays?: number;
  readonly triggeredAgentRunDays?: number;
};

export type RetentionCleanupResult = {
  readonly mode: RetentionCleanupMode;
  readonly cutoffs: {
    readonly exports: Date;
    readonly resolved_errors: Date;
    readonly cost_logs: Date;
    readonly raw_items: Date;
    readonly agent_runs: Date;
    readonly triggered_agent_runs: Date;
  };
  readonly matched: RetentionArtifactCounts;
  readonly deleted: RetentionArtifactCounts;
  readonly skipped: RetentionArtifactCounts;
};

type RetentionArtifactCounts = {
  readonly exports: number;
  readonly resolved_errors: number;
  readonly cost_logs: number;
  readonly raw_items: number;
  readonly agent_runs: number;
};

function cutoff(now: Date, days: number): Date {
  return new Date(now.getTime() - days * dayMs);
}

function assertRetentionDayWindow(name: string, days: number | undefined): void {
  if (days === undefined) {
    return;
  }
  if (!Number.isInteger(days) || days <= 0) {
    throw new Error(`${name} must be a positive integer day window.`);
  }
}

function validateRetentionCleanupInput(input: RetentionCleanupInput): void {
  if ((input.mode as string) !== "dry-run" && (input.mode as string) !== "execute") {
    throw new Error("Unsupported retention cleanup mode.");
  }
  assertRetentionDayWindow("exportDays", input.exportDays);
  assertRetentionDayWindow("resolvedErrorDays", input.resolvedErrorDays);
  assertRetentionDayWindow("costLogDays", input.costLogDays);
  assertRetentionDayWindow("agentRunDays", input.agentRunDays);
  assertRetentionDayWindow("triggeredAgentRunDays", input.triggeredAgentRunDays);
}

export function buildRetentionCleanupPlan(input: RetentionCleanupInput): RetentionCleanupResult {
  validateRetentionCleanupInput(input);
  const now = input.now ?? new Date();
  return {
    mode: input.mode,
    cutoffs: {
      exports: cutoff(now, input.exportDays ?? 90),
      resolved_errors: cutoff(now, input.resolvedErrorDays ?? 30),
      cost_logs: cutoff(now, input.costLogDays ?? 180),
      raw_items: now,
      agent_runs: cutoff(now, input.agentRunDays ?? 30),
      triggered_agent_runs: cutoff(now, input.triggeredAgentRunDays ?? 90),
    },
    matched: { exports: 0, resolved_errors: 0, cost_logs: 0, raw_items: 0, agent_runs: 0 },
    deleted: { exports: 0, resolved_errors: 0, cost_logs: 0, raw_items: 0, agent_runs: 0 },
    skipped: { exports: 0, resolved_errors: 0, cost_logs: 0, raw_items: 0, agent_runs: 0 },
  };
}

export async function cleanupRetentionArtifacts(
  input: RetentionCleanupInput,
): Promise<RetentionCleanupResult> {
  const plan = buildRetentionCleanupPlan(input);
  const exportWhere = { createdAt: { lt: plan.cutoffs.exports } };
  const resolvedErrorWhere = {
    createdAt: { lt: plan.cutoffs.resolved_errors },
    resolvedAt: { not: null },
  };
  const costLogWhere = { createdAt: { lt: plan.cutoffs.cost_logs } };
  const rawItemWhere = { expiresAt: { lt: plan.cutoffs.raw_items } };
  const deletableAgentRunStatuses = ["completed", "failed", "blocked"];
  const agentRunDeleteWhere = {
    createdAt: { lt: plan.cutoffs.agent_runs },
    status: { in: deletableAgentRunStatuses },
    NOT: {
      triggerExecutionId: { not: null },
      createdAt: { gte: plan.cutoffs.triggered_agent_runs },
    },
  };
  const agentRunSkippedWhere = {
    OR: [
      {
        createdAt: { lt: plan.cutoffs.agent_runs },
        status: "running",
      },
      {
        AND: [
          { createdAt: { lt: plan.cutoffs.agent_runs } },
          { createdAt: { gte: plan.cutoffs.triggered_agent_runs } },
          { status: { in: deletableAgentRunStatuses } },
          { triggerExecutionId: { not: null } },
        ],
      },
    ],
  };

  const [exports, resolvedErrors, costLogs, rawItems, agentRuns, skippedAgentRuns] =
    await Promise.all([
      prisma.export.count({ where: exportWhere }),
      prisma.errorLog.count({ where: resolvedErrorWhere }),
      prisma.costLog.count({ where: costLogWhere }),
      prisma.rawItem.count({ where: rawItemWhere }),
      prisma.agentRun.count({ where: agentRunDeleteWhere }),
      prisma.agentRun.count({ where: agentRunSkippedWhere }),
    ]);

  if (input.mode === "dry-run") {
    return {
      ...plan,
      matched: {
        exports,
        resolved_errors: resolvedErrors,
        cost_logs: costLogs,
        raw_items: rawItems,
        agent_runs: agentRuns,
      },
      skipped: { ...plan.skipped, agent_runs: skippedAgentRuns },
    };
  }

  if (input.mode !== "execute") {
    throw new Error("Unsupported retention cleanup mode.");
  }

  const [
    deletedExports,
    deletedResolvedErrors,
    deletedCostLogs,
    deletedRawItems,
    deletedAgentRuns,
  ] = await Promise.all([
    prisma.export.deleteMany({ where: exportWhere }),
    prisma.errorLog.deleteMany({ where: resolvedErrorWhere }),
    prisma.costLog.deleteMany({ where: costLogWhere }),
    prisma.rawItem.deleteMany({ where: rawItemWhere }),
    prisma.agentRun.deleteMany({ where: agentRunDeleteWhere }),
  ]);

  return {
    ...plan,
    matched: {
      exports,
      resolved_errors: resolvedErrors,
      cost_logs: costLogs,
      raw_items: rawItems,
      agent_runs: agentRuns,
    },
    deleted: {
      exports: deletedExports.count,
      resolved_errors: deletedResolvedErrors.count,
      cost_logs: deletedCostLogs.count,
      raw_items: deletedRawItems.count,
      agent_runs: deletedAgentRuns.count,
    },
    skipped: { ...plan.skipped, agent_runs: skippedAgentRuns },
  };
}
