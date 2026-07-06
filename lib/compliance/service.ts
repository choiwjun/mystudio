import { PackageStatus, type Prisma } from "@prisma/client";
import { z } from "zod";
import { applyComplianceFixes, evaluateCompliance } from "@/lib/compliance/rules";
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

export function deriveComplianceCheckExportAllowed(
  issues: readonly ComplianceIssueForExport[],
): boolean {
  return issues.every(
    (issue) =>
      issue.severity === "low" || (issue.severity === "medium" && issue.dismissedAt !== null),
  );
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

export async function runComplianceCheck(input: z.infer<typeof complianceCheckSchema>) {
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
  });
  if (packageBeforeCheck === null) {
    return null;
  }

  const shoppingLinkCount = await prisma.shoppingConnectLink.count({
    where: { contentPackageId: input.content_package_id, isActive: true },
  });
  const bodyMarkdown = draft.bodyMarkdown ?? "";
  const result = evaluateCompliance({
    body_markdown: bodyMarkdown,
    has_shopping_connect_links: shoppingLinkCount > 0,
    has_price_mentions: /[0-9,]+원|가격/.test(bodyMarkdown),
    disclosure_text: draft.disclosureText,
    price_notice: draft.priceNotice,
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
