import type { ComplianceRuleIssue } from "@/lib/compliance/rules";
import { prisma } from "@/lib/db";

const MAX_SIMILARITY_ROWS = 8;
const MAX_TOPIC_TOKENS = 6;
const MIN_EXACT_PHRASE_LENGTH = 12;

type SimilarityRawItem = {
  readonly title: string;
  readonly url: string;
  readonly content: string | null;
};

function normalizeForSimilarity(value: string): string {
  return value
    .toLocaleLowerCase("ko-KR")
    .replace(/<[^>]*>/g, " ")
    .replace(/[\s,./\\|!?()[\]{}:;"'`~+=_-]+/gu, "");
}

function topicTokens(topic: string): readonly string[] {
  const seen = new Set<string>();
  const tokens: string[] = [];
  for (const token of topic.split(/[\s,./\\|!?()[\]{}:;"'`~+=_-]+/u)) {
    const normalized = token.trim().toLocaleLowerCase("ko-KR");
    if (normalized.length < 2 || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    tokens.push(token.trim());
    if (tokens.length >= MAX_TOPIC_TOKENS) {
      break;
    }
  }
  return tokens;
}

function candidateTexts(row: SimilarityRawItem): readonly string[] {
  return [row.title, row.content?.replace(/\s+/g, " ").trim().slice(0, 90) ?? ""].filter(
    (text) => normalizeForSimilarity(text).length >= MIN_EXACT_PHRASE_LENGTH,
  );
}

export function competitorSimilarityIssuesFromRows(input: {
  readonly bodyMarkdown: string;
  readonly rows: readonly SimilarityRawItem[];
}): readonly ComplianceRuleIssue[] {
  const normalizedBody = normalizeForSimilarity(input.bodyMarkdown);
  const matchedRows = input.rows.filter((row) =>
    candidateTexts(row).some((candidate) =>
      normalizedBody.includes(normalizeForSimilarity(candidate)),
    ),
  );

  return matchedRows.slice(0, 3).map((row) => ({
    issue_type: "competitor_similarity_risk",
    severity: "medium",
    message: `경쟁 블로그 제목 또는 요약과 동일한 표현이 초안에 남아 있습니다: ${row.title}`,
    suggested_fix:
      "경쟁 글의 표현을 삭제하고, 문제 제기·비교 기준·FAQ 각도만 유지한 새 문장으로 다시 작성하세요.",
  }));
}

export async function loadCompetitorSimilarityIssues(input: {
  readonly bodyMarkdown: string;
  readonly topicTitle: string;
}): Promise<readonly ComplianceRuleIssue[]> {
  const tokens = topicTokens(input.topicTitle);
  if (tokens.length === 0) {
    return [];
  }

  const rows = await prisma.rawItem.findMany({
    where: {
      itemType: "naver_blog",
      OR: tokens.flatMap((token) => [
        { title: { contains: token, mode: "insensitive" as const } },
        { content: { contains: token, mode: "insensitive" as const } },
      ]),
    },
    orderBy: { collectedAt: "desc" },
    take: MAX_SIMILARITY_ROWS,
  });

  return competitorSimilarityIssuesFromRows({ bodyMarkdown: input.bodyMarkdown, rows });
}
