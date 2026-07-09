import { prisma } from "@/lib/db";
import { COMPANY_MEMORY_MIN_SAMPLE_COUNT, summarizeHookTypeStats } from "@/lib/memory/patterns";
import {
  isOlderThanSevenDays,
  serializeProduct,
  serializeShoppingConnectLink,
} from "@/lib/products/service";

type ProductCategoryEvidence = {
  readonly category: string;
  productName: string;
  price: number | null;
  revenue: number;
  views: number;
  clicks: number;
  updatedAt: Date;
};

function upsertCategoryEvidence(
  categories: Map<string, ProductCategoryEvidence>,
  input: {
    readonly category: string | null;
    readonly productName: string;
    readonly price: number | null;
    readonly revenue?: number;
    readonly views?: number;
    readonly clicks?: number;
    readonly updatedAt: Date;
  },
): void {
  if (input.category === null) {
    return;
  }
  const previous = categories.get(input.category);
  if (previous === undefined) {
    categories.set(input.category, {
      category: input.category,
      productName: input.productName,
      price: input.price,
      revenue: input.revenue ?? 0,
      views: input.views ?? 0,
      clicks: input.clicks ?? 0,
      updatedAt: input.updatedAt,
    });
    return;
  }

  previous.revenue += input.revenue ?? 0;
  previous.views += input.views ?? 0;
  previous.clicks += input.clicks ?? 0;
  if (input.updatedAt > previous.updatedAt) {
    previous.productName = input.productName;
    previous.price = input.price;
    previous.updatedAt = input.updatedAt;
  }
}

export function buildTopProductCategories(input: {
  readonly revenueLogs: readonly {
    readonly amount: number;
    readonly orderedAt: Date;
    readonly product: {
      readonly category: string | null;
      readonly productName: string;
      readonly price: number | null;
    };
  }[];
  readonly performanceLogs: readonly {
    readonly directRevenue: number | null;
    readonly views: number;
    readonly clicks: number | null;
    readonly recordedAt: Date;
    readonly contentPackage: {
      readonly shoppingConnectLinks: readonly {
        readonly isActive: boolean;
        readonly product: {
          readonly category: string | null;
          readonly productName: string;
          readonly price: number | null;
        };
      }[];
    };
  }[];
}) {
  const categories = new Map<string, ProductCategoryEvidence>();

  for (const revenueLog of input.revenueLogs) {
    upsertCategoryEvidence(categories, {
      category: revenueLog.product.category,
      productName: revenueLog.product.productName,
      price: revenueLog.product.price,
      revenue: revenueLog.amount,
      updatedAt: revenueLog.orderedAt,
    });
  }

  for (const performanceLog of input.performanceLogs) {
    const activeCategories = new Map<
      string,
      { readonly productName: string; readonly price: number | null }
    >();
    for (const link of performanceLog.contentPackage.shoppingConnectLinks) {
      const category = link.product.category?.trim();
      if (!link.isActive || category === undefined || category.length === 0) {
        continue;
      }
      if (!activeCategories.has(category)) {
        activeCategories.set(category, {
          productName: link.product.productName,
          price: link.product.price,
        });
      }
    }
    const categoryCount = activeCategories.size;
    if (categoryCount === 0) {
      continue;
    }
    for (const [category, product] of activeCategories.entries()) {
      upsertCategoryEvidence(categories, {
        category,
        productName: product.productName,
        price: product.price,
        revenue: (performanceLog.directRevenue ?? 0) / categoryCount,
        views: performanceLog.views / categoryCount,
        clicks: (performanceLog.clicks ?? 0) / categoryCount,
        updatedAt: performanceLog.recordedAt,
      });
    }
  }

  return [...categories.values()]
    .sort(
      (left, right) =>
        right.revenue - left.revenue ||
        right.views - left.views ||
        right.clicks - left.clicks ||
        right.updatedAt.getTime() - left.updatedAt.getTime(),
    )
    .slice(0, 5)
    .map((category) => ({
      category: category.category,
      product_name: category.productName,
      price: category.price,
    }));
}

export async function getWinningPatterns() {
  const [performanceLogs, products, links, revenueLogs] = await Promise.all([
    prisma.performanceLog.findMany({
      include: {
        contentPackage: { include: { shoppingConnectLinks: { include: { product: true } } } },
      },
      orderBy: { recordedAt: "desc" },
    }),
    prisma.product.findMany({ orderBy: { updatedAt: "desc" } }),
    prisma.shoppingConnectLink.findMany({
      include: { product: true },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.revenueLog.findMany({
      include: { product: true },
      orderBy: { orderedAt: "desc" },
    }),
  ]);
  const staleProducts = products.filter((product) => isOlderThanSevenDays(product.priceCheckedAt));
  const staleLinks = links.filter((link) => isOlderThanSevenDays(link.linkCheckedAt));

  return {
    hook_type_stats: summarizeHookTypeStats(
      performanceLogs.map((log) => ({ hook_type: log.hookType, views: log.views })),
    ).filter((stat) => stat.sample_count >= COMPANY_MEMORY_MIN_SAMPLE_COUNT),
    top_product_categories: buildTopProductCategories({
      revenueLogs,
      performanceLogs,
    }),
    refresh_candidates: {
      stale_products_count: staleProducts.length,
      stale_links_count: staleLinks.length,
      stale_products: staleProducts.map((product) => serializeProduct(product)),
      stale_links: staleLinks.map(serializeShoppingConnectLink),
    },
  };
}
