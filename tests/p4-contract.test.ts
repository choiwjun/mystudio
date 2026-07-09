import { readFileSync } from "node:fs";
import type { Product } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  formatHqStatusText,
  hqStatusRefreshEvent,
  hqStatusResponseSchema,
} from "@/components/hq/HqStatusBadge";
import { MockAIAdapter } from "@/lib/ai/mockAdapter";
import { ClaudeAIAdapter, OpenAIAdapter } from "@/lib/ai/providerAdapters";
import { AIAdapterConfigurationError, createRuntimeAIAdapter } from "@/lib/ai/runtime";
import { serializeActivePlacementProducts } from "@/lib/content/placement";
import { calculateHqStatus } from "@/lib/hq/status";
import { evaluateDailyAiBudget } from "@/lib/logging/costBudget";
import {
  buildCompanyMemoryEntriesForPerformance,
  buildHermesMemoryContext,
  summarizeHookTypeStats,
} from "@/lib/memory/patterns";
import { buildTopProductCategories } from "@/lib/memory/service";
import {
  detectPlatformFromUrl,
  summarizePerformance,
  summarizeRevenue,
} from "@/lib/performance/metrics";
import { directRevenueCategoryEntries } from "@/lib/performance/service";
import { productCreateSchema } from "@/lib/products/service";
import { isPrivateAddress } from "@/lib/security/productImport";

const performanceServiceSource = readFileSync("lib/performance/service.ts", "utf8");
const hermesServiceSource = readFileSync("lib/hermes/service.ts", "utf8");
const memoryServiceSource = readFileSync("lib/memory/service.ts", "utf8");
const productServiceSource = readFileSync("lib/products/service.ts", "utf8");
const contentServiceSource = readFileSync("lib/content/service.ts", "utf8");
const hqServiceSource = readFileSync("lib/hq/service.ts", "utf8");
const shoppingConnectRevenueSummaryRouteSource = readFileSync(
  "app/api/shopping-connect/revenue-summary/route.ts",
  "utf8",
);
const reportServiceSource = readFileSync("lib/reports/service.ts", "utf8");
const reportSummarySource = readFileSync("components/reports/ReportSummary.tsx", "utf8");
const reportIntelligenceRouteSource = readFileSync("app/api/reports/intelligence/route.ts", "utf8");

const fixtureDate = new Date("2026-07-06T00:00:00.000Z");

function productFixture(overrides: Partial<Product> = {}): Product {
  return {
    id: "product_fixture",
    productName: "Fixture product",
    productUrl: "https://example.com/product",
    source: "manual",
    price: null,
    priceCheckedAt: null,
    imageUrl: null,
    category: null,
    popularityScore: null,
    popularityRank: null,
    popularitySource: null,
    popularityCheckedAt: null,
    memo: null,
    createdAt: fixtureDate,
    updatedAt: fixtureDate,
    ...overrides,
  };
}

