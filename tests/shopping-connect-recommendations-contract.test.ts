import { describe, expect, it } from "vitest";
import { rankShoppingConnectCandidates } from "@/lib/affiliate/shoppingConnectRecommendations";

describe("shopping connect recommendation contract", () => {
  it("ranks lifestyle products with active ShoppingConnect links for a lifestyle blog draft", () => {
    const recommendations = rankShoppingConnectCandidates({
      topicTitle: "생활 카테고리 원룸 습기 줄이는 방법",
      draftText: "원룸 생활에서 습기와 냄새를 줄이려면 제습제와 수납 위치를 함께 봐야 합니다.",
      products: [
        {
          id: "product_inactive",
          productName: "생활 제습제",
          category: "생활",
          price: 12_000,
          priceCheckedAt: new Date("2026-07-08T00:00:00.000Z"),
          shoppingConnectLinks: [],
        },
        {
          id: "product_lifestyle",
          productName: "원룸 제습제",
          category: "생활",
          price: 9_900,
          priceCheckedAt: new Date("2026-07-08T00:00:00.000Z"),
          shoppingConnectLinks: [
            {
              id: "link_lifestyle",
              shoppingConnectUrl: "https://shopping.naver.com/connect/life",
              commissionRate: 7,
              bonusCommission: null,
              isActive: true,
              linkCheckedAt: new Date("2026-07-08T00:00:00.000Z"),
            },
          ],
        },
        {
          id: "product_tech",
          productName: "노트북 거치대",
          category: "테크",
          price: 29_000,
          priceCheckedAt: new Date("2026-07-08T00:00:00.000Z"),
          shoppingConnectLinks: [
            {
              id: "link_tech",
              shoppingConnectUrl: "https://shopping.naver.com/connect/tech",
              commissionRate: 5,
              bonusCommission: null,
              isActive: true,
              linkCheckedAt: new Date("2026-07-08T00:00:00.000Z"),
            },
          ],
        },
      ],
      now: new Date("2026-07-09T00:00:00.000Z"),
    });

    expect(recommendations[0]).toMatchObject({
      product_id: "product_lifestyle",
      product_name: "원룸 제습제",
      primary_url: "https://shopping.naver.com/connect/life",
    });
    expect(recommendations.map((item) => item.product_id)).not.toContain("product_inactive");
  });
});
