import type { Prisma } from "@prisma/client";
import type { ContentPackageRecord } from "@/lib/content/repository";
import { serializeProduct, serializeShoppingConnectLink } from "@/lib/products/service";

export type SerializedDraft = {
  readonly id: string;
  readonly channel: string;
  readonly homefeed_title: readonly string[];
  readonly search_title: string | null;
  readonly thumbnail_text: readonly string[];
  readonly first_screen: string | null;
  readonly body_markdown: string | null;
  readonly comparison_table: string | null;
  readonly faq: Prisma.JsonValue;
  readonly disclosure_text: string | null;
  readonly price_notice: string | null;
  readonly original_body: string | null;
  readonly status: string;
  readonly updated_at: string;
};

export function serializeDraft(draft: ContentPackageRecord["drafts"][number]): SerializedDraft {
  return {
    id: draft.id,
    channel: draft.channel,
    homefeed_title: draft.homefeedTitle,
    search_title: draft.searchTitle,
    thumbnail_text: draft.thumbnailText,
    first_screen: draft.firstScreen,
    body_markdown: draft.bodyMarkdown,
    comparison_table: draft.comparisonTable,
    faq: draft.faq,
    disclosure_text: draft.disclosureText,
    price_notice: draft.priceNotice,
    original_body: draft.originalBody,
    status: draft.status,
    updated_at: draft.updatedAt.toISOString(),
  };
}

function serializeContentComplianceIssue(
  issue: ContentPackageRecord["complianceChecks"][number]["complianceIssues"][number],
) {
  const dismissal =
    issue.dismissedAt === null
      ? null
      : {
          dismissed_at: issue.dismissedAt.toISOString(),
          dismissed_by: issue.dismissedBy,
          reason: issue.dismissReason,
        };

  return {
    id: issue.id,
    issue_type: issue.issueType,
    severity: issue.severity,
    message: issue.message,
    suggested_fix: issue.suggestedFix,
    blocks_export:
      issue.severity === "high" || (issue.severity === "medium" && issue.dismissedAt === null),
    dismissed: dismissal !== null,
    dismissed_at: dismissal?.dismissed_at ?? null,
    dismissed_by: dismissal?.dismissed_by ?? null,
    dismiss_reason: dismissal?.reason ?? null,
    dismissal,
  };
}

export function serializeContentPackage(contentPackage: ContentPackageRecord) {
  const memo = contentPackage.paperclipDecision.opportunityMemo;
  return {
    id: contentPackage.id,
    topic: {
      id: contentPackage.topic.id,
      title: contentPackage.topic.title,
      description: contentPackage.topic.description,
    },
    opportunity_memo:
      memo === null
        ? null
        : {
            id: memo.id,
            topic: memo.topic,
            why_now: memo.whyNow,
            homefeed_angle: memo.homefeedAngle,
            search_angle: memo.searchAngle,
            interest_tags: memo.interestTags,
            homefeed_score: memo.homefeedScore,
            search_score: memo.searchScore,
            revenue_score: memo.revenueScore,
            risk_score: memo.riskScore,
            score_reasons: memo.scoreReasons,
            keyword_clusters: memo.keywordClusters.map((cluster) => ({
              id: cluster.id,
              primary_keyword: cluster.primaryKeyword,
              related_keywords: cluster.relatedKeywords,
              search_volume: cluster.searchVolume,
              competition_score: cluster.competitionScore,
            })),
          },
    status: contentPackage.status,
    publish_readiness: contentPackage.publishReadiness,
    progress: contentPackage.progress,
    paperclip_decision_id: contentPackage.paperclipDecisionId,
    drafts: contentPackage.drafts.map(serializeDraft),
    title_candidates: contentPackage.titleCandidates.map((candidate) => ({
      id: candidate.id,
      kind: candidate.kind,
      text: candidate.text,
      hook_type: candidate.hookType,
      selected: candidate.selected,
    })),
    compliance_checks: contentPackage.complianceChecks.map((check) => ({
      id: check.id,
      risk_level: check.riskLevel,
      pass: check.pass,
      export_allowed: check.exportAllowed,
      checked_at: check.checkedAt.toISOString(),
      issues: check.complianceIssues.map(serializeContentComplianceIssue),
    })),
    sns_variants: contentPackage.snsVariants.map((variant) => ({
      id: variant.id,
      platform: variant.platform,
      format: variant.format,
      hook: variant.hook,
      body: variant.body,
      cta: variant.cta,
      hashtags: variant.hashtags,
      score: variant.score,
      created_at: variant.createdAt.toISOString(),
    })),
    exports: contentPackage.exports.map((exportRecord) => ({
      id: exportRecord.id,
      format: exportRecord.format,
      created_at: exportRecord.createdAt.toISOString(),
    })),
    products: contentPackage.shoppingConnectLinks.map((link) => serializeProduct(link.product)),
    shopping_connect_links: contentPackage.shoppingConnectLinks.map(serializeShoppingConnectLink),
    updated_at: contentPackage.updatedAt.toISOString(),
  };
}
