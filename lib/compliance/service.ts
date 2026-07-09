import { PackageStatus, type Prisma } from "@prisma/client";
import { z } from "zod";
import type { AIAdapter, ComplianceOutput } from "@/lib/ai/adapter";
import { createRuntimeAIAdapterFromConfiguredCredentials } from "@/lib/ai/runtime";
import {
  applyComplianceFixes,
  type ComplianceRuleIssue,
  evaluateCompliance,
  type PolicyRuleContext,
} from "@/lib/compliance/rules";
import { loadCompetitorSimilarityIssues } from "@/lib/compliance/similarity";
import {
  transitionContentPackageStatus,
  updateContentPackageProgress,
} from "@/lib/content/repository";
import { serializeDraft } from "@/lib/content/serializers";
import { prisma } from "@/lib/db";

export const complianceCheckSchema = z.object({
  content_package_id: z.string().min(1),
  draft_id: z.string().min(1).optional(),
});

export const issueDismissSchema = z.object({
  dismiss_reason: z.string().trim().min(1).optional(),
});

type ComplianceCheckRecord = Prisma.ComplianceCheckGetPayload<{
  include: { complianceIssues: true };
}>;
type ComplianceIssueForExport = {
  readonly severity: string;
  readonly dismissedAt: Date | string | null;
};

type RunComplianceCheckOptions = {
  readonly aiAdapter?: AIAdapter;
  readonly createAIAdapter?: () => AIAdapter;
};

type ComplianceRiskLevel = "low" | "medium" | "high";

export function deriveComplianceCheckExportAllowed(
  issues: readonly ComplianceIssueForExport[],
): boolean {
  return issues.every(
    (issue) =>
      issue.severity === "low" || (issue.severity === "medium" && issue.dismissedAt !== null),
  );
}

function deriveRiskLevel(issues: readonly { readonly severity: string }[]): ComplianceRiskLevel {
  if (issues.some((issue) => issue.severity === "high")) {
    return "high";
  }
  if (issues.some((issue) => issue.severity === "medium")) {
    return "medium";
  }
  return "low";
}

function isStaleCheckedAt(date: Date | null, now = new Date()): boolean {
  if (date === null) {
    return false;
  }
  return now.getTime() - date.getTime() > 7 * 24 * 60 * 60 * 1000;
}

function staleProductLinkIssues(
  links: readonly {
    readonly product: { readonly productName: string; readonly priceCheckedAt: Date | null };
    readonly shoppingConnectUrl: string;
    readonly linkCheckedAt: Date | null;
  }[],
): ComplianceRuleIssue[] {
  const issues: ComplianceRuleIssue[] = [];
  const stalePrices = links
    .filter((link) => isStaleCheckedAt(link.product.priceCheckedAt))
    .map((link) => link.product.productName);
  const staleLinks = links
    .filter((link) => isStaleCheckedAt(link.linkCheckedAt))
    .map((link) => link.shoppingConnectUrl);
  if (stalePrices.length > 0) {
    issues.push({
      issue_type: "stale_product_price",
      severity: "medium",
      message: `7일 초과 가격 확인 데이터가 있습니다: ${stalePrices.join(", ")}`,
      suggested_fix: "제품 가격을 다시 확인하고 가격 기준일을 갱신하세요.",
    });
  }
  if (staleLinks.length > 0) {
    issues.push({
      issue_type: "stale_shopping_link",
      severity: "medium",
      message: `7일 초과 쇼핑링크 확인 데이터가 있습니다: ${staleLinks.join(", ")}`,
      suggested_fix: "쇼핑커넥트 링크 유효성을 다시 확인하고 확인일을 갱신하세요.",
    });
  }
  return issues;
}

