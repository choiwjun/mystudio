import { PackageStatus } from "@prisma/client";
import { z } from "zod";
import { getOrCreateCompanyProfile } from "@/lib/company-profile/service";
import { transitionContentPackageStatus } from "@/lib/content/repository";
import {
  isPackageStatusTransitionAllowed,
  performanceRecordableStatuses,
} from "@/lib/content/statusTransitions";
import { prisma } from "@/lib/db";
import { buildCompanyMemoryEntriesForPerformance } from "@/lib/memory/patterns";
import {
  detectPlatformFromUrl,
  type RevenueMetricInput,
  summarizePerformance,
  summarizeRevenue,
} from "@/lib/performance/metrics";

export const performanceLogCreateSchema = z.object({
  content_package_id: z.string().min(1),
  post_url: z.string().url(),
  views: z.number().int().nonnegative(),
  clicks: z.number().int().nonnegative(),
  direct_revenue: z.number().int().nonnegative().optional(),
  hook_type: z.string().trim().min(1).optional(),
});
export type SerializedPerformanceContentPackageChoice = {
  readonly id: string;
  readonly topic_title: string;
  readonly status: string;
  readonly updated_at: string;
};

export function serializePerformanceLog(log: {
  id: string;
  contentPackageId: string;
  platform: string;
  postUrl: string;
  hookType: string | null;
  views: number;
  clicks: number | null;
  directRevenue: number | null;
  recordedAt: Date;
}) {
  return {
    id: log.id,
    content_package_id: log.contentPackageId,
    platform: log.platform,
    post_url: log.postUrl,
    hook_type: log.hookType,
    views: log.views,
    clicks: log.clicks,
    direct_revenue: log.directRevenue,
    recorded_at: log.recordedAt.toISOString(),
  };
}

function serializeContentPackageChoice(contentPackage: {
  readonly id: string;
  readonly status: string;
  readonly updatedAt: Date;
  readonly topic: { readonly title: string };
}): SerializedPerformanceContentPackageChoice {
  return {
    id: contentPackage.id,
    topic_title: contentPackage.topic.title,
    status: contentPackage.status,
    updated_at: contentPackage.updatedAt.toISOString(),
  };
}

async function listRecentContentPackageChoices(): Promise<
  SerializedPerformanceContentPackageChoice[]
> {
  const contentPackages = await prisma.contentPackage.findMany({
    where: { status: { in: [...performanceRecordableStatuses] } },
    include: { topic: true },
    orderBy: {
      updatedAt: "desc",
    },
    take: 20,
  });
  return contentPackages.map(serializeContentPackageChoice);
}

async function loadPerformanceRecordableContentPackage(id: string) {
  return prisma.contentPackage.findFirst({
    where: {
      id,
      status: { in: [...performanceRecordableStatuses] },
    },
    select: {
      id: true,
      status: true,
      shoppingConnectLinks: {
        where: { isActive: true },
        include: { product: true },
      },
    },
  });
}

function mergeAverage(
  previousAverage: number | null,
  previousCount: number,
  nextValue: number,
): number {
  if (previousAverage === null || previousCount <= 0) {
    return nextValue;
  }
  return (previousAverage * previousCount + nextValue) / (previousCount + 1);
}

export function directRevenueCategoryEntries(log: {
  readonly contentPackage: {
    readonly topic: { readonly title: string };
    readonly shoppingConnectLinks: readonly {
      readonly isActive: boolean;
      readonly product: { readonly category: string | null };
    }[];
  };
  readonly directRevenue: number | null;
}): RevenueMetricInput[] {
  const directRevenue = log.directRevenue ?? 0;
  const categories = [
    ...new Set(
      log.contentPackage.shoppingConnectLinks
        .filter((link) => link.isActive)
        .map((link) => link.product.category?.trim())
        .filter((category): category is string => category !== undefined && category.length > 0),
    ),
  ];

  if (categories.length === 0) {
    return [
      {
        content_title: log.contentPackage.topic.title,
        category: null,
        direct_revenue: directRevenue,
        indirect_revenue: 0,
      },
    ];
  }

  const revenuePerCategory = directRevenue / categories.length;
  return categories.map((category) => ({
    content_title: log.contentPackage.topic.title,
    category,
    direct_revenue: revenuePerCategory,
    indirect_revenue: 0,
  }));
}

