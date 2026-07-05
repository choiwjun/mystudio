import { prisma } from "@/lib/db";
import { type PipelineStep, recordCostLog } from "@/lib/logging/costLogger";

export const DEFAULT_DAILY_AI_COST_CAP_USD = 5;
export const AI_BUDGET_SOFT_THRESHOLD_PERCENT = 70;

export const AI_GENERATION_COST_USD = {
  hermesOpportunityMemo: 0.02,
  contentBlogDraft: 0.08,
  searchStructure: 0.03,
} as const;

export type DailyAiBudgetInput = {
  readonly capUsd: number;
  readonly totalCostUsd: number;
  readonly nextCostUsd: number;
};

type DailyAiBudgetBase = {
  readonly capUsd: number;
  readonly totalCostUsd: number;
  readonly projectedCostUsd: number;
  readonly usageRate: number;
  readonly remainingUsd: number;
};

export type DailyAiBudgetStatus =
  | (DailyAiBudgetBase & { readonly kind: "within_budget" })
  | (DailyAiBudgetBase & { readonly kind: "soft_warning" })
  | (DailyAiBudgetBase & { readonly kind: "hard_blocked" });

export type AiBudgetGuardAllowed = {
  readonly kind: "allowed";
  readonly budget: DailyAiBudgetStatus;
};

export type AiBudgetGuardBlocked = {
  readonly kind: "blocked";
  readonly budget: DailyAiBudgetStatus & { readonly kind: "hard_blocked" };
  readonly error: {
    readonly code: "COST_LIMIT_EXCEEDED";
    readonly message: "오늘의 생성 한도를 모두 사용했습니다. 내일 다시 시도하세요.";
  };
};

export type AiBudgetGuardResult = AiBudgetGuardAllowed | AiBudgetGuardBlocked;

export type AiBudgetGuardInput = {
  readonly pipelineStep: PipelineStep;
  readonly task: string;
  readonly estimatedCostUsd: number;
};

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

function normalizeCurrency(value: number): number {
  if (!Number.isFinite(value) || value < 0) {
    return 0;
  }
  return roundCurrency(value);
}

export function parseDailyAiCostCap(value: string | undefined): number {
  if (value === undefined || value.trim() === "") {
    return DEFAULT_DAILY_AI_COST_CAP_USD;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_DAILY_AI_COST_CAP_USD;
  }

  return roundCurrency(parsed);
}

export function evaluateDailyAiBudget(input: DailyAiBudgetInput): DailyAiBudgetStatus {
  const capUsd = parseDailyAiCostCap(String(input.capUsd));
  const totalCostUsd = normalizeCurrency(input.totalCostUsd);
  const nextCostUsd = normalizeCurrency(input.nextCostUsd);
  const projectedCostUsd = roundCurrency(totalCostUsd + nextCostUsd);
  const remainingUsd = normalizeCurrency(capUsd - totalCostUsd);
  const usageRate = Math.round((projectedCostUsd / capUsd) * 100);

  if (projectedCostUsd > capUsd || totalCostUsd >= capUsd) {
    return {
      kind: "hard_blocked",
      capUsd,
      totalCostUsd,
      projectedCostUsd,
      usageRate,
      remainingUsd,
    };
  }

  if (usageRate >= AI_BUDGET_SOFT_THRESHOLD_PERCENT) {
    return {
      kind: "soft_warning",
      capUsd,
      totalCostUsd,
      projectedCostUsd,
      usageRate,
      remainingUsd,
    };
  }

  return {
    kind: "within_budget",
    capUsd,
    totalCostUsd,
    projectedCostUsd,
    usageRate,
    remainingUsd,
  };
}

function startOfToday(): Date {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

export async function getDailyAiBudgetStatus(nextCostUsd = 0): Promise<DailyAiBudgetStatus> {
  const cost = await prisma.costLog.aggregate({
    where: { createdAt: { gte: startOfToday() } },
    _sum: { costUsd: true },
  });

  return evaluateDailyAiBudget({
    capUsd: parseDailyAiCostCap(process.env["DAILY_AI_COST_CAP_USD"]),
    totalCostUsd: cost._sum.costUsd ?? 0,
    nextCostUsd,
  });
}

export async function assertAiBudgetAllows(
  input: AiBudgetGuardInput,
): Promise<AiBudgetGuardResult> {
  const budget = await getDailyAiBudgetStatus(input.estimatedCostUsd);

  if (budget.kind !== "hard_blocked") {
    return { kind: "allowed", budget };
  }

  await recordCostLog({
    model: "budget_guard",
    task: input.task,
    pipelineStep: input.pipelineStep,
    inputTokens: 0,
    outputTokens: 0,
    costUsd: 0,
    blockedByCap: true,
  });

  return {
    kind: "blocked",
    budget,
    error: {
      code: "COST_LIMIT_EXCEEDED",
      message: "오늘의 생성 한도를 모두 사용했습니다. 내일 다시 시도하세요.",
    },
  };
}
