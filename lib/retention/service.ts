import { prisma } from "@/lib/db";

const dayMs = 24 * 60 * 60 * 1000;

export type RetentionCleanupMode = "dry-run" | "execute";

export type RetentionCleanupInput = {
  readonly mode: RetentionCleanupMode;
  readonly now?: Date;
  readonly exportDays?: number;
  readonly resolvedErrorDays?: number;
  readonly costLogDays?: number;
};

export type RetentionCleanupResult = {
  readonly mode: RetentionCleanupMode;
  readonly cutoffs: {
    readonly exports: Date;
    readonly resolved_errors: Date;
    readonly cost_logs: Date;
  };
  readonly matched: {
    readonly exports: number;
    readonly resolved_errors: number;
    readonly cost_logs: number;
  };
  readonly deleted: {
    readonly exports: number;
    readonly resolved_errors: number;
    readonly cost_logs: number;
  };
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
    },
    matched: { exports: 0, resolved_errors: 0, cost_logs: 0 },
    deleted: { exports: 0, resolved_errors: 0, cost_logs: 0 },
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

  const [exports, resolvedErrors, costLogs] = await Promise.all([
    prisma.export.count({ where: exportWhere }),
    prisma.errorLog.count({ where: resolvedErrorWhere }),
    prisma.costLog.count({ where: costLogWhere }),
  ]);

  if (input.mode === "dry-run") {
    return {
      ...plan,
      matched: { exports, resolved_errors: resolvedErrors, cost_logs: costLogs },
    };
  }

  if (input.mode !== "execute") {
    throw new Error("Unsupported retention cleanup mode.");
  }

  const [deletedExports, deletedResolvedErrors, deletedCostLogs] = await Promise.all([
    prisma.export.deleteMany({ where: exportWhere }),
    prisma.errorLog.deleteMany({ where: resolvedErrorWhere }),
    prisma.costLog.deleteMany({ where: costLogWhere }),
  ]);

  return {
    ...plan,
    matched: { exports, resolved_errors: resolvedErrors, cost_logs: costLogs },
    deleted: {
      exports: deletedExports.count,
      resolved_errors: deletedResolvedErrors.count,
      cost_logs: deletedCostLogs.count,
    },
  };
}