export function mergeComplianceIssues(input: {
  readonly ruleIssues: readonly ComplianceRuleIssue[];
  readonly semanticOutput: ComplianceOutput | null;
  readonly semanticError?: unknown;
}): {
  readonly pass: boolean;
  readonly risk_level: ComplianceRiskLevel;
  readonly export_allowed: boolean;
  readonly issues: readonly ComplianceRuleIssue[];
} {
  const semanticIssues: ComplianceRuleIssue[] =
    input.semanticOutput?.issues.map((issue) => ({
      issue_type: `semantic_${issue.type}`,
      severity: issue.severity,
      message: issue.message,
      ...(issue.suggested_fix === undefined ? {} : { suggested_fix: issue.suggested_fix }),
    })) ?? [];

  if (input.semanticOutput === null) {
    semanticIssues.push({
      issue_type: "semantic_review_unavailable",
      severity: "high",
      message:
        "AI semantic compliance review is unavailable; export is blocked until semantic review succeeds.",
      suggested_fix: "Configure a runtime AI adapter and rerun compliance review.",
    });
  }

  const issues = [...input.ruleIssues, ...semanticIssues];
  const riskLevel = deriveRiskLevel(issues);
  return {
    pass: issues.length === 0,
    risk_level: riskLevel,
    export_allowed: deriveComplianceCheckExportAllowed(
      issues.map((issue) => ({ severity: issue.severity, dismissedAt: null })),
    ),
    issues,
  };
}

async function runSemanticComplianceReview(input: {
  readonly adapter: AIAdapter;
  readonly bodyMarkdown: string;
  readonly hasShoppingConnectLinks: boolean;
  readonly hasPriceMentions: boolean;
  readonly policyRules: readonly PolicyRuleContext[];
}): Promise<ComplianceOutput | null> {
  try {
    return await input.adapter.checkCompliance({
      bodyMarkdown: input.bodyMarkdown,
      hasShoppingConnectLinks: input.hasShoppingConnectLinks,
      hasPriceMentions: input.hasPriceMentions,
      policyRules: input.policyRules,
    });
  } catch {
    return null;
  }
}

