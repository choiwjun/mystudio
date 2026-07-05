import { prisma } from "@/lib/db";
import { summarizeHookTypeStats } from "@/lib/memory/patterns";
import {
  isOlderThanSevenDays,
  serializeProduct,
  serializeShoppingConnectLink,
} from "@/lib/products/service";

export async function getWinningPatterns() {
  const [performanceLogs, products, links] = await Promise.all([
    prisma.performanceLog.findMany({ orderBy: { recordedAt: "desc" } }),
    prisma.product.findMany({ orderBy: { updatedAt: "desc" } }),
    prisma.shoppingConnectLink.findMany({
      include: { product: true },
      orderBy: { updatedAt: "desc" },
    }),
  ]);
  const staleProducts = products.filter((product) => isOlderThanSevenDays(product.priceCheckedAt));
  const staleLinks = links.filter((link) => isOlderThanSevenDays(link.linkCheckedAt));

  return {
    hook_type_stats: summarizeHookTypeStats(
      performanceLogs.map((log) => ({ hook_type: log.hookType, views: log.views })),
    ),
    top_product_categories: products
      .filter((product) => product.category !== null)
      .slice(0, 5)
      .map((product) => ({
        category: product.category,
        product_name: product.productName,
        price: product.price,
      })),
    refresh_candidates: {
      stale_products_count: staleProducts.length,
      stale_links_count: staleLinks.length,
      stale_products: staleProducts.map((product) => serializeProduct(product)),
      stale_links: staleLinks.map(serializeShoppingConnectLink),
    },
  };
}
