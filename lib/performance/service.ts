import { z } from "zod";
import { getOrCreateCompanyProfile } from "@/lib/company-profile/service";
import { prisma } from "@/lib/db";
import { buildCompanyMemoryEntriesForPerformance } from "@/lib/memory/patterns";
import {
  detectPlatformFromUrl,
  summarizePerformance,
  summarizeRevenue,
} from "@/lib/performance/metrics";

export const performanceLogCreateSchema = z.object({
  content_package_id: z.string().min(1).optional(),
  post_url: z.string().url(),
  views: z.number().int().nonnegative(),
  clicks: z.number().int().nonnegative(),
  direct_revenue: z.number().int().nonnegative().optional(),
  hook_type: z.string().trim().min(1).optional(),
});

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

async function resolveContentPackageId(id: string | undefined): Promise<string | null> {
  if (id !== undefined) {
    return id;
  }
  const contentPackage = await prisma.contentPackage.findFirst({
    orderBy: { updatedAt: "desc" },
  });
  return contentPackage?.id ?? null;
}

export async function createPerformanceLog(input: z.infer<typeof performanceLogCreateSchema>) {
  const contentPackageId = await resolveContentPackageId(input.content_package_id);
  if (contentPackageId === null) {
    return null;
  }
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
  });
  if (memoryEntries.length > 0) {
    await prisma.companyMemory.createMany({
      data: memoryEntries.map((entry) => ({
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
      })),
    });
  }

  return serializePerformanceLog(log);
}

export async function listPerformanceLogs(period: "week" | "all") {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const logs = await prisma.performanceLog.findMany({
    where: period === "week" ? { recordedAt: { gte: since } } : {},
    orderBy: { recordedAt: "desc" },
  });
  return {
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

export async function getRevenueSummary() {
  const profile = await getOrCreateCompanyProfile();
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const [performanceLogs, revenueLogs] = await Promise.all([
    prisma.performanceLog.findMany({
      where: { recordedAt: { gte: monthStart } },
      include: { contentPackage: { include: { topic: true } } },
    }),
    prisma.revenueLog.findMany({
      where: { orderedAt: { gte: monthStart } },
      include: { product: true },
    }),
  ]);
  return summarizeRevenue(
    [
      ...performanceLogs.map((log) => ({
        content_title: log.contentPackage.topic.title,
        direct_revenue: log.directRevenue ?? 0,
        indirect_revenue: 0,
      })),
      ...revenueLogs.map((log) => ({
        content_title: log.product.productName,
        direct_revenue: 0,
        indirect_revenue: log.amount,
      })),
    ],
    profile.revenueGoalMonthly,
  );
}