function serializeComplianceIssue(issue: ComplianceCheckRecord["complianceIssues"][number]) {
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

export function serializeComplianceCheck(check: ComplianceCheckRecord) {
  return {
    id: check.id,
    content_package_id: check.contentPackageId,
    draft_id: check.draftId,
    risk_level: check.riskLevel,
    pass: check.pass,
    export_allowed:
      check.exportAllowed && deriveComplianceCheckExportAllowed(check.complianceIssues),
    checked_at: check.checkedAt.toISOString(),
    issues: check.complianceIssues.map(serializeComplianceIssue),
  };
}
const compliancePassTransitionStatuses: ReadonlySet<PackageStatus> = new Set([
  PackageStatus.selected,
  PackageStatus.assigned,
  PackageStatus.brief_created,
  PackageStatus.homefeed_packaged,
  PackageStatus.search_structured,
  PackageStatus.revenue_links_attached,
  PackageStatus.blog_draft_generated,
  PackageStatus.sns_repurposed,
  PackageStatus.compliance_checked,
  PackageStatus.compliance_failed,
]);

const complianceFailTransitionStatuses: ReadonlySet<PackageStatus> = new Set([
  PackageStatus.selected,
  PackageStatus.assigned,
  PackageStatus.brief_created,
  PackageStatus.homefeed_packaged,
  PackageStatus.search_structured,
  PackageStatus.revenue_links_attached,
  PackageStatus.blog_draft_generated,
  PackageStatus.sns_repurposed,
  PackageStatus.compliance_checked,
  PackageStatus.owner_approval_required,
]);

async function updateComplianceStatus(input: {
  readonly contentPackageId: string;
  readonly currentStatus: PackageStatus;
  readonly currentProgress: number | null;
  readonly exportAllowed: boolean;
}): Promise<void> {
  if (input.exportAllowed) {
    if (compliancePassTransitionStatuses.has(input.currentStatus)) {
      await transitionContentPackageStatus({
        id: input.contentPackageId,
        fromStatus: input.currentStatus,
        toStatus: PackageStatus.compliance_checked,
        progress: 0.7,
        reason: "Compliance check passed",
      });
      await transitionContentPackageStatus({
        id: input.contentPackageId,
        fromStatus: PackageStatus.compliance_checked,
        toStatus: PackageStatus.owner_approval_required,
        progress: 0.75,
        reason: "Owner approval required",
      });
      return;
    }
    await updateContentPackageProgress({
      id: input.contentPackageId,
      progress: Math.max(input.currentProgress ?? 0, 0.75),
    });
    return;
  }

  if (complianceFailTransitionStatuses.has(input.currentStatus)) {
    await transitionContentPackageStatus({
      id: input.contentPackageId,
      fromStatus: input.currentStatus,
      toStatus: PackageStatus.compliance_failed,
      progress: 0.65,
      reason: "Compliance check failed",
    });
    return;
  }

  await updateContentPackageProgress({
    id: input.contentPackageId,
    progress: Math.max(input.currentProgress ?? 0, 0.65),
  });
}

export async function runComplianceCheck(
  input: z.infer<typeof complianceCheckSchema>,
  options: RunComplianceCheckOptions = {},
) {
  const draft =
    input.draft_id === undefined
      ? await prisma.draft.findFirst({
          where: { contentPackageId: input.content_package_id },
          orderBy: { updatedAt: "desc" },
        })
      : await prisma.draft.findFirst({
          where: { id: input.draft_id, contentPackageId: input.content_package_id },
        });
  if (draft === null) {
    return null;
  }
  const packageBeforeCheck = await prisma.contentPackage.findUnique({
    where: { id: input.content_package_id },
    include: { topic: { select: { title: true } } },
  });
  if (packageBeforeCheck === null) {
    return null;
  }

  const [shoppingLinks, policyRuleRecords] = await Promise.all([
    prisma.shoppingConnectLink.findMany({
      where: { contentPackageId: input.content_package_id, isActive: true },
      include: { product: true },
    }),
    prisma.policyRule.findMany({
      where: { isActive: true },
      select: { ruleType: true, ruleCode: true, description: true },
      orderBy: [{ ruleType: "asc" }, { ruleCode: "asc" }],
    }),
  ]);
  const policyRules = policyRuleRecords.map((rule) => ({
    rule_type: rule.ruleType,
    rule_code: rule.ruleCode,
    description: rule.description,
  }));
  const bodyMarkdown = draft.bodyMarkdown ?? "";
  const hasShoppingConnectLinks = shoppingLinks.length > 0;
  const hasPriceMentions = /[0-9,]+원|가격/.test(bodyMarkdown);
  const ruleResult = evaluateCompliance({
    body_markdown: bodyMarkdown,
    has_shopping_connect_links: hasShoppingConnectLinks,
    has_price_mentions: hasPriceMentions,
    disclosure_text: draft.disclosureText,
    price_notice: draft.priceNotice,
    policy_rules: policyRules,
  });
  const competitorSimilarityIssues = await loadCompetitorSimilarityIssues({
    bodyMarkdown,
    topicTitle: packageBeforeCheck.topic.title,
  });
  let semanticOutput: ComplianceOutput | null = null;
  try {
    const adapter =
      options.aiAdapter ??
      options.createAIAdapter?.() ??
      (await createRuntimeAIAdapterFromConfiguredCredentials());
    semanticOutput = await runSemanticComplianceReview({
      adapter,
      bodyMarkdown,
      hasShoppingConnectLinks,
      hasPriceMentions,
      policyRules,
    });
  } catch {
    semanticOutput = null;
  }
  const result = mergeComplianceIssues({
    ruleIssues: [
      ...ruleResult.issues,
      ...staleProductLinkIssues(shoppingLinks),
      ...competitorSimilarityIssues,
    ],
    semanticOutput,
  });

  const check = await prisma.complianceCheck.create({
    data: {
      contentPackageId: input.content_package_id,
      draftId: draft.id,
      riskLevel: result.risk_level,
      pass: result.pass,
      exportAllowed: result.export_allowed,
      complianceIssues: {
        create: result.issues.map((issue) => ({
          issueType: issue.issue_type,
          severity: issue.severity,
          message: issue.message,
          suggestedFix: issue.suggested_fix ?? null,
        })),
      },
    },
    include: { complianceIssues: true },
  });
  await updateComplianceStatus({
    contentPackageId: input.content_package_id,
    currentStatus: packageBeforeCheck.status,
    currentProgress: packageBeforeCheck.progress,
    exportAllowed: result.export_allowed,
  });

  return serializeComplianceCheck(check);
}

export async function getComplianceCheck(id: string) {
  const check = await prisma.complianceCheck.findUnique({
    where: { id },
    include: { complianceIssues: true },
  });
  return check === null ? null : serializeComplianceCheck(check);
}

export async function applyFixesToComplianceCheck(id: string) {
  const check = await prisma.complianceCheck.findUnique({
    where: { id },
    include: { complianceIssues: true, draft: true },
  });
  if (check?.draft === null || check?.draft === undefined) {
    return null;
  }

  const fixedMarkdown = applyComplianceFixes(
    check.draft.bodyMarkdown ?? "",
    check.complianceIssues.map((issue) => ({
      issue_type: issue.issueType,
      severity: z.enum(["low", "medium", "high"]).parse(issue.severity),
      message: issue.message,
      ...(issue.suggestedFix === null ? {} : { suggested_fix: issue.suggestedFix }),
    })),
  );
  const draft = await prisma.draft.update({
    where: { id: check.draft.id },
    data: { bodyMarkdown: fixedMarkdown },
  });

  return serializeDraft(draft);
}

export async function dismissComplianceIssue(
  id: string,
  input: z.infer<typeof issueDismissSchema>,
) {
  const issue = await prisma.complianceIssue.findUnique({ where: { id } });
  if (issue === null) {
    return { kind: "missing" as const };
  }
  if (issue.severity === "high") {
    return { kind: "blocked" as const, reason: "High severity issues cannot be dismissed." };
  }
  if (issue.severity === "medium" && input.dismiss_reason === undefined) {
    return {
      kind: "blocked" as const,
      reason: "Medium severity issues require a dismissal reason.",
    };
  }

  const updated = await prisma.$transaction(async (tx) => {
    const dismissedIssue = await tx.complianceIssue.update({
      where: { id },
      data: {
        dismissedAt: new Date(),
        dismissedBy: "owner",
        dismissReason: input.dismiss_reason ?? "low risk accepted",
      },
    });
    const issues = await tx.complianceIssue.findMany({
      where: { complianceCheckId: dismissedIssue.complianceCheckId },
    });
    const exportAllowed = deriveComplianceCheckExportAllowed(issues);
    const complianceCheck = await tx.complianceCheck.update({
      where: { id: dismissedIssue.complianceCheckId },
      data: { exportAllowed },
      include: { complianceIssues: true },
    });
    const contentPackage = await tx.contentPackage.findUnique({
      where: { id: complianceCheck.contentPackageId },
    });
    return { complianceCheck, contentPackage, dismissedIssue, exportAllowed };
  });
  if (updated.contentPackage !== null) {
    await updateComplianceStatus({
      contentPackageId: updated.complianceCheck.contentPackageId,
      currentStatus: updated.contentPackage.status,
      currentProgress: updated.contentPackage.progress,
      exportAllowed: updated.exportAllowed,
    });
  }

  return {
    kind: "dismissed" as const,
    issue: {
      id: updated.dismissedIssue.id,
      dismissed_at: updated.dismissedIssue.dismissedAt?.toISOString() ?? null,
      dismissed_by: updated.dismissedIssue.dismissedBy,
      dismiss_reason: updated.dismissedIssue.dismissReason,
      dismissal: {
        dismissed_at: updated.dismissedIssue.dismissedAt?.toISOString() ?? null,
        dismissed_by: updated.dismissedIssue.dismissedBy,
        reason: updated.dismissedIssue.dismissReason,
      },
    },
    compliance_check: serializeComplianceCheck(updated.complianceCheck),
  };
}