describe("P4 AI runtime adapter contract", () => {
  it("allows mock AI only for explicit test mode", () => {
    expect(
      createRuntimeAIAdapter({
        AI_ADAPTER: "mock",
        NODE_ENV: "test",
      }),
    ).toBeInstanceOf(MockAIAdapter);
  });

  it("fails closed instead of defaulting to mock in production", () => {
    expect(() =>
      createRuntimeAIAdapter({
        AI_ADAPTER: "mock",
        NODE_ENV: "production",
      }),
    ).toThrow(AIAdapterConfigurationError);
    expect(() =>
      createRuntimeAIAdapter({
        NODE_ENV: "production",
      }),
    ).toThrow(AIAdapterConfigurationError);
  });

  it("validates configured provider credentials without falling back to mock", () => {
    expect(() =>
      createRuntimeAIAdapter({
        AI_ADAPTER: "openai",
        NODE_ENV: "production",
      }),
    ).toThrow(/OPENAI_API_KEY/);
    expect(() =>
      createRuntimeAIAdapter({
        AI_ADAPTER: "claude",
        NODE_ENV: "production",
      }),
    ).toThrow(/CLAUDE_API_KEY/);
    expect(
      createRuntimeAIAdapter({
        AI_ADAPTER: "openai",
        NODE_ENV: "production",
        OPENAI_API_KEY: "test-key",
      }),
    ).toBeInstanceOf(OpenAIAdapter);
    expect(
      createRuntimeAIAdapter({
        AI_ADAPTER: "claude",
        CLAUDE_API_KEY: "test-key",
        NODE_ENV: "production",
      }),
    ).toBeInstanceOf(ClaudeAIAdapter);
  });

  it("keeps HQ daily briefing generation on the runtime AI adapter contract", async () => {
    const briefing = await new MockAIAdapter().generateDailyBriefing({
      companyProfile: {
        companyName: "Paperclip",
        primaryCategories: ["자취", "생활", "테크"],
        blockedCategories: ["의료"],
        toneRules: "신뢰감 있게",
        contentPrinciples: "출처 명시",
        revenueGoalMonthly: 500000,
      },
      opportunityMemoContext: {
        latestMemo: {
          topic: "여름 자취 냉방 준비",
          whyNow: "장마와 폭염이 겹치며 냉방 소모품 수요가 늘고 있습니다.",
          homefeedAngle: "폭염 전 체크리스트",
          searchAngle: "냉방 소모품 비교 검색",
          interestTags: ["자취", "냉방"],
        },
      },
    });

    expect(briefing.focus_categories).toEqual(["자취", "생활", "테크"]);
    expect(hqServiceSource).toContain("createRuntimeAIAdapterFromConfiguredCredentials");
    expect(hqServiceSource).toContain("adapter.generateDailyBriefing");
    expect(hqServiceSource).toContain(
      "companyProfile: serializeDailyBriefingCompanyProfile(profile)",
    );
    expect(hqServiceSource).toContain("opportunityMemoContext");
    expect(hqServiceSource).not.toContain("priorityAngle: latestMemo?.homefeedAngle");
  });
});

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
  it("formats live HQ status API payloads for compact and full badges", () => {
    const status = hqStatusResponseSchema.parse({
      success: true,
      data: {
        status: "Revenue",
        reason: "성과 기록이 필요합니다.",
        needs_performance_log: 2,
        ai_budget: {
          kind: "within_budget",
          capUsd: 5,
          totalCostUsd: 2.1,
          projectedCostUsd: 2.1,
          usageRate: 42,
          remainingUsd: 2.9,
        },
      },
    }).data;

    expect(formatHqStatusText(status, true)).toBe(
      "상태 수익 · 미기록 2건 · AI 예산 정상 42% · $2.10/$5.00",
    );
    expect(formatHqStatusText(status, false)).toBe(
      "상태 수익 · 성과 미기록 2건 · AI 예산 정상 42% · $2.10/$5.00",
    );
    expect(hqStatusRefreshEvent).toBe("paperclip:hq-status-refresh");
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
  it("turns reports into Paperclip revenue intelligence instead of placeholder summaries", () => {
    expect(reportServiceSource).toContain("weekly_review");
    expect(reportServiceSource).toContain("monthly_pnl");
    expect(reportServiceSource).toContain("next_month_calendar");
    expect(reportServiceSource).toContain("rewrite_recommendations");
    expect(reportServiceSource).toContain("link_refresh_recommendations");
    expect(reportSummarySource).toContain("글별 ROI");
    expect(reportSummarySource).toContain("다음 달 콘텐츠 캘린더");
    expect(reportIntelligenceRouteSource).toContain("reports.intelligence");
  });

  it("exposes the documented ShoppingConnect revenue summary route", () => {
    expect(shoppingConnectRevenueSummaryRouteSource).toContain("shopping-connect.revenue-summary");
    expect(shoppingConnectRevenueSummaryRouteSource).toContain("getRevenueSummary");
  });

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

  it("summarizes revenue by category instead of only latest content fallback", () => {
    const summary = summarizeRevenue(
      [
        {
          content_title: "Low value item",
          category: "생활",
          direct_revenue: 2_000,
          indirect_revenue: 3_000,
        },
        {
          content_title: "High value item",
          category: "테크",
          direct_revenue: 10_000,
          indirect_revenue: 40_000,
        },
        {
          content_title: "Second tech item",
          category: "테크",
          direct_revenue: 0,
          indirect_revenue: 25_000,
        },
      ] as Parameters<typeof summarizeRevenue>[0],
      100_000,
    );

    expect(summary).toMatchObject({
      month_total: 80_000,
      top_content_title: "High value item",
      top_content_revenue: 50_000,
      top_category: "테크",
      category_rankings: [
        { category: "테크", revenue: 75_000, sample_count: 2 },
        { category: "생활", revenue: 5_000, sample_count: 1 },
      ],
    });
  });

  it("attributes direct revenue only to distinct active linked product categories", () => {
    const entries = directRevenueCategoryEntries({
      directRevenue: 90_000,
      contentPackage: {
        topic: { title: "Package topic" },
        shoppingConnectLinks: [
          { isActive: true, product: { category: "테크" } },
          { isActive: true, product: { category: "테크" } },
          { isActive: true, product: { category: "생활" } },
          { isActive: false, product: { category: "비활성" } },
        ],
      },
    });

    expect(entries).toEqual([
      {
        content_title: "Package topic",
        category: "테크",
        direct_revenue: 45_000,
        indirect_revenue: 0,
      },
      {
        content_title: "Package topic",
        category: "생활",
        direct_revenue: 45_000,
        indirect_revenue: 0,
      },
    ]);
  });

  it("requires explicit package binding when performance is recorded", () => {
    expect(performanceServiceSource).toContain("content_package_id: z.string().min(1)");
    expect(performanceServiceSource).not.toContain("resolveContentPackageId");
    expect(performanceServiceSource).not.toContain('orderBy: { updatedAt: "desc" }');
    expect(performanceServiceSource).toContain("directRevenueCategoryEntries");
    expect(performanceServiceSource).toContain(
      "shoppingConnectLinks: { include: { product: true } }",
    );
    expect(performanceServiceSource).not.toContain("category: log.contentPackage.topic.title");
  });
});

