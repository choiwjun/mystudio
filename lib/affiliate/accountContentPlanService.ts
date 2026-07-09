import { buildAffiliateAccountContentPlan } from "@/lib/affiliate/accountStrategy";
import { prisma } from "@/lib/db";

export async function getAffiliateAccountContentPlan(accountId: string) {
  const account = await prisma.affiliateAccount.findUnique({
    where: { id: accountId },
  });
  if (account === null) {
    return null;
  }

  const products = await prisma.product.findMany({
    where: {
      affiliateLinks: { some: { accountId, isActive: true } },
    },
    include: {
      affiliateLinks: { where: { accountId, isActive: true } },
      revenueLogs: {
        orderBy: { orderedAt: "desc" },
        take: 20,
      },
    },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });

  return buildAffiliateAccountContentPlan({
    account: {
      id: account.id,
      platform: account.platform,
      accountName: account.accountName,
      affiliateProgram: account.affiliateProgram,
      categoryFocus: account.categoryFocus,
      snsTargets: account.snsTargets,
      hookStyle: account.hookStyle ?? "",
    },
    products: products.map((product) => ({
      id: product.id,
      productName: product.productName,
      category: product.category,
      price: product.price,
      popularityScore: product.popularityScore,
      popularityRank: product.popularityRank,
      popularitySource: product.popularitySource,
      revenueAmount: product.revenueLogs.reduce((sum, log) => sum + log.amount, 0),
      activeAffiliateLinks: product.affiliateLinks.map((link) => ({
        accountId: link.accountId,
        affiliateUrl: link.affiliateUrl,
        commissionRate: link.commissionRate,
      })),
    })),
  });
}
