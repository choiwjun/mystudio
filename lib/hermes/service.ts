import { type AgentRun, type KeywordCluster, type OpportunityMemo, Prisma } from "@prisma/client";
import type { HermesMemoryContext, HermesMemoryPattern } from "@/lib/ai/adapter";
import { MockAIAdapter } from "@/lib/ai/mockAdapter";
import {
  assertCompanyProfileReady,
  getOrCreateCompanyProfile,
} from "@/lib/company-profile/service";
import { prisma } from "@/lib/db";
import { collectHermesRawItems } from "@/lib/hermes/rawItems";
import { AI_GENERATION_COST_USD, assertAiBudgetAllows } from "@/lib/logging/costBudget";
import { recordCostLog } from "@/lib/logging/costLogger";
import { buildHermesMemoryContext } from "@/lib/memory/patterns";

export { buildRawItemInputs } from "@/lib/hermes/rawItems";

export type SerializedKeywordCluster = {
  readonly id: string;
  readonly opportunity_memo_id: string;
  readonly primary_keyword: string;
  readonly related_keywords: readonly string[];
  readonly search_volume: number | null;
  readonly competition_score: number | null;
};

export type SerializedOpportunityMemo = {
  readonly id: string;
  readonly topic: string;
  readonly why_now: string;
  readonly homefeed_angle: string;
  readonly search_angle: string;
  readonly interest_tags: readonly string[];
  readonly homefeed_score: number;
  readonly search_score: number;
  readonly revenue_score: number;
  readonly risk_score: number;
  readonly score_reasons: string | null;
  readonly status: string;
  readonly created_at: string;
  readonly keyword_clusters?: readonly SerializedKeywordCluster[];
};

export type HermesScanResult =
  | {
      readonly kind: "completed";
      readonly opportunityMemos: readonly SerializedOpportunityMemo[];
      readonly budgetBlockedAfterPartial: boolean;
    }
  | {
      readonly kind: "blocked_by_budget";
      readonly error: {
        readonly code: "COST_LIMIT_EXCEEDED";
        readonly message: "오늘의 생성 한도를 모두 사용했습니다. 내일 다시 시도하세요.";
      };
    };

export function serializeKeywordCluster(cluster: KeywordCluster): SerializedKeywordCluster {
  return {
    id: cluster.id,
    opportunity_memo_id: cluster.opportunityMemoId,
    primary_keyword: cluster.primaryKeyword,
    related_keywords: cluster.relatedKeywords,
    search_volume: cluster.searchVolume,
    competition_score: cluster.competitionScore,
  };
}

export function serializeOpportunityMemo(
  memo: OpportunityMemo & { keywordClusters?: KeywordCluster[] },
): SerializedOpportunityMemo {
  return {
    id: memo.id,
    topic: memo.topic,
    why_now: memo.whyNow,
    homefeed_angle: memo.homefeedAngle,
    search_angle: memo.searchAngle,
    interest_tags: memo.interestTags,
    homefeed_score: memo.homefeedScore,
    search_score: memo.searchScore,
    revenue_score: memo.revenueScore,
    risk_score: memo.riskScore,
    score_reasons: memo.scoreReasons,
    status: memo.status,
    created_at: memo.createdAt.toISOString(),
    ...(memo.keywordClusters === undefined
      ? {}
      : { keyword_clusters: memo.keywordClusters.map(serializeKeywordCluster) }),
  };
}

export function buildKeywordClusters(
  topic: string,
): readonly Omit<SerializedKeywordCluster, "id" | "opportunity_memo_id">[] {
  const base = topic.replace(/\s+/g, " ").trim();
  return Array.from({ length: 5 }, (_, index) => ({
    primary_keyword: `${base} ${index + 1}`,
    related_keywords: [`${base} 추천`, `${base} 가격`, `${base} 후기`],
    search_volume: 1200 - index * 120,
    competition_score: 35 + index * 7,
  }));
}

export function filterBlockedCategories(
  categories: readonly string[],
  blockedCategories: readonly string[],
): string[] {
  const blocked = new Set(blockedCategories.map((category) => category.trim().toLowerCase()));
  return categories.filter((category) => !blocked.has(category.trim().toLowerCase()));
}

