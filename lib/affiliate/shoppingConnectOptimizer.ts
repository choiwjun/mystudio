import { z } from "zod";
import { prisma } from "@/lib/db";
import { isOlderThanSevenDays } from "@/lib/products/service";

export const shoppingConnectScoreSchema = z.object({
  product_id: z.string().min(1),
  content_package_id: z.string().min(1).optional(),
});

export const shoppingConnectPlacementSchema = z.object({
  product_id: z.string().min(1),
  content_package_id: z.string().min(1),
});

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function normalizeText(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? "";
}

function hasTopicMatch(input: {
  readonly topicTitle: string;
  readonly category: string | null;
  readonly productName: string;
}): boolean {
  const topic = normalizeText(input.topicTitle);
  const category = normalizeText(input.category);
  const product = normalizeText(input.productName);
  return (
    (category.length > 0 && topic.includes(category)) ||
    product
      .split(/\s+/)
      .filter((token) => token.length >= 2)
      .some((token) => topic.includes(token))
  );
}

export async function scoreShoppingConnectProduct(
  input: z.infer<typeof shoppingConnectScoreSchema>,
) {
  const product = await prisma.product.findUnique({
    where: { id: input.product_id },
    include: {
      shoppingConnectLinks: true,
      affiliateLinks: true,
    },
  });
  if (product === null) {
    return null;
  }

  const contentPackage =
    input.content_package_id === undefined
      ? null
      : await prisma.contentPackage.findUnique({
          where: { id: input.content_package_id },
          include: { topic: true },
        });
  if (input.content_package_id !== undefined && contentPackage === null) {
    return null;
  }

  const activeShoppingLinks = product.shoppingConnectLinks.filter((link) => link.isActive);
  const activeAffiliateLinks = product.affiliateLinks.filter((link) => link.isActive);
  const reasons: string[] = [];
  let score = 35;

  if (product.price !== null) {
    score += 15;
    reasons.push("가격 정보 있음");
  } else {
    reasons.push("가격 정보 없음");
  }
  if (!isOlderThanSevenDays(product.priceCheckedAt)) {
    score += 15;
    reasons.push("가격 확인 7일 이내");
  } else {
    reasons.push("가격 갱신 필요");
  }
  if (activeShoppingLinks.length > 0) {
    score += 20;
    reasons.push("활성 쇼핑커넥트 링크 있음");
  }
  if (activeAffiliateLinks.length > 0) {
    score += 10;
    reasons.push("범용 제휴 링크 있음");
  }
  if (
    contentPackage !== null &&
    hasTopicMatch({
      topicTitle: contentPackage.topic.title,
      category: product.category,
      productName: product.productName,
    })
  ) {
    score += 10;
    reasons.push("콘텐츠 주제와 상품 맥락 일치");
  }

  return {
    product_id: product.id,
    content_package_id: input.content_package_id ?? null,
    shopping_connect_score: clampScore(score),
    reasons,
    active_link_count: activeShoppingLinks.length + activeAffiliateLinks.length,
    stale_price: isOlderThanSevenDays(product.priceCheckedAt),
  };
}

export async function recommendShoppingConnectPlacement(
  input: z.infer<typeof shoppingConnectPlacementSchema>,
) {
  const product = await prisma.product.findUnique({
    where: { id: input.product_id },
    include: {
      shoppingConnectLinks: { where: { isActive: true } },
      affiliateLinks: { where: { isActive: true } },
    },
  });
  const contentPackage = await prisma.contentPackage.findUnique({
    where: { id: input.content_package_id },
    include: { topic: true, drafts: { orderBy: { updatedAt: "desc" }, take: 1 } },
  });
  if (product === null || contentPackage === null) {
    return null;
  }

  const primaryLink =
    product.shoppingConnectLinks[0]?.shoppingConnectUrl ??
    product.affiliateLinks[0]?.affiliateUrl ??
    null;
  const firstDraft = contentPackage.drafts[0] ?? null;

  return {
    product_id: product.id,
    content_package_id: contentPackage.id,
    primary_url: primaryLink,
    placements: [
      {
        slot: "first_screen",
        label: "첫 화면 하단",
        guidance:
          firstDraft?.firstScreen === null
            ? "첫 화면 문구를 만든 뒤 문제 해결 흐름 바로 아래에 상품 링크를 배치"
            : "첫 화면 문구 뒤에 비교 기준과 함께 상품 링크를 1회 노출",
      },
      {
        slot: "comparison_table",
        label: "비교표 아래",
        guidance: "가격과 장단점 비교 후 가장 자연스럽게 구매 판단 CTA를 배치",
      },
      {
        slot: "closing_cta",
        label: "마무리 CTA",
        guidance: "가격 기준일과 대가성 문구를 함께 노출하고 본문 끝에서 재확인 유도",
      },
    ],
  };
}
