import { ExportFormat, PackageStatus, Prisma } from "@prisma/client";
import { z } from "zod";
import type { BlogDraftOutput, SnsProfile, SnsVariantOutput } from "@/lib/ai/adapter";
import { createRuntimeAIAdapterFromConfiguredCredentials } from "@/lib/ai/runtime";
import { getOrCreateCompanyProfile } from "@/lib/company-profile/service";
import { runComplianceCheck } from "@/lib/compliance/service";
import { loadContentGenerationContext } from "@/lib/content/generationContext";
import { serializeActivePlacementProducts } from "@/lib/content/placement";
import {
  listContentPackageRecords,
  loadContentPackageRecord,
  transitionContentPackageStatus,
  updateContentPackageHomefeedScore,
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

function ensureMinimumCandidates(
  candidates: readonly GeneratedTitleCandidate[],
  topic: string,
): readonly GeneratedTitleCandidate[] {
  const base = topic.trim().length > 0 ? topic.trim() : "오늘의 콘텐츠";
  const next = [...candidates];
  for (const candidate of createHomefeedTitleCandidates(topic)) {
    next.push({ ...candidate, selected: false });
  }
  for (
    let index = 1;
    next.filter((candidate) => candidate.kind === "homefeed").length < 10;
    index += 1
  ) {
    next.push({
      kind: "homefeed",
      text: `${base} 핵심 체크포인트 ${index}`,
      selected: false,
    });
  }
  for (const candidate of createThumbnailCandidates(topic)) {
    next.push({ ...candidate, selected: false });
  }
  for (
    let index = 1;
    next.filter((candidate) => candidate.kind === "thumbnail").length < 5;
    index += 1
  ) {
    next.push({
      kind: "thumbnail",
      text: `${base.slice(0, 12)} 체크 ${index}`,
      selected: false,
    });
  }
  return uniqueTitleCandidates(next);
}

function minimumTexts(
  kind: "homefeed" | "thumbnail",
  candidates: readonly GeneratedTitleCandidate[],
  minimum: number,
): string[] {
  return candidates
    .filter((candidate) => candidate.kind === kind)
    .slice(0, minimum)
    .map((candidate) => candidate.text);
}

const snsProfiles: readonly SnsProfile[] = [
  { platform: "instagram", format: "carousel_6" },
  { platform: "threads", format: "thread" },
  { platform: "x", format: "post_set" },
] as const;

function clipVariantFromDraft(input: {
  readonly contentPackageId: string;
  readonly topic: string;
  readonly draft: NonNullable<
    Awaited<ReturnType<typeof loadContentPackageRecord>>
  >["drafts"][number];
}): Prisma.SNSVariantCreateManyInput {
  const title = input.draft.searchTitle ?? input.topic;
  const firstScreen = input.draft.firstScreen ?? `${title}를 30초 안에 정리합니다.`;
  return {
    contentPackageId: input.contentPackageId,
    platform: "naver_clip",
    format: ExportFormat.copy,
    hook: title,
    body: [
      "0-2초: 문제 제기",
      firstScreen,
      "3-20초: 핵심 기준 3가지를 짧게 보여줍니다.",
      "20-30초: 자세한 비교표와 링크는 블로그 본문에서 확인하도록 유도합니다.",
    ].join("\n"),
    cta: "자세한 비교는 블로그에서 확인하세요.",
    hashtags: ["#네이버클립", "#쇼핑정보", "#비교체크"],
    score: null,
  };
}

function snsVariantCreateInput(input: {
  readonly contentPackageId: string;
  readonly output: SnsVariantOutput;
}): Prisma.SNSVariantCreateManyInput {
  return {
    contentPackageId: input.contentPackageId,
    platform: input.output.platform,
    format: ExportFormat.copy,
    hook: input.output.hook ?? null,
    body: input.output.body,
    cta: input.output.cta ?? null,
    hashtags: [...input.output.hashtags],
    score: input.output.score ?? null,
  };
}

function faqFromJson(value: Prisma.JsonValue): BlogDraftOutput["faq"] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => {
      if (item === null || typeof item !== "object" || Array.isArray(item)) {
        return null;
      }
      const question = "question" in item ? item["question"] : null;
      const answer = "answer" in item ? item["answer"] : null;
      if (typeof question !== "string" || typeof answer !== "string") {
        return null;
      }
      return { question, answer };
    })
    .filter((item): item is BlogDraftOutput["faq"][number] => item !== null);
}