function buildHermesScanTaskType(idempotencyKey: string): string {
  return `scan:${idempotencyKey}`;
}

function extractMemoIds(outputJson: unknown): string[] {
  return Array.isArray(outputJson)
    ? outputJson.filter((value): value is string => typeof value === "string")
    : [];
}

function isUniqueConstraintViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function hermesMemoryPatternToJson(pattern: HermesMemoryPattern): Prisma.InputJsonObject {
  return {
    pattern_type: pattern.pattern_type,
    pattern_text: pattern.pattern_text,
    tags: [...pattern.tags],
    sample_count: pattern.sample_count,
    avg_views: pattern.avg_views,
    avg_clicks: pattern.avg_clicks,
    avg_revenue_usd: pattern.avg_revenue_usd,
    created_pattern_ids: [...pattern.created_pattern_ids],
  };
}

function hermesMemoryContextToJson(memoryContext: HermesMemoryContext): Prisma.InputJsonObject {
  return {
    status: memoryContext.status,
    minimum_sample_count: memoryContext.minimum_sample_count,
    learning_pattern_count: memoryContext.learning_pattern_count,
    patterns: memoryContext.patterns.map(hermesMemoryPatternToJson),
  };
}

function buildHermesRunInputJson(
  idempotencyKey: string,
  memoryContext: HermesMemoryContext,
): Prisma.InputJsonObject {
  return {
    triggerExecutionId: idempotencyKey,
    memoryContext: hermesMemoryContextToJson(memoryContext),
  };
}

async function findCompletedIdempotentHermesRun(idempotencyKey: string): Promise<AgentRun | null> {
  return prisma.agentRun.findFirst({
    where: {
      agentName: "Hermes",
      triggerExecutionId: idempotencyKey,
      status: "completed",
    },
    orderBy: { createdAt: "desc" },
  });
}

async function findLatestOpportunityMemos(): Promise<SerializedOpportunityMemo[]> {
  const memos = await prisma.opportunityMemo.findMany({
    include: { keywordClusters: true },
    orderBy: { createdAt: "desc" },
    take: 5,
  });
  return memos.map(serializeOpportunityMemo);
}

async function findOpportunityMemosByIds(
  memoIds: readonly string[],
): Promise<SerializedOpportunityMemo[]> {
  const memos = await prisma.opportunityMemo.findMany({
    where: { id: { in: [...memoIds] } },
    include: { keywordClusters: true },
    orderBy: { createdAt: "desc" },
  });
  return memos.map(serializeOpportunityMemo);
}

async function returnCompletedIdempotentHermesRun(run: AgentRun): Promise<HermesScanResult> {
  const memoIds = extractMemoIds(run.outputJson);

  return {
    kind: "completed",
    opportunityMemos: await findOpportunityMemosByIds(memoIds),
    budgetBlockedAfterPartial: false,
  };
}

async function createHermesRunLock(
  idempotencyKey: string,
  memoryContext: HermesMemoryContext,
): Promise<AgentRun | null> {
  try {
    return await prisma.agentRun.create({
      data: {
        agentName: "Hermes",
        taskType: buildHermesScanTaskType(idempotencyKey),
        triggerExecutionId: idempotencyKey,
        status: "running",
        inputJson: buildHermesRunInputJson(idempotencyKey, memoryContext),
      },
    });
  } catch (error: unknown) {
    if (!isUniqueConstraintViolation(error)) {
      throw error;
    }

    return null;
  }
}