function sameTags(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }
  const rightSet = new Set(right);
  return left.every((tag) => rightSet.has(tag));
}

async function upsertCompanyMemoryEntry(
  entry: ReturnType<typeof buildCompanyMemoryEntriesForPerformance>[number],
): Promise<void> {
  const existingEntries = await prisma.companyMemory.findMany({
    where: {
      patternType: entry.patternType,
      patternText: entry.patternText,
    },
    orderBy: {
      updatedAt: "desc",
    },
  });
  const existing = existingEntries.find((memory) => sameTags(memory.tags, entry.tags));

  if (existing === undefined) {
    await prisma.companyMemory.create({
      data: {
        patternType: entry.patternType,
        patternText: entry.patternText,
        resultSummary: entry.resultSummary,
        tags: [...entry.tags],
        score: entry.score,
        sampleCount: entry.sampleCount,
        avgViews: entry.avgViews,
        avgClicks: entry.avgClicks,
        avgRevenueUsd: entry.avgRevenueUsd,
        createdPatternIds: [...entry.createdPatternIds],
      },
    });
    return;
  }

  const previousCount = existing.sampleCount;
  const createdPatternIds = [
    ...new Set([...existing.createdPatternIds, ...entry.createdPatternIds]),
  ];
  await prisma.companyMemory.update({
    where: { id: existing.id },
    data: {
      resultSummary: `${previousCount + 1} samples; latest: ${entry.resultSummary}`,
      score: mergeAverage(existing.score, previousCount, entry.score),
      sampleCount: previousCount + 1,
      avgViews: mergeAverage(existing.avgViews, previousCount, entry.avgViews),
      avgClicks: mergeAverage(existing.avgClicks, previousCount, entry.avgClicks),
      avgRevenueUsd: mergeAverage(existing.avgRevenueUsd, previousCount, entry.avgRevenueUsd),
      createdPatternIds,
    },
  });
}

async function markPerformanceRecorded(input: {
  readonly contentPackageId: string;
  readonly fromStatus: PackageStatus;
  readonly memoryUpdated: boolean;
}): Promise<void> {
  const toStatus = input.memoryUpdated
    ? PackageStatus.memory_updated
    : PackageStatus.performance_recorded;
  if (!isPackageStatusTransitionAllowed(input.fromStatus, toStatus)) {
    return;
  }
  await transitionContentPackageStatus({
    id: input.contentPackageId,
    fromStatus: input.fromStatus,
    toStatus,
    actor: "system",
    reason: input.memoryUpdated
      ? "Performance recorded and Company Memory updated."
      : "Performance recorded.",
  });
}

export async function createPerformanceLog(input: z.infer<typeof performanceLogCreateSchema>) {
  const contentPackage = await loadPerformanceRecordableContentPackage(input.content_package_id);
  if (contentPackage === null) {
    return null;
  }
  const contentPackageId = input.content_package_id;
  const platform = detectPlatformFromUrl(input.post_url);
  const log = await prisma.performanceLog.create({
    data: {
      contentPackageId,
      platform,
      postUrl: input.post_url,
      views: input.views,
      clicks: input.clicks,
      directRevenue: input.direct_revenue ?? 0,
      ...(input.hook_type === undefined ? {} : { hookType: input.hook_type }),
    },
  });

  const memoryEntries = buildCompanyMemoryEntriesForPerformance({
    performanceLogId: log.id,
    platform,
    hookType: input.hook_type ?? null,
    views: input.views,
    clicks: input.clicks,
    directRevenue: input.direct_revenue ?? 0,
    products: contentPackage.shoppingConnectLinks.map((link) => ({
      category: link.product.category,
      productName: link.product.productName,
      price: link.product.price,
    })),
  });
  for (const entry of memoryEntries) {
    await upsertCompanyMemoryEntry(entry);
  }
  await markPerformanceRecorded({
    contentPackageId,
    fromStatus: contentPackage.status,
    memoryUpdated: memoryEntries.length > 0,
  });

  return serializePerformanceLog(log);
}

