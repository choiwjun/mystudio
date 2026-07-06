import { PackageStatus } from "@prisma/client";
import { z } from "zod";
import { createRuntimeAIAdapter } from "@/lib/ai/runtime";
import {
  assertCompanyProfileReady,
  getOrCreateCompanyProfile,
} from "@/lib/company-profile/service";
import { serializeContentPackage } from "@/lib/content/serializers";
import { prisma } from "@/lib/db";
import { listOpportunityMemos } from "@/lib/hermes/service";
import { calculateHqStatus } from "@/lib/hq/status";
import { getDailyAiBudgetStatus } from "@/lib/logging/costBudget";
import { getWinningPatterns } from "@/lib/memory/service";
import { getRevenueSummary } from "@/lib/performance/service";

export const dailyBriefingSchema = z.object({
  force: z.boolean().optional(),
});

function startOfToday(): Date {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

export function serializeHqBriefing(briefing: {
  id: string;
  goals: string;
  focusCategories: string[];
  priorityAngle: string;
  strategyNote: string | null;
  status: string;
  date: Date;
}) {
  return {
    id: briefing.id,
    goals: briefing.goals,
    focus_categories: briefing.focusCategories,
    priority_angle: briefing.priorityAngle,
    strategy_note: briefing.strategyNote,
    status: briefing.status,
    date: briefing.date.toISOString(),
  };
}

type DailyBriefingProfileRecord = {
  companyName: string;
  primaryCategories: string[];
  blockedCategories: string[];
  toneRules: string;
  contentPrinciples: string;
  revenueGoalMonthly: number;
};

function serializeDailyBriefingCompanyProfile(profile: DailyBriefingProfileRecord) {
  return {
    companyName: profile.companyName,
    primaryCategories: profile.primaryCategories,
    blockedCategories: profile.blockedCategories,
    toneRules: profile.toneRules,
    contentPrinciples: profile.contentPrinciples,
    revenueGoalMonthly: profile.revenueGoalMonthly,
  };
}

function serializeDailyBriefingOpportunityMemo(memo: {
  topic: string;
  whyNow: string;
  homefeedAngle: string;
  searchAngle: string;
  interestTags: string[];
}) {
  return {
    topic: memo.topic,
    whyNow: memo.whyNow,
    homefeedAngle: memo.homefeedAngle,
    searchAngle: memo.searchAngle,
    interestTags: memo.interestTags,
  };
}

export async function createDailyBriefing(input: z.infer<typeof dailyBriefingSchema>) {
  await assertCompanyProfileReady();

  const today = startOfToday();
  const existing = await prisma.hqBriefing.findFirst({
    where: { date: { gte: today } },
    orderBy: { date: "desc" },
  });
  if (existing !== null && input.force !== true) {
    return serializeHqBriefing(existing);
  }

  const profile = await getOrCreateCompanyProfile();
  const recentMemos = await prisma.opportunityMemo.findMany({
    orderBy: { createdAt: "desc" },
    take: 5,
  });
  const aiBriefing = await createRuntimeAIAdapter().generateDailyBriefing({
    companyProfile: serializeDailyBriefingCompanyProfile(profile),
    opportunityMemoContext: {
      latestMemo:
        recentMemos[0] === undefined ? null : serializeDailyBriefingOpportunityMemo(recentMemos[0]),
      recentMemos: recentMemos.map(serializeDailyBriefingOpportunityMemo),
    },
  });
  const briefing = await prisma.hqBriefing.create({
    data: {
      goals: aiBriefing.goals,
      focusCategories: aiBriefing.focus_categories,
      priorityAngle: aiBriefing.priority_angle,
      strategyNote: aiBriefing.strategy_note,
      status: "active",
    },
  });
  return serializeHqBriefing(briefing);
}

export async function getHqStatus() {
  const profile = await getOrCreateCompanyProfile();
  const [pendingApprovals, complianceFailures, needsPerformanceLog, revenueLogs, aiBudget] =
    await Promise.all([
      prisma.contentPackage.count({ where: { status: PackageStatus.owner_approval_required } }),
      prisma.contentPackage.count({ where: { status: PackageStatus.compliance_failed } }),
      prisma.contentPackage.count({
        where: { status: PackageStatus.published_manually, performanceLogs: { none: {} } },
      }),
      prisma.revenueLog.findMany({
        where: {
          orderedAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
        },
      }),
      getDailyAiBudgetStatus(),
    ]);
  const monthRevenue = revenueLogs.reduce((total, log) => total + log.amount, 0);
  const status = calculateHqStatus({
    pendingApprovals,
    complianceFailures,
    needsPerformanceLog,
    monthRevenue,
    revenueGoal: profile.revenueGoalMonthly,
    aiBudget,
  });

  return {
    ...status,
    pending_approvals: pendingApprovals,
    compliance_failures: complianceFailures,
    needs_performance_log: needsPerformanceLog,
    ai_budget: aiBudget,
  };
}

export async function getHqToday() {
  const briefing = await prisma.hqBriefing.findFirst({
    where: { date: { gte: startOfToday() } },
    orderBy: { date: "desc" },
  });
  const packages = await prisma.contentPackage.findMany({
    include: {
      topic: true,
      paperclipDecision: { include: { opportunityMemo: { include: { keywordClusters: true } } } },
      drafts: { orderBy: { updatedAt: "desc" } },
      titleCandidates: { orderBy: { createdAt: "asc" } },
      complianceChecks: { include: { complianceIssues: true }, orderBy: { checkedAt: "desc" } },
      exports: { orderBy: { createdAt: "desc" } },
      shoppingConnectLinks: { include: { product: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 12,
  });

  const [hqStatus, opportunityMemos, revenueSummary, winningPatterns] = await Promise.all([
    getHqStatus(),
    listOpportunityMemos(),
    getRevenueSummary(),
    getWinningPatterns(),
  ]);

  return {
    hq_status: hqStatus,
    hq_briefing: briefing === null ? null : serializeHqBriefing(briefing),
    opportunity_memos: opportunityMemos,
    content_packages: packages.map(serializeContentPackage),
    revenue_summary: revenueSummary,
    winning_patterns: winningPatterns,
    refresh_needed: winningPatterns.refresh_candidates,
  };
}
