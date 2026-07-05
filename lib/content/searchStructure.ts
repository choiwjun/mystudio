import { PackageStatus, type Prisma } from "@prisma/client";
import { z } from "zod";
import { MockAIAdapter } from "@/lib/ai/mockAdapter";
import { getOrCreateCompanyProfile } from "@/lib/company-profile/service";
import { loadContentPackageRecord, transitionContentPackageStatus } from "@/lib/content/repository";
import { serializeDraft } from "@/lib/content/serializers";
import { prisma } from "@/lib/db";
import { AI_GENERATION_COST_USD, assertAiBudgetAllows } from "@/lib/logging/costBudget";
import { recordCostLog } from "@/lib/logging/costLogger";
import { serializeProduct } from "@/lib/products/service";

export const searchStructureSchema = z.object({
  content_package_id: z.string().min(1),
});

function markdownFromHeadings(headings: readonly string[]): string {
  return headings.map((heading) => `## ${heading}`).join("\n\n");
}

export async function generateSearchStructure(input: z.infer<typeof searchStructureSchema>) {
  const contentPackage = await loadContentPackageRecord(input.content_package_id);
  if (contentPackage === null) {
    return null;
  }

  const budget = await assertAiBudgetAllows({
    pipelineStep: "content",
    task: "generateSearchStructure",
    estimatedCostUsd: AI_GENERATION_COST_USD.searchStructure,
  });
  if (budget.kind === "blocked") {
    return {
      kind: "blocked_by_budget" as const,
      error: budget.error,
      budget: budget.budget,
    };
  }

  const adapter = new MockAIAdapter();
  const companyProfile = await getOrCreateCompanyProfile();
  const output = await adapter.generateSearchStructure({
    topic: contentPackage.topic.title,
    products: contentPackage.shoppingConnectLinks.map((link) => serializeProduct(link.product)),
    companyProfile,
  });
  const faq: Prisma.InputJsonValue = output.faq.map((item) => ({
    question: item.question,
    answer: item.answer,
  }));
  const draft = contentPackage.drafts[0];
  const savedDraft =
    draft === undefined
      ? await prisma.draft.create({
          data: {
            contentPackageId: contentPackage.id,
            channel: "naver_blog",
            homefeedTitle: [],
            searchTitle: output.search_title,
            thumbnailText: [],
            firstScreen: markdownFromHeadings(output.h2),
            bodyMarkdown: markdownFromHeadings(output.h2),
            comparisonTable: output.comparison_table,
            faq,
          },
        })
      : await prisma.draft.update({
          where: { id: draft.id },
          data: {
            searchTitle: output.search_title,
            firstScreen: draft.firstScreen ?? markdownFromHeadings(output.h2),
            comparisonTable: output.comparison_table,
            faq,
          },
        });

  await transitionContentPackageStatus({
    id: contentPackage.id,
    fromStatus: contentPackage.status,
    toStatus: PackageStatus.search_structured,
    progress: 0.35,
    reason: "Search structure generated",
  });
  await recordCostLog({
    model: "mock",
    task: "generateSearchStructure",
    pipelineStep: "content",
    inputTokens: 900,
    outputTokens: 900,
    costUsd: AI_GENERATION_COST_USD.searchStructure,
    blockedByCap: false,
  });

  return {
    kind: "generated" as const,
    search_title: output.search_title,
    h2: output.h2,
    faq: output.faq,
    comparison_table: output.comparison_table,
    draft: serializeDraft(savedDraft),
  };
}
