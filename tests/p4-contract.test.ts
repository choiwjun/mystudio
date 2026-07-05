import { describe, expect, it } from "vitest";
import { MockAIAdapter } from "@/lib/ai/mockAdapter";
import { calculateHqStatus } from "@/lib/hq/status";
import { evaluateDailyAiBudget } from "@/lib/logging/costBudget";
import {
  buildCompanyMemoryEntriesForPerformance,
  buildHermesMemoryContext,
  summarizeHookTypeStats,
} from "@/lib/memory/patterns";
import {
  detectPlatformFromUrl,
  summarizePerformance,
  summarizeRevenue,
} from "@/lib/performance/metrics";

describe("P4 HQ status contract", () => {
  it("returns Warning when daily AI cost reaches the soft threshold", () => {
    expect(
      calculateHqStatus({
        pendingApprovals: 0,
        complianceFailures: 0,
        needsPerformanceLog: 0,
        monthRevenue: 500_000,
        revenueGoal: 500_000,
        aiBudget: {
          kind: "soft_warning",
          capUsd: 5,
          totalCostUsd: 3.6,
          projectedCostUsd: 3.6,
          usageRate: 72,
          remainingUsd: 1.4,
        },
      }),
    ).toEqual({
      status: "Warning",
      reason: "AI 생성 비용 72% 사용 중입니다.",
    });
  });

  it("returns Warning when compliance failures exist", () => {
    expect(
      calculateHqStatus({
        pendingApprovals: 0,
        complianceFailures: 1,
        needsPerformanceLog: 0,
        monthRevenue: 500_000,
        revenueGoal: 500_000,
      }),
    ).toMatchObject({ status: "Warning" });
  });

  it("returns Good when all tracked counts are clear and revenue is on track", () => {
    expect(
      calculateHqStatus({
        pendingApprovals: 0,
        complianceFailures: 0,
        needsPerformanceLog: 0,
        monthRevenue: 500_000,
        revenueGoal: 500_000,
      }),
    ).toMatchObject({ status: "Good" });
  });
});

describe("P4 AI budget contract", () => {
  it("returns soft warning at 70 percent of the daily cap while allowing generation", () => {
    const budget = evaluateDailyAiBudget({
      capUsd: 5,
      totalCostUsd: 3.5,
      nextCostUsd: 0,
    });

    expect(budget).toEqual({
      kind: "soft_warning",
      capUsd: 5,
      totalCostUsd: 3.5,
      projectedCostUsd: 3.5,
      usageRate: 70,
      remainingUsd: 1.5,
    });
  });

  it("returns hard blocked when the next generation would exceed the daily cap", () => {
    const budget = evaluateDailyAiBudget({
      capUsd: 5,
      totalCostUsd: 4.95,
      nextCostUsd: 0.1,
    });

    expect(budget).toEqual({
      kind: "hard_blocked",
      capUsd: 5,
      totalCostUsd: 4.95,
      projectedCostUsd: 5.05,
      usageRate: 101,
      remainingUsd: 0.05,
    });
  });
});

describe("P4 performance contract", () => {
  it("detects platform from URL", () => {
    expect(detectPlatformFromUrl("https://blog.naver.com/paperclip/1")).toBe("naver_blog");
    expect(detectPlatformFromUrl("https://example.com/post")).toBe("manual");
  });

  it("summarizes weekly averages and best hook type", () => {
    const summary = summarizePerformance([
      { views: 100, clicks: 10, direct_revenue: 1000, hook_type: "checklist" },
      { views: 300, clicks: 20, direct_revenue: 3000, hook_type: "checklist" },
      { views: 50, clicks: 5, direct_revenue: 0, hook_type: "problem_empathy" },
    ]);

    expect(summary).toEqual({
      average_views: 150,
      average_clicks: 12,
      average_revenue: 1333,
      best_hook_type: "checklist",
    });
  });

  it("summarizes monthly revenue and top content", () => {
    const summary = summarizeRevenue(
      [
        { content_title: "A", direct_revenue: 10_000, indirect_revenue: 5_000 },
        { content_title: "B", direct_revenue: 30_000, indirect_revenue: 0 },
      ],
      100_000,
    );

    expect(summary).toMatchObject({
      month_total: 45_000,
      direct_total: 40_000,
      indirect_total: 5_000,
      progress_rate: 45,
      top_content_title: "B",
      top_content_revenue: 30_000,
    });
  });
});

