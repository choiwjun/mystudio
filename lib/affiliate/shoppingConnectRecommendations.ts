import { z } from "zod";
import { prisma } from "@/lib/db";
import { isOlderThanSevenDays } from "@/lib/products/service";

export const shoppingConnectRecommendationSchema = z.object({
  content_package_id: z.string().min(1),
});

type CandidateLink = {
  readonly id: string;
  readonly shoppingConnectUrl: string;
  readonly commissionRate: number;
  readonly bonusCommission: number | null;
  readonly isActive: boolean;
  readonly linkCheckedAt: Date | null;
};

type CandidateProduct = {
  readonly id: string;
  readonly productName: string;
  readonly category: string | null;
  readonly price: number | null;
  readonly priceCheckedAt: Date | null;
  readonly shoppingConnectLinks: readonly CandidateLink[];
};

type CandidateRankingInput = {
  readonly topicTitle: string;
  readonly draftText: string;
  readonly products: readonly CandidateProduct[];
  readonly now?: Date;
};

type ShoppingConnectRecommendation = {
  readonly product_id: string;
  readonly product_name: string;
  readonly category: string | null;
  readonly primary_url: string;
  readonly commission_rate: number;
  readonly score: number;
  readonly reasons: readonly string[];
};

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function normalizeText(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? "";
}

function productNameTokens(productName: string): readonly string[] {
  return productName
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
}

function textMatchesProduct(input: {
  readonly combinedText: string;
  readonly category: string | null;
  readonly productName: string;
}): boolean {
  const text = normalizeText(input.combinedText);
  const category = normalizeText(input.category);
  return (
    (category.length > 0 && text.includes(category)) ||
    productNameTokens(input.productName).some((token) => text.includes(normalizeText(token)))
  );
}

function bestActiveShoppingLink(product: CandidateProduct): CandidateLink | null {
  return (
    product.shoppingConnectLinks
      .filter((link) => link.isActive)
      .sort(
        (left, right) =>
          (right.bonusCommission ?? right.commissionRate) -
            (left.bonusCommission ?? left.commissionRate) ||
          right.commissionRate - left.commissionRate,
      )[0] ?? null
  );
}

export function rankShoppingConnectCandidates(
  input: CandidateRankingInput,
): readonly ShoppingConnectRecommendation[] {
  const combinedText = `${input.topicTitle} ${input.draftText}`;
  const now = input.now ?? new Date();

  const recommendations: ShoppingConnectRecommendation[] = [];
  for (const product of input.products) {
    const link = bestActiveShoppingLink(product);
    if (link === null) {
      continue;
    }

    const reasons = ["활성 쇼핑커넥트 링크 있음"];
    let score = 35;
    if (
      textMatchesProduct({
        combinedText,
        category: product.category,
        productName: product.productName,
      })
    ) {
      score += 40;
      reasons.push("블로그 주제/본문과 상품 맥락 일치");
    }
    if (product.price !== null) {
      score += 10;
      reasons.push("가격 정보 있음");
    }
    if (!isOlderThanSevenDays(product.priceCheckedAt, now)) {
      score += 10;
      reasons.push("가격 확인 7일 이내");
    } else {
      reasons.push("가격 갱신 필요");
    }
    score += Math.min(10, Math.max(0, link.bonusCommission ?? link.commissionRate));

    recommendations.push({
      product_id: product.id,
      product_name: product.productName,
      category: product.category,
      primary_url: link.shoppingConnectUrl,
      commission_rate: link.bonusCommission ?? link.commissionRate,
      score: clampScore(score),
      reasons,
    });
  }

  return recommendations
    .sort(
      (left, right) =>
        right.score - left.score ||
        right.commission_rate - left.commission_rate ||
        left.product_name.localeCompare(right.product_name, "ko-KR"),
    )
    .slice(0, 5);
}

export async function recommendShoppingConnectLinksForContentPackage(
  input: z.infer<typeof shoppingConnectRecommendationSchema>,
) {
  const contentPackage = await prisma.contentPackage.findUnique({
    where: { id: input.content_package_id },
    include: { topic: true, drafts: { orderBy: { updatedAt: "desc" }, take: 1 } },
  });
  if (contentPackage === null) {
    return null;
  }

  const products = await prisma.product.findMany({
    where: { shoppingConnectLinks: { some: { isActive: true } } },
    include: { shoppingConnectLinks: { where: { isActive: true } } },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });
  const draft = contentPackage.drafts[0] ?? null;
  const recommendations = rankShoppingConnectCandidates({
    topicTitle: contentPackage.topic.title,
    draftText: [
      draft?.searchTitle ?? "",
      draft?.firstScreen ?? "",
      draft?.bodyMarkdown ?? "",
      draft?.comparisonTable ?? "",
    ].join("\n"),
    products,
  });

  return {
    content_package_id: contentPackage.id,
    topic: contentPackage.topic.title,
    recommendations,
  };
}
