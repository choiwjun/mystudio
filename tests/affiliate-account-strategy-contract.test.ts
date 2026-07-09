import { describe, expect, it } from "vitest";
import { buildAffiliateAccountContentPlan } from "@/lib/affiliate/accountStrategy";

describe("affiliate account strategy contract", () => {
  it("selects a popular Olive Young beauty product and creates a curator hook", () => {
    const plan = buildAffiliateAccountContentPlan({
      account: {
        id: "account_oliveyoung",
        platform: "oliveyoung",
        accountName: "올리브영 큐레이터",
        affiliateProgram: "올리브영 큐레이터",
        categoryFocus: ["화장품", "스킨케어"],
        snsTargets: ["instagram", "threads"],
        hookStyle: "큐레이터 추천형",
      },
      products: [
        {
          id: "product_interior",
          productName: "무드등",
          category: "인테리어",
          price: 24_000,
          popularityScore: 1,
          popularityRank: 20,
          popularitySource: "oliveyoung",
          revenueAmount: 300_000,
          activeAffiliateLinks: [
            {
              accountId: "account_oliveyoung",
              affiliateUrl: "https://example.com/interior",
              commissionRate: 5,
            },
          ],
        },
        {
          id: "product_beauty",
          productName: "진정 세럼",
          category: "화장품",
          price: 18_000,
          popularityScore: 28,
          popularityRank: 1,
          popularitySource: "oliveyoung",
          revenueAmount: 120_000,
          activeAffiliateLinks: [
            {
              accountId: "account_oliveyoung",
              affiliateUrl: "https://example.com/serum",
              commissionRate: 12,
            },
          ],
        },
      ],
    });

    expect(plan.selected_product).toMatchObject({
      product_id: "product_beauty",
      affiliate_url: "https://example.com/serum",
    });
    expect(plan.sns_targets).toEqual(["instagram", "threads"]);
    expect(plan.hook_ment).toContain("올리브영 큐레이터");
    expect(plan.hook_ment).toContain("진정 세럼");
    expect(plan.reasons).toContain("계정 카테고리 포커스와 일치");
    expect(plan.reasons).toContain("oliveyoung 인기 신호 반영");
  });
});
