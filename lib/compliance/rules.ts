import { z } from "zod";

export const complianceInputSchema = z.object({
  body_markdown: z.string(),
  has_shopping_connect_links: z.boolean(),
  has_price_mentions: z.boolean(),
  disclosure_text: z.string().nullable().optional(),
  price_notice: z.string().nullable().optional(),
});

export const complianceIssueSchema = z.object({
  issue_type: z.string(),
  severity: z.enum(["low", "medium", "high"]),
  message: z.string(),
  suggested_fix: z.string().optional(),
});

export type ComplianceRuleInput = z.infer<typeof complianceInputSchema>;
export type ComplianceRuleIssue = z.infer<typeof complianceIssueSchema>;

const bannedExpressions = ["100%", "무조건", "완벽", "최저가", "1위", "최고"] as const;

function hasDisclosure(input: ComplianceRuleInput): boolean {
  return (
    input.body_markdown.includes("쇼핑커넥트") ||
    input.body_markdown.includes("대가성") ||
    (input.disclosure_text?.trim().length ?? 0) > 0
  );
}

function hasPriceNotice(input: ComplianceRuleInput): boolean {
  return input.body_markdown.includes("가격") && (input.price_notice?.trim().length ?? 0) > 0;
}

export function evaluateCompliance(input: ComplianceRuleInput): {
  readonly pass: boolean;
  readonly risk_level: "low" | "medium" | "high";
  readonly export_allowed: boolean;
  readonly issues: readonly ComplianceRuleIssue[];
} {
  const issues: ComplianceRuleIssue[] = [];

  if (input.has_shopping_connect_links && !hasDisclosure(input)) {
    issues.push({
      issue_type: "shopping_connect_disclosure_missing",
      severity: "high",
      message: "쇼핑커넥트 링크가 있지만 대가성 문구가 없습니다.",
      suggested_fix: "본문 상단에 쇼핑커넥트 대가성 문구를 추가하세요.",
    });
  }

  if (input.has_price_mentions && !hasPriceNotice(input)) {
    issues.push({
      issue_type: "price_notice_missing",
      severity: "high",
      message: "가격 언급이 있지만 가격 기준일 문구가 없습니다.",
      suggested_fix: "가격은 확인일 기준이며 변동될 수 있다는 문구를 추가하세요.",
    });
  }

  for (const expression of bannedExpressions) {
    if (input.body_markdown.includes(expression)) {
      issues.push({
        issue_type: "banned_expression",
        severity: "high",
        message: `금지 표현 '${expression}'이 포함되어 있습니다.`,
        suggested_fix: "단정 표현을 근거 기반의 완화된 표현으로 바꾸세요.",
      });
    }
  }

  if (/(^|[^0-9])0원/.test(input.body_markdown)) {
    issues.push({
      issue_type: "banned_expression",
      severity: "high",
      message: "금지 표현 '0원'이 포함되어 있습니다.",
      suggested_fix: "무료 또는 0원 표현은 실제 조건과 근거를 확인해 완화된 표현으로 바꾸세요.",
    });
  }

  if (!input.body_markdown.includes("출처")) {
    issues.push({
      issue_type: "source_missing",
      severity: "low",
      message: "출처 표기가 부족합니다.",
      suggested_fix: "상품명, 가격, 주요 주장에 출처를 붙이세요.",
    });
  }

  if (input.body_markdown.replace(/\s/g, "").length < 80) {
    issues.push({
      issue_type: "content_depth_missing",
      severity: "low",
      message: "본문 길이가 짧아 검색형 콘텐츠로 쓰기 어렵습니다.",
      suggested_fix: "문제 정의, 비교 기준, FAQ를 포함해 본문을 보강하세요.",
    });
  }

  const hasHigh = issues.some((issue) => issue.severity === "high");
  const hasMedium = issues.some((issue) => issue.severity === "medium");
  const riskLevel = hasHigh ? "high" : hasMedium ? "medium" : "low";

  return {
    pass: issues.length === 0,
    risk_level: riskLevel,
    export_allowed: !hasHigh,
    issues,
  };
}

export function applyComplianceFixes(
  markdown: string,
  issues: readonly ComplianceRuleIssue[],
): string {
  const fixes = new Set(issues.map((issue) => issue.issue_type));
  const disclosure =
    fixes.has("shopping_connect_disclosure_missing") && !markdown.includes("쇼핑커넥트")
      ? "이 글은 쇼핑커넥트 활동을 포함할 수 있으며, 링크를 통한 구매 시 수수료를 받을 수 있습니다.\n\n"
      : "";
  const priceNotice =
    fixes.has("price_notice_missing") && !markdown.includes("가격은 확인일 기준")
      ? "\n\n가격은 확인일 기준이며 변동될 수 있습니다."
      : "";

  return `${disclosure}${markdown}${priceNotice}`;
}
