import { type AgentRun, type KeywordCluster, type OpportunityMemo, Prisma } from "@prisma/client";
import type { HermesMemoryContext, HermesMemoryPattern } from "@/lib/ai/adapter";
import { createRuntimeAIAdapterFromConfiguredCredentials } from "@/lib/ai/runtime";
import {
  assertCompanyProfileReady,
  getOrCreateCompanyProfile,
} from "@/lib/company-profile/service";
import { prisma } from "@/lib/db";
import type { RawItemInput } from "@/lib/hermes/rawItems";
import { collectHermesRawItems } from "@/lib/hermes/searchProvider";
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
  readonly homefeed_reasons: string | null;
  readonly search_reasons: string | null;
  readonly revenue_reasons: string | null;
  readonly risk_reasons: string | null;
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
    risk_reasons: memo.scoreReasons,
    homefeed_reasons: memo.homefeedReasons,
    search_reasons: memo.searchReasons,
    revenue_reasons: memo.revenueReasons,
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
  if (Array.isArray(outputJson)) {
    return outputJson.filter((value): value is string => typeof value === "string");
  }
  if (
    outputJson !== null &&
    typeof outputJson === "object" &&
    !Array.isArray(outputJson) &&
    "memo_ids" in outputJson
  ) {
    const memoIds = (outputJson as { readonly memo_ids?: unknown }).memo_ids;
    return Array.isArray(memoIds)
      ? memoIds.filter((value): value is string => typeof value === "string")
      : [];
  }
  return [];
}

function isUniqueConstraintViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export class HermesScanAlreadyStartedError extends Error {
  readonly code = "HERMES_SCAN_ALREADY_STARTED";

  constructor(triggerExecutionId: string) {
    super(
      `Hermes scan ${triggerExecutionId} has already started and has not completed successfully.`,
    );
    this.name = "HermesScanAlreadyStartedError";
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown Hermes scan failure.";
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
type RawCollectionContext = {
  readonly query: string;
  readonly fallback: boolean;
  readonly fallback_source: string;
  readonly fallback_reason_code?: string;
  readonly fallback_reason?: string;
};

function rawCollectionContextToJson(context: RawCollectionContext): Prisma.InputJsonObject {
  return {
    query: context.query,
    fallback: context.fallback,
    fallback_source: context.fallback_source,
    ...(context.fallback_reason_code === undefined
      ? {}
      : { fallback_reason_code: context.fallback_reason_code }),
    ...(context.fallback_reason === undefined ? {} : { fallback_reason: context.fallback_reason }),
  };
}

function extractRawCollectionContext(
  query: string,
  rawItems: readonly RawItemInput[],
): RawCollectionContext {
  const fallbackItem = rawItems.find((item) => {
    const metadata = item.metadata;
    return (
      metadata !== null &&
      typeof metadata === "object" &&
      !Array.isArray(metadata) &&
      "fallback" in metadata &&
      metadata["fallback"] === true
    );
  });
  if (fallbackItem === undefined) {
    return { query, fallback: false, fallback_source: "naver_api" };
  }
  const metadata = fallbackItem.metadata as {
    readonly source?: unknown;
    readonly fallback_reason_code?: unknown;
    readonly fallback_reason?: unknown;
  };
  return {
    query,
    fallback: true,
    fallback_source: typeof metadata.source === "string" ? metadata.source : "fallback_context",
    ...(typeof metadata.fallback_reason_code === "string"
      ? { fallback_reason_code: metadata.fallback_reason_code }
      : {}),
    ...(typeof metadata.fallback_reason === "string"
      ? { fallback_reason: metadata.fallback_reason }
      : {}),
  };
}

function buildHermesRunOutputJson(
  memoIds: readonly string[],
  rawCollectionContexts: readonly RawCollectionContext[],
): Prisma.InputJsonObject {
  return {
    memo_ids: [...memoIds],
    raw_collection_context: rawCollectionContexts.map(rawCollectionContextToJson),
  };
}

function kstDayBounds(now = new Date()): { readonly start: Date; readonly end: Date } {
  const kstDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const start = new Date(`${kstDate}T00:00:00+09:00`);
  return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
}

function expandedHermesQueries(categories: readonly string[], targetCount: number): string[] {
  const normalizedCategories = categories
    .map((category) => category.replace(/\s+/g, " ").trim())
    .filter((category) => category.length > 0);
  const queries: string[] = [];

  for (const category of normalizedCategories) {
    if (!queries.includes(category)) {
      queries.push(category);
    }
  }

  const suffixes = ["추천", "비교", "트렌드", "문제 해결", "구매 가이드"];
  for (const category of normalizedCategories) {
    for (const suffix of suffixes) {
      const query = `${category} ${suffix}`;
      if (!queries.includes(query)) {
        queries.push(query);
      }
      if (queries.length >= targetCount) {
        return queries.slice(0, targetCount);
      }
    }
  }

  return queries.slice(0, targetCount);
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

async function markHermesRunFailed(run: AgentRun | null, error: unknown): Promise<void> {
  if (run === null) {
    return;
  }

  await prisma.agentRun.update({
    where: { id: run.id },
    data: {
      status: "failed",
      errorMessage: errorMessage(error),
    },
  });
}

async function markHermesRunBlocked(
  run: AgentRun | null,
  message: string,
  outputJson?: Prisma.InputJsonValue,
): Promise<void> {
  if (run === null) {
    return;
  }

  await prisma.agentRun.update({
    where: { id: run.id },
    data: {
      status: "blocked",
      errorMessage: message,
      ...(outputJson === undefined ? {} : { outputJson }),
    },
  });
}
type CompanyMemoryAggregationRecord = {
  readonly patternType: string;
  readonly category: string | null;
  readonly patternText: string;
  readonly tags: string[];
  readonly score: number;
  readonly sampleCount: number;
  readonly avgViews: number | null;
  readonly avgClicks: number | null;
  readonly avgRevenueUsd: number | null;
  readonly createdPatternIds: string[];
};

type AggregatedCompanyMemoryPattern = {
  readonly patternType: string;
  readonly patternText: string;
  readonly tags: string[];
  readonly sampleCount: number;
  readonly avgViews: number | null;
  readonly avgClicks: number | null;
  readonly avgRevenueUsd: number | null;
  readonly createdPatternIds: string[];
};

type WeightedCompanyMemoryPattern = {
  readonly weightedScore: number;
  readonly pattern: AggregatedCompanyMemoryPattern;
};

function companyMemoryGroupKey(record: CompanyMemoryAggregationRecord): string {
  return JSON.stringify([record.patternType, record.patternText, record.category]);
}

function weightedMemoryAverage(
  records: readonly CompanyMemoryAggregationRecord[],
  selectValue: (record: CompanyMemoryAggregationRecord) => number | null,
): number | null {
  let weightedTotal = 0;
  let weightTotal = 0;

  for (const record of records) {
    const value = selectValue(record);
    if (value === null || record.sampleCount <= 0) {
      continue;
    }
    weightedTotal += value * record.sampleCount;
    weightTotal += record.sampleCount;
  }

  return weightTotal === 0 ? null : weightedTotal / weightTotal;
}

async function loadAggregatedCompanyMemoryPatterns() {
  const records = await prisma.companyMemory.findMany();
  const groups = new Map<string, CompanyMemoryAggregationRecord[]>();

  for (const record of records) {
    const key = companyMemoryGroupKey(record);
    groups.set(key, [...(groups.get(key) ?? []), record]);
  }

  return [...groups.values()]
    .map((groupRecords) => {
      const firstRecord = groupRecords[0];
      if (firstRecord === undefined) {
        return null;
      }
      const weightedScore = weightedMemoryAverage(groupRecords, (record) => record.score) ?? 0;
      return {
        weightedScore,
        pattern: {
          patternType: firstRecord.patternType,
          patternText: firstRecord.patternText,
          tags: [...new Set(groupRecords.flatMap((record) => record.tags))],
          sampleCount: groupRecords.reduce((total, record) => total + record.sampleCount, 0),
          avgViews: weightedMemoryAverage(groupRecords, (record) => record.avgViews),
          avgClicks: weightedMemoryAverage(groupRecords, (record) => record.avgClicks),
          avgRevenueUsd: weightedMemoryAverage(groupRecords, (record) => record.avgRevenueUsd),
          createdPatternIds: [
            ...new Set(groupRecords.flatMap((record) => record.createdPatternIds)),
          ],
        },
      };
    })
    .filter((entry): entry is WeightedCompanyMemoryPattern => entry !== null)
    .sort((left, right) => right.weightedScore - left.weightedScore)
    .map((entry) => entry.pattern);
}

async function markCompanyMemoryUsed(memoryContext: HermesMemoryContext): Promise<void> {
  if (memoryContext.patterns.length === 0) {
    return;
  }

  await prisma.companyMemory.updateMany({
    where: {
      OR: memoryContext.patterns.map((pattern) => ({
        patternType: pattern.pattern_type,
        patternText: pattern.pattern_text,
      })),
    },
    data: { usedInRecommendations: { increment: 1 } },
  });
}

export async function scanHermes(triggerExecutionId: string | null): Promise<HermesScanResult> {
  const idempotencyKey = triggerExecutionId?.trim();
  const memoryPatterns = await loadAggregatedCompanyMemoryPatterns();
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

      throw new HermesScanAlreadyStartedError(idempotencyKey);
    }
  }

  try {
    await assertCompanyProfileReady();
    const profile = await getOrCreateCompanyProfile();
    const { start: kstTodayStart, end: kstTomorrowStart } = kstDayBounds();
    const existingCount = await prisma.opportunityMemo.count({
      where: {
        createdAt: {
          gte: kstTodayStart,
          lt: kstTomorrowStart,
        },
      },
    });
    const remainingTodayCount = Math.max(0, 5 - existingCount);
    const targetCreateCount = Math.min(5, Math.max(0, remainingTodayCount));
    const minimumCandidateCount = Math.min(3, targetCreateCount);
    const baseCategories = filterBlockedCategories(
      profile.primaryCategories,
      profile.blockedCategories,
    );
    const categories = expandedHermesQueries(
      baseCategories,
      Math.max(minimumCandidateCount, targetCreateCount),
    );
    const adapter = await createRuntimeAIAdapterFromConfiguredCredentials();
    const createdIds: string[] = [];
    let budgetBlockedAfterPartial = false;
    const rawCollectionContexts: RawCollectionContext[] = [];

    for (const category of categories) {
      const budget = await assertAiBudgetAllows({
        pipelineStep: "hermes",
        task: "generateOpportunityMemo",
        estimatedCostUsd: AI_GENERATION_COST_USD.hermesOpportunityMemo,
      });
      if (budget.kind === "blocked") {
        if (createdIds.length === 0) {
          await markHermesRunBlocked(
            hermesRunLock,
            budget.error.message,
            budget.error as unknown as Prisma.InputJsonValue,
          );
          return { kind: "blocked_by_budget", error: budget.error };
        }
        budgetBlockedAfterPartial = true;
        break;
      }

      const rawItems = await collectHermesRawItems(category);
      const rawCollectionContext = extractRawCollectionContext(category, rawItems);
      rawCollectionContexts.push(rawCollectionContext);
      if (hermesRunLock !== null) {
        await prisma.agentRun.update({
          where: { id: hermesRunLock.id },
          data: {
            inputJson: {
              ...buildHermesRunInputJson(idempotencyKey ?? "", memoryContext),
              raw_collection_context: rawCollectionContexts.map(rawCollectionContextToJson),
            },
          },
        });
      }
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

    if (createdIds.length > 0) {
      await markCompanyMemoryUsed(memoryContext);
    }

    if (hermesRunLock !== null) {
      await prisma.agentRun.update({
        where: { id: hermesRunLock.id },
        data: {
          status: "completed",
          outputJson: buildHermesRunOutputJson(createdIds, rawCollectionContexts),
        },
      });
    }

    return {
      kind: "completed",
      opportunityMemos: await findLatestOpportunityMemos(),
      budgetBlockedAfterPartial,
    };
  } catch (error) {
    await markHermesRunFailed(hermesRunLock, error);
    throw error;
  }
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
