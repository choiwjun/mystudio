import type { CompetitorBenchmarkGenerationContext } from "@/lib/ai/adapter";
import { prisma } from "@/lib/db";

const MAX_BENCHMARK_PATTERNS = 5;
const MAX_TOPIC_TOKENS = 6;

type BenchmarkRawItem = {
  readonly title: string;
  readonly url: string;
  readonly content: string | null;
};

function normalizeText(value: string): string {
  return value.trim().toLocaleLowerCase("ko-KR");
}

function topicTokens(topic: string): readonly string[] {
  const seen = new Set<string>();
  const tokens: string[] = [];
  for (const token of topic.split(/[\s,./\\|!?()[\]{}:;"'`~+=_-]+/u)) {
    const normalized = normalizeText(token);
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

function snippetFromContent(content: string | null): string | undefined {
  const snippet = content?.replace(/\s+/g, " ").trim().slice(0, 140);
  return snippet === undefined || snippet.length === 0 ? undefined : snippet;
}

function patternSummary(row: BenchmarkRawItem): string {
  const snippet = snippetFromContent(row.content);
  return snippet === undefined
    ? `제목에서 독자 문제와 판단 기준을 추출하되 표현은 새로 쓴다: ${row.title}`
    : `제목과 요약에서 문제 제기, 비교 기준, 결론 배치만 추출한다: ${snippet}`;
}

function originalityGuard(row: BenchmarkRawItem): string {
  return `경쟁 글의 제목, 문단 순서, 고유 표현을 재사용하지 않는다. 참고 URL: ${row.url}`;
}

export async function loadCompetitorBenchmarkContext(
  topic: string,
): Promise<CompetitorBenchmarkGenerationContext | undefined> {
  const tokens = topicTokens(topic);
  if (tokens.length === 0) {
    return undefined;
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
    take: MAX_BENCHMARK_PATTERNS,
  });

  if (rows.length === 0) {
    return undefined;
  }

  return {
    source: "naver_blog_raw_items",
    query: topic,
    patterns: rows.map((row) => {
      const snippet = snippetFromContent(row.content);
      return {
        title: row.title,
        url: row.url,
        ...(snippet === undefined ? {} : { snippet }),
        patternSummary: patternSummary(row),
        originalityGuard: originalityGuard(row),
      };
    }),
  };
}