describe("P4 memory contract", () => {
  it("creates a failure memory entry for posts below 100 views", () => {
    const entries = buildCompanyMemoryEntriesForPerformance({
      performanceLogId: "perf_1",
      platform: "naver_blog",
      hookType: "checklist",
      views: 80,
      clicks: 2,
      directRevenue: 0,
    });

    expect(entries).toEqual([
      {
        patternType: "homefeed_hook",
        patternText: "checklist",
        resultSummary: "80 views / 2 clicks",
        tags: ["naver_blog", "success"],
        score: 80,
        sampleCount: 1,
        avgViews: 80,
        avgClicks: 2,
        avgRevenueUsd: 0,
        createdPatternIds: ["perf_1"],
      },
      {
        patternType: "homefeed_hook",
        patternText: "checklist",
        resultSummary: "Failure pattern: 80 views is below the 100 view threshold.",
        tags: ["naver_blog", "failure", "low_views"],
        score: -20,
        sampleCount: 1,
        avgViews: 80,
        avgClicks: 2,
        avgRevenueUsd: 0,
        createdPatternIds: ["perf_1"],
      },
    ]);
  });

  it("passes ready memory context into Hermes memo generation", async () => {
    const output = await new MockAIAdapter().generateOpportunityMemo({
      categories: ["자취"],
      rawItems: [],
      memoryContext: {
        status: "ready",
        minimum_sample_count: 5,
        learning_pattern_count: 0,
        patterns: [
          {
            pattern_type: "homefeed_hook",
            pattern_text: "문제 공감형 첫 화면",
            tags: ["naver_blog"],
            sample_count: 5,
            avg_views: 320,
            avg_clicks: 18,
            avg_revenue_usd: 12,
            created_pattern_ids: ["pkg_1"],
          },
        ],
      },
    });

    expect(output.why_now).toContain("문제 공감형 첫 화면");
  });

  it("builds Hermes memory context only from statistically ready patterns", () => {
    const context = buildHermesMemoryContext([
      {
        patternType: "homefeed_hook",
        patternText: "문제 공감형 첫 화면",
        tags: ["naver_blog"],
        sampleCount: 5,
        avgViews: 320,
        avgClicks: 18,
        avgRevenueUsd: 12,
        createdPatternIds: ["pkg_1", "pkg_2"],
      },
      {
        patternType: "homefeed_hook",
        patternText: "배우는 중인 훅",
        tags: ["naver_blog"],
        sampleCount: 4,
        avgViews: 999,
        avgClicks: 99,
        avgRevenueUsd: 99,
        createdPatternIds: ["pkg_learning"],
      },
    ]);

    expect(context).toEqual({
      status: "ready",
      minimum_sample_count: 5,
      learning_pattern_count: 1,
      patterns: [
        {
          pattern_type: "homefeed_hook",
          pattern_text: "문제 공감형 첫 화면",
          tags: ["naver_blog"],
          sample_count: 5,
          avg_views: 320,
          avg_clicks: 18,
          avg_revenue_usd: 12,
          created_pattern_ids: ["pkg_1", "pkg_2"],
        },
      ],
    });
  });

  it("ranks hook type stats by average views", () => {
    expect(
      summarizeHookTypeStats([
        { hook_type: "checklist", views: 100 },
        { hook_type: "checklist", views: 300 },
        { hook_type: "seasonal_timing", views: 500 },
        { hook_type: null, views: 999 },
      ]),
    ).toEqual([
      { hook_type: "seasonal_timing", average_views: 500, sample_count: 1 },
      { hook_type: "checklist", average_views: 200, sample_count: 2 },
    ]);
  });
});
