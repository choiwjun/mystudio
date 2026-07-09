import { PackageStatus, type Prisma } from "@prisma/client";
import { z } from "zod";
import { createRuntimeAIAdapterFromConfiguredCredentials } from "@/lib/ai/runtime";
import { getOrCreateCompanyProfile } from "@/lib/company-profile/service";
import { loadContentGenerationContext } from "@/lib/content/generationContext";
import { serializeActivePlacementProducts } from "@/lib/content/placement";
import { loadContentPackageRecord, transitionContentPackageStatus } from "@/lib/content/repository";
import { serializeDraft } from "@/lib/content/serializers";
import { prisma } from "@/lib/db";
import { AI_GENERATION_COST_USD, assertAiBudgetAllows } from "@/lib/logging/costBudget";
import { recordCostLog } from "@/lib/logging/costLogger";

export const searchStructureSchema = z.object({
  content_package_id: z.string().min(1),
});

function markdownFromHeadings(headings: readonly string[]): string {
  return headings.map((heading) => `## ${heading}`).join("\n\n");
}

const searchStructureTransitionStatuses: ReadonlySet<PackageStatus> = new Set([
  PackageStatus.selected,
  PackageStatus.assigned,
  PackageStatus.brief_created,
  PackageStatus.homefeed_packaged,
]);

function shouldTransitionToSearchStructured(status: PackageStatus): boolean {
  return searchStructureTransitionStatuses.has(status);
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

  const adapter = await createRuntimeAIAdapterFromConfiguredCredentials();
  const companyProfile = await getOrCreateCompanyProfile();
  const generationContext = await loadContentGenerationContext({
    task: "generateSearchStructure",
    topic: contentPackage.topic.title,
    shoppingConnectLinks: contentPackage.shoppingConnectLinks,
    companyProfile,
  });
  const output = await adapter.generateSearchStructure({
    topic: contentPackage.topic.title,
    products: serializeActivePlacementProducts(contentPackage.shoppingConnectLinks),
    companyProfile,
    generationContext,
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

  if (shouldTransitionToSearchStructured(contentPackage.status)) {
    await transitionContentPackageStatus({
      id: contentPackage.id,
      fromStatus: contentPackage.status,
      toStatus: PackageStatus.search_structured,
      progress: Math.max(contentPackage.progress ?? 0, 0.35),
      reason: "Search structure generated",
    });
  }
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