export async function listPerformanceLogs(period: "week" | "all") {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [logs, recentContentPackages] = await Promise.all([
    prisma.performanceLog.findMany({
      where: period === "week" ? { recordedAt: { gte: since } } : {},
      orderBy: { recordedAt: "desc" },
    }),
    listRecentContentPackageChoices(),
  ]);
  return {
    performance_logs: logs.map(serializePerformanceLog),
    recent_content_packages: recentContentPackages,
    summary: summarizePerformance(
      logs.map((log) => ({
        views: log.views,
        clicks: log.clicks ?? 0,
        direct_revenue: log.directRevenue ?? 0,
        hook_type: log.hookType,
      })),
    ),
  };
}

export async function getContentPerformance(contentPackageId: string) {
  const logs = await prisma.performanceLog.findMany({
    where: { contentPackageId },
    orderBy: { recordedAt: "desc" },
  });
  return {
    content_package_id: contentPackageId,
    performance_logs: logs.map(serializePerformanceLog),
    summary: summarizePerformance(
      logs.map((log) => ({
        views: log.views,
        clicks: log.clicks ?? 0,
        direct_revenue: log.directRevenue ?? 0,
        hook_type: log.hookType,
      })),
    ),
  };
}

export async function getCategoryPerformance(category: string) {
  const normalizedCategory = category.trim().toLowerCase();
  const [performanceLogs, revenueLogs] = await Promise.all([
    prisma.performanceLog.findMany({
      include: {
        contentPackage: {
          include: {
            topic: true,
            shoppingConnectLinks: { include: { product: true } },
          },
        },
      },
      orderBy: { recordedAt: "desc" },
    }),
    prisma.revenueLog.findMany({
      include: { product: true },
      orderBy: { orderedAt: "desc" },
    }),
  ]);
  const matchingPerformanceLogs = performanceLogs.filter((log) =>
    directRevenueCategoryEntries(log).some(
      (entry) => entry.category?.trim().toLowerCase() === normalizedCategory,
    ),
  );
  const matchingRevenueLogs = revenueLogs.filter(
    (log) => log.product.category?.trim().toLowerCase() === normalizedCategory,
  );

  return {
    category,
    performance_logs: matchingPerformanceLogs.map(serializePerformanceLog),
    revenue_logs: matchingRevenueLogs.map((log) => ({
      id: log.id,
      product_id: log.productId,
      product_name: log.product.productName,
      amount: log.amount,
      ordered_at: log.orderedAt.toISOString(),
      source: log.product.source,
    })),
    summary: summarizePerformance(
      matchingPerformanceLogs.map((log) => ({
        views: log.views,
        clicks: log.clicks ?? 0,
        direct_revenue: log.directRevenue ?? 0,
        hook_type: log.hookType,
      })),
    ),
    revenue_total:
      matchingPerformanceLogs.reduce((total, log) => total + (log.directRevenue ?? 0), 0) +
      matchingRevenueLogs.reduce((total, log) => total + log.amount, 0),
  };
}

export async function getRevenueSummary() {
  const profile = await getOrCreateCompanyProfile();
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const [performanceLogs, revenueLogs] = await Promise.all([
    prisma.performanceLog.findMany({
      where: { recordedAt: { gte: monthStart } },
      include: {
        contentPackage: {
          include: {
            topic: true,
            shoppingConnectLinks: { include: { product: true } },
          },
        },
      },
    }),
    prisma.revenueLog.findMany({
      where: { orderedAt: { gte: monthStart } },
      include: { product: true },
    }),
  ]);
  return summarizeRevenue(
    [
      ...performanceLogs.flatMap(directRevenueCategoryEntries),
      ...revenueLogs.map((log) => ({
        content_title: log.product.productName,
        category: log.product.category,
        direct_revenue: 0,
        indirect_revenue: log.amount,
      })),
    ],
    profile.revenueGoalMonthly,
  );
}
