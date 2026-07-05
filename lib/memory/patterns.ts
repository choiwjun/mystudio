import type { HermesMemoryContext, HermesMemoryPattern } from "@/lib/ai/adapter";

export const COMPANY_MEMORY_MIN_SAMPLE_COUNT = 5;

export type HookPerformanceInput = {
  readonly hook_type: string | null;
  readonly views: number;
};

export type CompanyMemoryPatternInput = {
  readonly patternType: string;
  readonly patternText: string;
  readonly tags: readonly string[];
  readonly sampleCount: number;
  readonly avgViews: number | null;
  readonly avgClicks: number | null;
  readonly avgRevenueUsd: number | null;
  readonly createdPatternIds: readonly string[];
};

export type PerformanceMemoryInput = {
  readonly performanceLogId: string;
  readonly platform: string;
  readonly hookType: string | null;
  readonly views: number;
  readonly clicks: number;
  readonly directRevenue: number;
};

export type CompanyMemoryEntryInput = {
  readonly patternType: HermesMemoryPattern["pattern_type"];
  readonly patternText: string;
  readonly resultSummary: string;
  readonly tags: readonly string[];
  readonly score: number;
  readonly sampleCount: number;
  readonly avgViews: number;
  readonly avgClicks: number;
  readonly avgRevenueUsd: number;
  readonly createdPatternIds: readonly string[];
};

const LOW_VIEW_FAILURE_THRESHOLD = 100;

function patternTextFromPerformance(input: PerformanceMemoryInput): string | null {
  if (input.hookType !== null) {
    return input.hookType;
  }
  if (input.views < LOW_VIEW_FAILURE_THRESHOLD) {
    return "low_view_content";
  }
  return null;
}

function baseMemoryEntry(
  input: PerformanceMemoryInput,
): Omit<CompanyMemoryEntryInput, "resultSummary" | "tags" | "score"> | null {
  const patternText = patternTextFromPerformance(input);
  if (patternText === null) {
    return null;
  }

  return {
    patternType: "homefeed_hook",
    patternText,
    sampleCount: 1,
    avgViews: input.views,
    avgClicks: input.clicks,
    avgRevenueUsd: input.directRevenue,
    createdPatternIds: [input.performanceLogId],
  };
}

export function buildCompanyMemoryEntriesForPerformance(
  input: PerformanceMemoryInput,
): readonly CompanyMemoryEntryInput[] {
  const base = baseMemoryEntry(input);
  if (base === null) {
    return [];
  }

  const successEntry: CompanyMemoryEntryInput | null =
    input.hookType === null
      ? null
      : {
          ...base,
          resultSummary: `${input.views} views / ${input.clicks} clicks`,
          tags: [input.platform, "success"],
          score: input.views,
        };

  const failureEntry: CompanyMemoryEntryInput | null =
    input.views >= LOW_VIEW_FAILURE_THRESHOLD
      ? null
      : {
          ...base,
          resultSummary: `Failure pattern: ${input.views} views is below the 100 view threshold.`,
          tags: [input.platform, "failure", "low_views"],
          score: input.views - LOW_VIEW_FAILURE_THRESHOLD,
        };

  return [successEntry, failureEntry].filter(
    (entry): entry is CompanyMemoryEntryInput => entry !== null,
  );
}

function parsePatternType(value: string): HermesMemoryPattern["pattern_type"] | null {
  switch (value) {
    case "homefeed_hook":
    case "search_keyword":
    case "product_angle":
    case "pricing_strategy":
    case "seasonal_theme":
      return value;
    default:
      return null;
  }
}

export function buildHermesMemoryContext(
  patterns: readonly CompanyMemoryPatternInput[],
): HermesMemoryContext {
  const readyPatterns: HermesMemoryPattern[] = [];
  let learningPatternCount = 0;

  for (const pattern of patterns) {
    const patternType = parsePatternType(pattern.patternType);
    if (patternType === null || pattern.sampleCount < COMPANY_MEMORY_MIN_SAMPLE_COUNT) {
      learningPatternCount += 1;
      continue;
    }

    readyPatterns.push({
      pattern_type: patternType,
      pattern_text: pattern.patternText,
      tags: pattern.tags,
      sample_count: pattern.sampleCount,
      avg_views: pattern.avgViews,
      avg_clicks: pattern.avgClicks,
      avg_revenue_usd: pattern.avgRevenueUsd,
      created_pattern_ids: pattern.createdPatternIds,
    });
  }

  return {
    status: readyPatterns.length === 0 ? "learning" : "ready",
    minimum_sample_count: COMPANY_MEMORY_MIN_SAMPLE_COUNT,
    learning_pattern_count: learningPatternCount,
    patterns: readyPatterns,
  };
}

export function summarizeHookTypeStats(logs: readonly HookPerformanceInput[]): readonly {
  readonly hook_type: string;
  readonly average_views: number;
  readonly sample_count: number;
}[] {
  const grouped = new Map<string, { totalViews: number; count: number }>();
  for (const log of logs) {
    if (log.hook_type !== null) {
      const previous = grouped.get(log.hook_type) ?? { totalViews: 0, count: 0 };
      grouped.set(log.hook_type, {
        totalViews: previous.totalViews + log.views,
        count: previous.count + 1,
      });
    }
  }
  return [...grouped.entries()]
    .map(([hookType, stat]) => ({
      hook_type: hookType,
      average_views: Math.round(stat.totalViews / stat.count),
      sample_count: stat.count,
    }))
    .sort((left, right) => right.average_views - left.average_views);
}
