import { ExportFormat, PackageStatus, type Prisma } from "@prisma/client";
import { z } from "zod";
import { MockAIAdapter } from "@/lib/ai/mockAdapter";
import { getOrCreateCompanyProfile } from "@/lib/company-profile/service";
import { runComplianceCheck } from "@/lib/compliance/service";
import {
  listContentPackageRecords,
  loadContentPackageRecord,
  transitionContentPackageStatus,
} from "@/lib/content/repository";
import { serializeContentPackage, serializeDraft } from "@/lib/content/serializers";
import {
  createHomefeedTitleCandidates,
  createThumbnailCandidates,
} from "@/lib/content/titleCandidates";
import { prisma } from "@/lib/db";
import { AI_GENERATION_COST_USD, assertAiBudgetAllows } from "@/lib/logging/costBudget";
import { recordCostLog } from "@/lib/logging/costLogger";
import { serializeProduct } from "@/lib/products/service";

export const contentPackageCreateSchema = z.object({
  paperclip_decision_id: z.string().min(1),
});

export const draftPatchSchema = z.object({
  body_markdown: z.string().min(1),
});

export const packageIdSchema = z.object({
  content_package_id: z.string().min(1),
});

export const contentPackageStatusPatchSchema = z.object({
  status: z.nativeEnum(PackageStatus),
  reason: z.string().trim().min(1).optional(),
});

export async function createOrBriefContentPackage(
  input: z.infer<typeof contentPackageCreateSchema>,
) {
  const existing = await prisma.contentPackage.findFirst({
    where: { paperclipDecisionId: input.paperclip_decision_id },
  });
  if (existing === null) {
    return null;
  }

  const previousStatus = existing.status;
  await transitionContentPackageStatus({
    id: existing.id,
    fromStatus: previousStatus,
    toStatus: PackageStatus.brief_created,
    progress: 0.1,
    reason: "Brief created",
  });
  const contentPackage = await loadContentPackageRecord(existing.id);
  return contentPackage === null ? null : serializeContentPackage(contentPackage);
}

export async function listContentPackages(status: PackageStatus | null) {
  const packages = await listContentPackageRecords(status);
  return packages.map(serializeContentPackage);
}

export async function getContentPackage(id: string) {
  const contentPackage = await loadContentPackageRecord(id);
  return contentPackage === null ? null : serializeContentPackage(contentPackage);
}

export async function updateContentPackageStatus(
  id: string,
  input: z.infer<typeof contentPackageStatusPatchSchema>,
) {
  const contentPackage = await loadContentPackageRecord(id);
  if (contentPackage === null) {
    return null;
  }
  if (input.status === PackageStatus.compliance_checked) {
    const check = await runComplianceCheck({ content_package_id: id });
    if (check !== null) {
      return getContentPackage(id);
    }
  }
  if (contentPackage.status === input.status) {
    return serializeContentPackage(contentPackage);
  }
  await transitionContentPackageStatus({
    id,
    fromStatus: contentPackage.status,
    toStatus: input.status,
    actor: "owner",
    reason: input.reason ?? "HQ kanban status update",
  });
  return getContentPackage(id);
}

export async function generateContentPackage(id: string) {
  const contentPackage = await loadContentPackageRecord(id);
  if (contentPackage === null) {
    return null;
  }

  const budget = await assertAiBudgetAllows({
    pipelineStep: "content",
    task: "generateBlogDraft",
    estimatedCostUsd: AI_GENERATION_COST_USD.contentBlogDraft,
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
  const products = contentPackage.shoppingConnectLinks.map((link) =>
    serializeProduct(link.product),
  );
  const output = await adapter.generateBlogDraft({
    topic: contentPackage.topic.title,
    products,
    companyProfile,
  });
  const faq: Prisma.InputJsonValue = output.faq.map((item) => ({
    question: item.question,
    answer: item.answer,
  }));
  const previousStatus = contentPackage.status;

  const draft = await prisma.draft.create({
    data: {
      contentPackageId: id,
      channel: "naver_blog",
      homefeedTitle: output.homefeed_title,
      searchTitle: output.search_title,
      thumbnailText: output.thumbnail_text,
      firstScreen: output.first_screen,
      bodyMarkdown: output.body_markdown,
      comparisonTable: output.comparison_table ?? null,
      faq,
      disclosureText: output.disclosure_text ?? null,
      priceNotice: output.price_notice ?? null,
      originalBody: output.body_markdown,
    },
  });

  const candidates = [
    ...createHomefeedTitleCandidates(contentPackage.topic.title),
    ...createThumbnailCandidates(contentPackage.topic.title),
  ];
  await prisma.titleCandidate.createMany({
    data: candidates.map((candidate) => ({
      contentPackageId: id,
      kind: candidate.kind,
      text: candidate.text,
      hookType: candidate.hook_type ?? null,
      selected: candidate.selected,
    })),
  });

  await transitionContentPackageStatus({
    id,
    fromStatus: previousStatus,
    toStatus: PackageStatus.blog_draft_generated,
    progress: 0.55,
    reason: "Blog draft generated",
  });
  await recordCostLog({
    model: "mock",
    task: "generateBlogDraft",
    pipelineStep: "content",
    inputTokens: 1200,
    outputTokens: 1800,
    costUsd: AI_GENERATION_COST_USD.contentBlogDraft,
    blockedByCap: false,
  });

  return {
    kind: "generated" as const,
    draft: serializeDraft(draft),
    content_package: await getContentPackage(id),
  };
}

export async function updateDraft(id: string, input: z.infer<typeof draftPatchSchema>) {
  const draft = await prisma.draft
    .update({
      where: { id },
      data: { bodyMarkdown: input.body_markdown },
    })
    .catch(() => null);
  return draft === null ? null : serializeDraft(draft);
}

export function parsePackageStatus(value: string | null): PackageStatus | null {
  if (value === null) {
    return null;
  }
  const parsed = z.nativeEnum(PackageStatus).safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function exportFormatFromString(value: string | null): ExportFormat | null {
  if (value === null) {
    return null;
  }
  const parsed = z.nativeEnum(ExportFormat).safeParse(value);
  return parsed.success ? parsed.data : null;
}