describe("G008 product commerce contract", () => {
  it("routes Naver product imports through the insane-search worker contract only", () => {
    expect(productServiceSource).toContain("importProductWithInsaneSearch(validatedUrl.url)");
    expect(productServiceSource).toContain(
      "throw new ProductImportBlockedError(crawlerResult.reason",
    );
    expect(productServiceSource).not.toContain("parseNaverProductFromUrl");
    expect(productServiceSource).not.toContain("parseOptionalPrice(url)");
    expect(productServiceSource).not.toContain("parseOptionalImageUrl(url)");
    expect(productServiceSource).not.toContain("missing_product_metadata");
    expect(productServiceSource).not.toContain("Naver Shopping Product");
    expect(productServiceSource).not.toContain("placeholder");
  });

  it("keeps product import persistence free of in-process scraping dependencies", () => {
    expect(productServiceSource).not.toMatch(/\bfetch\s*\(/);
    expect(productServiceSource).not.toContain("axios");
    expect(productServiceSource).not.toContain("cheerio");
    expect(productServiceSource).not.toContain("jsdom");
    expect(productServiceSource).toContain('source: input.source ?? "manual"');
  });

  it("restricts manual product and image URL protocols", () => {
    expect(
      productCreateSchema.safeParse({
        product_name: "Manual product",
        product_url: "manual://product",
        image_url: "https://example.com/product.png",
      }).success,
    ).toBe(true);
    expect(
      productCreateSchema.safeParse({
        product_name: "Manual product",
        product_url: "javascript:alert(1)",
      }).success,
    ).toBe(false);
    expect(
      productCreateSchema.safeParse({
        product_name: "Manual product",
        image_url: "javascript:alert(1)",
      }).success,
    ).toBe(false);
  });

  it("blocks private, reserved, and mapped-private import addresses", () => {
    for (const address of [
      "0.0.0.0",
      "10.0.0.1",
      "100.64.0.1",
      "127.0.0.1",
      "169.254.1.1",
      "172.31.255.255",
      "192.0.0.1",
      "192.168.1.1",
      "198.18.0.1",
      "224.0.0.1",
      "::",
      "::1",
      "fc00::1",
      "fd00::1",
      "fe80::1",
      "fe90::1",
      "febf::1",
      "ff02::1",
      "2001:db8::1",
      "64:ff9b::1",
      "64:ff9b:1::1",
      "100::1",
      "2001::1",
      "2001:2::1",
      "2002::1",
      "3fff::1",
      "::ffff:127.0.0.1",
    ]) {
      expect(isPrivateAddress(address)).toBe(true);
    }

    expect(isPrivateAddress("8.8.8.8")).toBe(false);
    expect(isPrivateAddress("2001:4860:4860::8888")).toBe(false);
  });

  it("excludes inactive ShoppingConnect products from content placement inputs", () => {
    const activeProduct = productFixture({
      id: "active_product",
      productName: "Active product",
      category: "테크",
    });
    const inactiveProduct = productFixture({
      id: "inactive_product",
      productName: "Inactive product",
      category: "비활성",
    });

    expect(
      serializeActivePlacementProducts([
        { isActive: true, product: activeProduct },
        { isActive: false, product: inactiveProduct },
      ]).map((product) => product.product_name),
    ).toEqual(["Active product"]);
  });

  it("rejects metadata-poor imports through typed worker failure reasons instead of generic fallbacks", () => {
    expect(productServiceSource).toContain(
      'reason: InsaneSearchFailureReason = "metadata_missing"',
    );
    expect(productServiceSource).toContain("new ProductImportBlockedError(reason)");
    expect(productServiceSource).not.toContain('"Naver Shopping Product"');
    expect(productServiceSource).not.toContain("example.com");
    expect(productServiceSource).not.toContain("placeholder");
    expect(productServiceSource).not.toContain("fallback");
  });

  it("does not mask persistence failures as not-found shopping link results", () => {
    expect(productServiceSource).toContain("isRecordNotFoundError");
    expect(productServiceSource).not.toContain(".catch(() => null)");
    expect(productServiceSource).not.toContain(".catch(() => false)");
  });

  it("does not catch-all mask draft persistence failures as not found", () => {
    expect(contentServiceSource).toContain("isRecordNotFoundError");
    expect(contentServiceSource).not.toContain(".catch(() => null)");
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

  it("builds top product categories from active revenue evidence without duplication", () => {
    const categories = buildTopProductCategories({
      revenueLogs: [],
      performanceLogs: [
        {
          directRevenue: 90_000,
          views: 300,
          clicks: 30,
          recordedAt: fixtureDate,
          contentPackage: {
            shoppingConnectLinks: [
              {
                isActive: true,
                product: { category: "테크", productName: "Tech A", price: 10_000 },
              },
              {
                isActive: true,
                product: { category: "테크", productName: "Tech B", price: 20_000 },
              },
              {
                isActive: true,
                product: { category: "생활", productName: "Life", price: 30_000 },
              },
              {
                isActive: false,
                product: { category: "비활성", productName: "Inactive", price: 40_000 },
              },
            ],
          },
        },
      ],
    });

    expect(categories).toEqual([
      { category: "테크", product_name: "Tech A", price: 10_000 },
      { category: "생활", product_name: "Life", price: 30_000 },
    ]);
  });

  it("aggregates persisted Company Memory patterns before Hermes reuse", () => {
    expect(hermesServiceSource).toContain("weightedMemoryAverage");
    expect(hermesServiceSource).toContain("patternType");
    expect(hermesServiceSource).toContain("patternText");
    expect(hermesServiceSource).toContain("category");
    expect(hermesServiceSource).toContain("usedInRecommendations");
    expect(hermesServiceSource).toContain("increment");
    expect(hermesServiceSource).not.toContain("prisma.companyMemory.groupBy");
    expect(hermesServiceSource).not.toContain("take: 20");
    expect(
      hermesServiceSource.indexOf("await markCompanyMemoryUsed(memoryContext);"),
    ).toBeGreaterThan(hermesServiceSource.indexOf("createdIds.push(memo.id);"));
  });

  it("does not rank product categories without revenue or performance evidence", () => {
    expect(memoryServiceSource).not.toContain("if (categories.size === 0)");
    expect(memoryServiceSource).not.toContain("updatedAt: product.updatedAt");
  });
});
