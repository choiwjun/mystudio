import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const workspace = await prisma.workspace.upsert({
    where: { id: "default_workspace" },
    update: {},
    create: {
      id: "default_workspace",
      name: "default",
    },
  });

  await prisma.companyProfile.upsert({
    where: { id: "default_company_profile" },
    update: {},
    create: {
      id: "default_company_profile",
      workspaceId: workspace.id,
      companyName: "Paperclip Company",
      primaryCategories: ["자취", "계절", "청소"],
      blockedCategories: ["건강", "의료", "투자", "법률", "다이어트"],
      toneRules: "친근하지만 신뢰감 있게, 직접 써본 것처럼 단정하지 않는다.",
      contentPrinciples: "문제 중심, 출처 명시, 대가성 문구와 가격 기준일 우선.",
      revenueGoalMonthly: 500000,
    },
  });

  await prisma.policyRule.createMany({
    data: [
      {
        ruleType: "compliance",
        ruleCode: "shopping_connect_disclosure_required",
        description: "쇼핑커넥트 링크가 있으면 대가성 문구가 본문 상단에 필요하다.",
      },
      {
        ruleType: "compliance",
        ruleCode: "price_checked_at_required",
        description: "가격을 포함하면 가격 확인일과 변동 가능 문구가 필요하다.",
      },
      {
        ruleType: "content",
        ruleCode: "unused_product_review_forbidden",
        description: "직접 사용하지 않은 상품은 후기체로 단정하지 않는다.",
      },
    ],
    skipDuplicates: true,
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