export async function scanHermes(triggerExecutionId: string | null): Promise<HermesScanResult> {
  const idempotencyKey = triggerExecutionId?.trim();
  const memoryPatterns = await prisma.companyMemory.findMany({
    orderBy: [{ score: "desc" }, { updatedAt: "desc" }],
    take: 20,
  });
  const memoryContext = buildHermesMemoryContext(memoryPatterns);
  let hermesRunLock: AgentRun | null = null;

  if (idempotencyKey !== undefined && idempotencyKey !== "") {
    const previousResult = await findCompletedIdempotentHermesRun(idempotencyKey).then((run) =>
      run === null ? null : returnCompletedIdempotentHermesRun(run),
    );
    if (previousResult !== null) {
      return previousResult;
    }

    hermesRunLock = await createHermesRunLock(idempotencyKey, memoryContext);
    if (hermesRunLock === null) {
      const completedRun = await findCompletedIdempotentHermesRun(idempotencyKey);
      if (completedRun !== null) {
        return await returnCompletedIdempotentHermesRun(completedRun);
      }

      return {
        kind: "completed",
        opportunityMemos: await findLatestOpportunityMemos(),
        budgetBlockedAfterPartial: false,
      };
    }
  }

  await assertCompanyProfileReady();
  const profile = await getOrCreateCompanyProfile();
  const existingCount = await prisma.opportunityMemo.count({
    where: {
      createdAt: {
        gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
      },
    },
  });
  const createCount = Math.max(0, Math.min(5 - existingCount, 5));
  const categories = filterBlockedCategories(
    profile.primaryCategories,
    profile.blockedCategories,
  ).slice(0, createCount);
  const adapter = new MockAIAdapter();
  const createdIds: string[] = [];
  let budgetBlockedAfterPartial = false;

  for (const category of categories) {
    const budget = await assertAiBudgetAllows({
      pipelineStep: "hermes",
      task: "generateOpportunityMemo",
      estimatedCostUsd: AI_GENERATION_COST_USD.hermesOpportunityMemo,
    });
    if (budget.kind === "blocked") {
      if (createdIds.length === 0) {
        return { kind: "blocked_by_budget", error: budget.error };
      }
      budgetBlockedAfterPartial = true;
      break;
    }

    const rawItems = await collectHermesRawItems(category);
    const output = await adapter.generateOpportunityMemo({
      categories: [category],
      rawItems,
      memoryContext,
    });
    const memo = await prisma.opportunityMemo.create({
      data: {
        topic: output.topic,
        whyNow: output.why_now,
        homefeedAngle: output.homefeed_angle,
        searchAngle: output.search_angle,
        interestTags: output.interest_tags,
        homefeedScore: output.homefeed_score,
        homefeedReasons: output.homefeed_reasons,
        searchScore: output.search_score,
        searchReasons: output.search_reasons,
        revenueScore: output.revenue_score,
        revenueReasons: output.revenue_reasons,
        riskScore: output.risk_score,
        scoreReasons: output.score_reasons,
        recommendedPackages: ["blog"],
        keywordClusters: {
          create: buildKeywordClusters(output.topic).map((cluster) => ({
            primaryKeyword: cluster.primary_keyword,
            relatedKeywords: [...cluster.related_keywords],
            searchVolume: cluster.search_volume,
            competitionScore: cluster.competition_score,
          })),
        },
      },
    });
    await recordCostLog({
      model: "mock",
      task: "generateOpportunityMemo",
      pipelineStep: "hermes",
      inputTokens: 700,
      outputTokens: 500,
      costUsd: AI_GENERATION_COST_USD.hermesOpportunityMemo,
      blockedByCap: false,
    });
    createdIds.push(memo.id);
  }

  if (hermesRunLock !== null) {
    await prisma.agentRun.update({
      where: { id: hermesRunLock.id },
      data: {
        status: "completed",
        outputJson: createdIds,
      },
    });
  }

  return {
    kind: "completed",
    opportunityMemos: await findLatestOpportunityMemos(),
    budgetBlockedAfterPartial,
  };
}

export async function listOpportunityMemos(): Promise<SerializedOpportunityMemo[]> {
  const memos = await prisma.opportunityMemo.findMany({
    include: { keywordClusters: true },
    orderBy: { createdAt: "desc" },
    take: 5,
  });
  return memos.map(serializeOpportunityMemo);
}

export async function getOpportunityMemo(id: string): Promise<SerializedOpportunityMemo | null> {
  const memo = await prisma.opportunityMemo.findUnique({
    where: { id },
    include: { keywordClusters: true },
  });
  return memo === null ? null : serializeOpportunityMemo(memo);
}
