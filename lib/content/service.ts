import { ExportFormat, PackageStatus, Prisma } from "@prisma/client";
import { z } from "zod";
import type { BlogDraftOutput } from "@/lib/ai/adapter";
import { createRuntimeAIAdapter } from "@/lib/ai/runtime";
import { getOrCreateCompanyProfile } from "@/lib/company-profile/service";
import { runComplianceCheck } from "@/lib/compliance/service";
import { loadContentGenerationContext } from "@/lib/content/generationContext";
import { serializeActivePlacementProducts } from "@/lib/content/placement";
import {
  listContentPackageRecords,
  loadContentPackageRecord,
  transitionContentPackageStatus,
  updateContentPackageProgress,
} from "@/lib/content/repository";
import { serializeContentPackage, serializeDraft } from "@/lib/content/serializers";
import {
  createHomefeedTitleCandidates,
  createThumbnailCandidates,
  type TitleCandidateInput,
} from "@/lib/content/titleCandidates";
import { prisma } from "@/lib/db";
import { AI_GENERATION_COST_USD, assertAiBudgetAllows } from "@/lib/logging/costBudget";
import { recordCostLog } from "@/lib/logging/costLogger";

type CandidateKey = `${string}\u0000${string}`;

function isRecordNotFoundError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025";
}

type GeneratedTitleCandidate = TitleCandidateInput & {
  readonly kind: "homefeed" | "search" | "thumbnail";
};

function titleCandidateKey(candidate: {
  readonly kind: string;
  readonly text: string;
}): CandidateKey {
  return `${candidate.kind}\u0000${candidate.text.trim()}`;
}

function uniqueTitleCandidates(
  candidates: readonly GeneratedTitleCandidate[],
): readonly GeneratedTitleCandidate[] {
  const seen = new Set<CandidateKey>();
  return candidates.filter((candidate) => {
    const text = candidate.text.trim();
    if (text.length === 0) {
      return false;
    }
    const key = titleCandidateKey({ kind: candidate.kind, text });
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function buildGeneratedTitleCandidates(
  output: BlogDraftOutput,
  topic: string,
): readonly GeneratedTitleCandidate[] {
  const aiHomefeed: GeneratedTitleCandidate[] = output.homefeed_title.map((text, index) => ({
    kind: "homefeed",
    text,
    selected: index === 0,
  }));
  const aiSearch: GeneratedTitleCandidate[] = [
    { kind: "search", text: output.search_title, selected: true },
  ];
  const aiThumbnails: GeneratedTitleCandidate[] = output.thumbnail_text.map((text, index) => ({
    kind: "thumbnail",
    text,
    selected: index === 0,
  }));
  const deterministicHomefeed = createHomefeedTitleCandidates(topic).map((candidate) => ({
    ...candidate,
    selected: false,
  }));
  const deterministicThumbnails = createThumbnailCandidates(topic).map((candidate) => ({
    ...candidate,
    selected: false,
  }));

  return uniqueTitleCandidates([
    ...aiHomefeed,
    ...aiSearch,
    ...aiThumbnails,
    ...deterministicHomefeed,
    ...deterministicThumbnails,
  ]);
}
const blogDraftTransitionStatuses: ReadonlySet<PackageStatus> = new Set([
  PackageStatus.selected,
  PackageStatus.assigned,
  PackageStatus.brief_created,
  PackageStatus.homefeed_packaged,
  PackageStatus.search_structured,
  PackageStatus.revenue_links_attached,
]);

function shouldTransitionToBlogDraftGenerated(status: PackageStatus): boolean {
  return blogDraftTransitionStatuses.has(status);
}

async function replaceTitleCandidates(id: string, candidates: readonly GeneratedTitleCandidate[]) {
  await prisma.titleCandidate.deleteMany({
    where: { contentPackageId: id },
  });
  if (candidates.length === 0) {
    return;
  }

  await prisma.titleCandidate.createMany({
    data: candidates.map((candidate) => ({
      contentPackageId: id,
      kind: candidate.kind,
      text: candidate.text.trim(),
      hookType: candidate.hook_type ?? null,
      selected: candidate.selected,
    })),
  });
}

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
export type ContentPackageStatusBlockedReason = "draft_required";

export class ContentPackageStatusBlockedError extends Error {
  readonly reason: ContentPackageStatusBlockedReason;

  constructor(reason: ContentPackageStatusBlockedReason, message: string) {
    super(message);
    this.name = "ContentPackageStatusBlockedError";
    this.reason = reason;
  }
}

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
  if (contentPackage.status === input.status) {
    return serializeContentPackage(contentPackage);
  }
  if (input.status === PackageStatus.compliance_checked) {
    if (contentPackage.drafts.length === 0) {
      throw new ContentPackageStatusBlockedError(
        "draft_required",
        "A draft is required before compliance review.",
      );
    }
    const check = await runComplianceCheck({ content_package_id: id });
    if (check !== null) {
      return getContentPackage(id);
    }
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

  const adapter = createRuntimeAIAdapter();
  const companyProfile = await getOrCreateCompanyProfile();
  const products = serializeActivePlacementProducts(contentPackage.shoppingConnectLinks);
  const generationContext = await loadContentGenerationContext({
    task: "generateBlogDraft",
    topic: contentPackage.topic.title,
    shoppingConnectLinks: contentPackage.shoppingConnectLinks,
    companyProfile,
  });
  const output = await adapter.generateBlogDraft({
    topic: contentPackage.topic.title,
    products,
    companyProfile,
    generationContext,
  });
  const faq: Prisma.InputJsonValue = output.faq.map((item) => ({
    question: item.question,
    answer: item.answer,
  }));
  const previousStatus = contentPackage.status;

  const existingDraft = contentPackage.drafts.find((item) => item.channel === "naver_blog");
  const draft =
    existingDraft === undefined
      ? await prisma.draft.create({
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
        })
      : await prisma.draft.update({
          where: { id: existingDraft.id },
          data: {
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

  await replaceTitleCandidates(
    id,
    buildGeneratedTitleCandidates(output, contentPackage.topic.title),
  );

  if (shouldTransitionToBlogDraftGenerated(previousStatus)) {
    await transitionContentPackageStatus({
      id,
      fromStatus: previousStatus,
      toStatus: PackageStatus.blog_draft_generated,
      progress: 0.55,
      reason: "Blog draft generated",
    });
  } else {
    await updateContentPackageProgress({
      id,
      progress: Math.max(contentPackage.progress ?? 0, 0.55),
    });
  }
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
  try {
    const draft = await prisma.draft.update({
      where: { id },
      data: { bodyMarkdown: input.body_markdown },
    });
    return serializeDraft(draft);
  } catch (error) {
    if (isRecordNotFoundError(error)) {
      return null;
    }
    throw error;
  }
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
