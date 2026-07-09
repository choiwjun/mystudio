import { z } from "zod";
import { prisma } from "@/lib/db";
import { buildKeywordClusters, serializeOpportunityMemo } from "@/lib/hermes/service";

export const opportunityMemoCreateSchema = z.object({
  topic: z.string().trim().min(1),
  why_now: z.string().trim().min(10),
  homefeed_angle: z.string().trim().min(5),
  search_angle: z.string().trim().min(5),
  interest_tags: z.array(z.string().trim().min(1)).min(1).max(8),
  homefeed_score: z.number().int().min(0).max(100).default(50),
  homefeed_reasons: z.string().trim().min(5).optional(),
  search_score: z.number().int().min(0).max(100).default(50),
  search_reasons: z.string().trim().min(5).optional(),
  revenue_score: z.number().int().min(0).max(100).default(50),
  revenue_reasons: z.string().trim().min(5).optional(),
  risk_score: z.number().int().min(0).max(100).default(30),
  score_reasons: z.string().trim().min(10).optional(),
});

export async function createOpportunityMemo(input: z.infer<typeof opportunityMemoCreateSchema>) {
  const memo = await prisma.opportunityMemo.create({
    data: {
      topic: input.topic,
      whyNow: input.why_now,
      homefeedAngle: input.homefeed_angle,
      searchAngle: input.search_angle,
      interestTags: [...input.interest_tags],
      homefeedScore: input.homefeed_score,
      homefeedReasons: input.homefeed_reasons ?? "수동 입력 메모의 홈피드 적합도입니다.",
      searchScore: input.search_score,
      searchReasons: input.search_reasons ?? "수동 입력 메모의 검색 적합도입니다.",
      revenueScore: input.revenue_score,
      revenueReasons: input.revenue_reasons ?? "수동 입력 메모의 수익 적합도입니다.",
      riskScore: input.risk_score,
      scoreReasons: input.score_reasons ?? "수동 입력으로 생성된 기회 메모입니다.",
      recommendedPackages: ["blog"],
      keywordClusters: {
        create: buildKeywordClusters(input.topic).map((cluster) => ({
          primaryKeyword: cluster.primary_keyword,
          relatedKeywords: [...cluster.related_keywords],
          searchVolume: cluster.search_volume,
          competitionScore: cluster.competition_score,
        })),
      },
    },
    include: { keywordClusters: true },
  });
  return serializeOpportunityMemo(memo);
}