function draftToHomefeedScoringInput(
  draft: NonNullable<Awaited<ReturnType<typeof loadContentPackageRecord>>>["drafts"][number],
): BlogDraftOutput {
  const bodyMarkdown = draft.bodyMarkdown ?? "";
  const searchTitle = draft.searchTitle ?? draft.homefeedTitle[0] ?? "홈피드 초안";
  const homefeedTitle =
    draft.homefeedTitle.filter((title): title is string => title !== null).length > 0
      ? draft.homefeedTitle.filter((title): title is string => title !== null)
      : [searchTitle];
  const thumbnailText =
    draft.thumbnailText.filter((text): text is string => text !== null).length > 0
      ? draft.thumbnailText.filter((text): text is string => text !== null)
      : [searchTitle];
  return {
    homefeed_title: homefeedTitle,
    search_title: searchTitle,
    thumbnail_text: thumbnailText,
    first_screen: draft.firstScreen ?? bodyMarkdown.slice(0, 140),
    body_markdown: bodyMarkdown,
    comparison_table: draft.comparisonTable ?? undefined,
    faq: faqFromJson(draft.faq).slice(0, 3),
    disclosure_text: draft.disclosureText ?? undefined,
    price_notice: draft.priceNotice ?? undefined,
  };
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
  return ensureMinimumCandidates(
    uniqueTitleCandidates([...aiHomefeed, ...aiSearch, ...aiThumbnails]),
    topic,
  );
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

  const existingDraft = contentPackage.drafts.find((item) => item.channel === "naver_blog");
  if (existingDraft !== undefined && (existingDraft.bodyMarkdown?.trim().length ?? 0) > 0) {
    return {
      kind: "generated" as const,
      draft: serializeDraft(existingDraft),
      content_package: serializeContentPackage(contentPackage),
    };
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

  const adapter = await createRuntimeAIAdapterFromConfiguredCredentials();
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
  const generatedCandidates = buildGeneratedTitleCandidates(output, contentPackage.topic.title);
  const homefeedTitle = minimumTexts("homefeed", generatedCandidates, 10);
  const thumbnailText = minimumTexts("thumbnail", generatedCandidates, 5);
  const faq: Prisma.InputJsonValue = output.faq.map((item) => ({
    question: item.question,
    answer: item.answer,
  }));
  const previousStatus = contentPackage.status;

  const draft =
    existingDraft === undefined
      ? await prisma.draft.create({
          data: {
            contentPackageId: id,
            channel: "naver_blog",
            homefeedTitle,
            searchTitle: output.search_title,
            thumbnailText,
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
            homefeedTitle,
            searchTitle: output.search_title,
            thumbnailText,
            firstScreen: output.first_screen,
            bodyMarkdown: output.body_markdown,
            comparisonTable: output.comparison_table ?? null,
            faq,
            disclosureText: output.disclosure_text ?? null,
            priceNotice: output.price_notice ?? null,
            originalBody: output.body_markdown,
          },
        });

  await replaceTitleCandidates(id, generatedCandidates);

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

export async function generateSnsVariants(id: string) {
  const contentPackage = await loadContentPackageRecord(id);
  if (contentPackage === null) {
    return null;
  }
  const draft = contentPackage.drafts.find((item) => item.channel === "naver_blog");
  if (draft === undefined || (draft.bodyMarkdown?.trim().length ?? 0) === 0) {
    return { kind: "draft_required" as const };
  }

  const budget = await assertAiBudgetAllows({
    pipelineStep: "content",
    task: "generateSNSVariant",
    estimatedCostUsd: AI_GENERATION_COST_USD.snsVariant * snsProfiles.length,
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
  const products = serializeActivePlacementProducts(contentPackage.shoppingConnectLinks);
  const generationContext = await loadContentGenerationContext({
    task: "generateBlogDraft",
    topic: contentPackage.topic.title,
    shoppingConnectLinks: contentPackage.shoppingConnectLinks,
    companyProfile,
  });
  const outputs = await Promise.all(
    snsProfiles.map((profile) =>
      adapter.generateSNSVariant(
        {
          topic: contentPackage.topic.title,
          products,
          companyProfile,
          generationContext,
          sourceDraftMarkdown: draft.bodyMarkdown ?? "",
        },
        profile,
      ),
    ),
  );

  await prisma.sNSVariant.deleteMany({ where: { contentPackageId: id } });
  await prisma.sNSVariant.createMany({
    data: [
      clipVariantFromDraft({ contentPackageId: id, topic: contentPackage.topic.title, draft }),
      ...outputs.map((output) => snsVariantCreateInput({ contentPackageId: id, output })),
    ],
  });

  if (contentPackage.status !== PackageStatus.sns_repurposed) {
    await transitionContentPackageStatus({
      id,
      fromStatus: contentPackage.status,
      toStatus: PackageStatus.sns_repurposed,
      progress: Math.max(contentPackage.progress ?? 0, 0.7),
      reason: "SNS and clip variants generated",
      bypass: {
        kind: "admin_seed",
        actor: "admin",
        reason: "sns variants can be regenerated from an existing blog draft",
      },
    });
  }

  await recordCostLog({
    model: "mock",
    task: "generateSNSVariant",
    pipelineStep: "content",
    inputTokens: 900,
    outputTokens: 900,
    costUsd: AI_GENERATION_COST_USD.snsVariant * snsProfiles.length,
    blockedByCap: false,
  });

  return {
    kind: "generated" as const,
    content_package: await getContentPackage(id),
  };
}

export async function scoreContentPackageHomefeed(id: string) {
  const contentPackage = await loadContentPackageRecord(id);
  if (contentPackage === null) {
    return null;
  }
  const draft = contentPackage.drafts.find((item) => item.channel === "naver_blog");
  if (draft === undefined || (draft.bodyMarkdown?.trim().length ?? 0) === 0) {
    return { kind: "draft_required" as const };
  }

  const budget = await assertAiBudgetAllows({
    pipelineStep: "content",
    task: "scoreHomefeed",
    estimatedCostUsd: AI_GENERATION_COST_USD.homefeedScore,
  });
  if (budget.kind === "blocked") {
    return {
      kind: "blocked_by_budget" as const,
      error: budget.error,
      budget: budget.budget,
    };
  }

  const adapter = await createRuntimeAIAdapterFromConfiguredCredentials();
  const score = await adapter.scoreHomefeed(draftToHomefeedScoringInput(draft));
  const reasons = [
    `선택 제목 ${draft.homefeedTitle.length.toLocaleString("ko-KR")}개`,
    draft.firstScreen === null ? "첫 화면 문구 없음" : "첫 화면 문구 있음",
    draft.thumbnailText.length === 0 ? "썸네일 문구 없음" : "썸네일 문구 있음",
  ].join(" · ");

  await updateContentPackageHomefeedScore({
    id,
    score,
    reasons,
  });
  await recordCostLog({
    model: adapter.metadata.model,
    task: "scoreHomefeed",
    pipelineStep: "content",
    inputTokens: 700,
    outputTokens: 80,
    costUsd: AI_GENERATION_COST_USD.homefeedScore,
    blockedByCap: false,
  });

  return {
    kind: "scored" as const,
    content_package_id: id,
    provider: adapter.metadata.provider,
    model: adapter.metadata.model,
    homefeed_score: score,
    homefeed_reasons: reasons,
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
