type AffiliateStrategyAccount = {
  readonly id: string;
  readonly platform: string;
  readonly accountName: string;
  readonly affiliateProgram: string;
  readonly categoryFocus: readonly string[];
  readonly snsTargets: readonly string[];
  readonly hookStyle: string;
};

type AffiliateStrategyLink = {
  readonly accountId: string | null;
  readonly affiliateUrl: string;
  readonly commissionRate: number | null;
};

type AffiliateStrategyProduct = {
  readonly id: string;
  readonly productName: string;
  readonly category: string | null;
  readonly price: number | null;
  readonly popularityScore: number | null;
  readonly popularityRank: number | null;
  readonly popularitySource: string | null;
  readonly revenueAmount: number;
  readonly activeAffiliateLinks: readonly AffiliateStrategyLink[];
};

type AffiliateAccountContentPlanInput = {
  readonly account: AffiliateStrategyAccount;
  readonly products: readonly AffiliateStrategyProduct[];
};

type AffiliateAccountProductPlan = {
  readonly product_id: string;
  readonly product_name: string;
  readonly category: string | null;
  readonly affiliate_url: string;
  readonly popularity_source: string | null;
  readonly score: number;
};

type AffiliateAccountContentPlan = {
  readonly account_id: string;
  readonly account_name: string;
  readonly sns_targets: readonly string[];
  readonly selected_product: AffiliateAccountProductPlan | null;
  readonly hook_ment: string;
  readonly reasons: readonly string[];
};

function normalizeText(value: string | null | undefined): string {
  return value?.trim().toLocaleLowerCase("ko-KR") ?? "";
}

function categoryMatches(
  account: AffiliateStrategyAccount,
  product: AffiliateStrategyProduct,
): boolean {
  const category = normalizeText(product.category);
  return account.categoryFocus.some((focus) => {
    const normalizedFocus = normalizeText(focus);
    return normalizedFocus.length > 0 && category.includes(normalizedFocus);
  });
}

function accountLink(
  account: AffiliateStrategyAccount,
  product: AffiliateStrategyProduct,
): AffiliateStrategyLink | null {
  return (
    product.activeAffiliateLinks.find((link) => link.accountId === account.id) ??
    product.activeAffiliateLinks[0] ??
    null
  );
}

function scoreProduct(
  account: AffiliateStrategyAccount,
  product: AffiliateStrategyProduct,
): number {
  const link = accountLink(account, product);
  if (link === null) {
    return 0;
  }
  let score = 30;
  if (categoryMatches(account, product)) {
    score += 40;
  }
  score += Math.min(30, Math.max(0, Math.round(product.popularityScore ?? 0)));
  if (product.popularityRank !== null) {
    score += Math.max(0, 20 - Math.min(20, product.popularityRank - 1));
  }
  score += Math.min(20, Math.round(product.revenueAmount / 10_000));
  score += Math.min(10, Math.round(link.commissionRate ?? 0));
  return score;
}

function selectedProduct(
  account: AffiliateStrategyAccount,
  products: readonly AffiliateStrategyProduct[],
): AffiliateAccountProductPlan | null {
  const ranked = products
    .map((product) => ({
      product,
      link: accountLink(account, product),
      score: scoreProduct(account, product),
    }))
    .filter(
      (
        entry,
      ): entry is {
        readonly product: AffiliateStrategyProduct;
        readonly link: AffiliateStrategyLink;
        readonly score: number;
      } => entry.link !== null,
    )
    .sort(
      (left, right) =>
        right.score - left.score ||
        (right.product.popularityScore ?? 0) - (left.product.popularityScore ?? 0) ||
        (left.product.popularityRank ?? Number.MAX_SAFE_INTEGER) -
          (right.product.popularityRank ?? Number.MAX_SAFE_INTEGER) ||
        right.product.revenueAmount - left.product.revenueAmount ||
        left.product.productName.localeCompare(right.product.productName, "ko-KR"),
    )[0];

  if (ranked === undefined) {
    return null;
  }
  return {
    product_id: ranked.product.id,
    product_name: ranked.product.productName,
    category: ranked.product.category,
    affiliate_url: ranked.link.affiliateUrl,
    popularity_source: ranked.product.popularitySource,
    score: ranked.score,
  };
}

function hookMent(
  account: AffiliateStrategyAccount,
  product: AffiliateAccountProductPlan | null,
): string {
  if (product === null) {
    return `${account.accountName} 계정에 맞는 제휴 상품 후보를 먼저 연결하세요.`;
  }
  const style = account.hookStyle.trim() === "" ? "큐레이터 추천형" : account.hookStyle.trim();
  return `${account.accountName} ${style}: ${product.product_name}, 지금 고르기 전에 이 기준부터 보세요.`;
}

export function buildAffiliateAccountContentPlan(
  input: AffiliateAccountContentPlanInput,
): AffiliateAccountContentPlan {
  const product = selectedProduct(input.account, input.products);
  const reasons: string[] = product === null ? [] : ["활성 제휴 링크 있음"];
  if (
    product !== null &&
    input.account.categoryFocus.some((focus) =>
      normalizeText(product.category).includes(normalizeText(focus)),
    )
  ) {
    reasons.push("계정 카테고리 포커스와 일치");
  }
  if (product?.popularity_source !== null && product?.popularity_source !== undefined) {
    reasons.push(`${product.popularity_source} 인기 신호 반영`);
  }

  return {
    account_id: input.account.id,
    account_name: input.account.accountName,
    sns_targets: input.account.snsTargets,
    selected_product: product,
    hook_ment: hookMent(input.account, product),
    reasons,
  };
}
