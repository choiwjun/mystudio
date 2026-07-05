import { PackageStatus, type Prisma } from "@prisma/client";
import { z } from "zod";
import { applyComplianceFixes, evaluateCompliance } from "@/lib/compliance/rules";
import { transitionContentPackageStatus } from "@/lib/content/repository";
import { serializeDraft } from "@/lib/content/serializers";
import { prisma } from "@/lib/db";

export const complianceCheckSchema = z.object({
  content_package_id: z.string().min(1),
  draft_id: z.string().min(1).optional(),
});

export const issueDismissSchema = z.object({
  dismiss_reason: z.string().min(1).optional(),
});

type ComplianceCheckRecord = Prisma.ComplianceCheckGetPayload<{
  include: { complianceIssues: true };
}>;

export function serializeComplianceCheck(check: ComplianceCheckRecord) {
  return {
    id: check.id,
    content_package_id: check.contentPackageId,
    draft_id: check.draftId,
    risk_level: check.riskLevel,
    pass: check.pass,
    export_allowed: check.exportAllowed,
    checked_at: check.checkedAt.toISOString(),
    issues: check.complianceIssues.map((issue) => ({
      id: issue.id,
      issue_type: issue.issueType,
      severity: issue.severity,
      message: issue.message,
      suggested_fix: issue.suggestedFix,
      dismissed_at: issue.dismissedAt?.toISOString() ?? null,
      dismissed_by: issue.dismissedBy,
      dismiss_reason: issue.dismissReason,
    })),
  };
}

export async function runComplianceCheck(input: z.infer<typeof complianceCheckSchema>) {
  const draft =
    input.draft_id === undefined
      ? await prisma.draft.findFirst({
          where: { contentPackageId: input.content_package_id },
          orderBy: { updatedAt: "desc" },
        })
      : await prisma.draft.findUnique({ where: { id: input.draft_id } });
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
  if (result.export_allowed) {
    await transitionContentPackageStatus({
      id: input.content_package_id,
      fromStatus: packageBeforeCheck.status,
      toStatus: PackageStatus.compliance_checked,
      progress: 0.7,
      reason: "Compliance check passed",
    });
    await transitionContentPackageStatus({
      id: input.content_package_id,
      fromStatus: PackageStatus.compliance_checked,
      toStatus: PackageStatus.owner_approval_required,
      progress: 0.75,
      reason: "Owner approval required",
    });
  } else {
    await transitionContentPackageStatus({
      id: input.content_package_id,
      fromStatus: packageBeforeCheck.status,
      toStatus: PackageStatus.compliance_failed,
      progress: 0.65,
      reason: "Compliance check failed",
    });
  }

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

  const updated = await prisma.complianceIssue.update({
    where: { id },
    data: {
      dismissedAt: new Date(),
      dismissedBy: "owner",
      dismissReason: input.dismiss_reason ?? "low risk accepted",
    },
  });
  return {
    kind: "dismissed" as const,
    issue: {
      id: updated.id,
      dismissed_at: updated.dismissedAt?.toISOString() ?? null,
      dismiss_reason: updated.dismissReason,
    },
  };
}
