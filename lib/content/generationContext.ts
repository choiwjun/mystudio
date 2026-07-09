import type {
  CategoryPlaybookGenerationContext,
  ContentGenerationContext,
  PromptTemplateGenerationContext,
} from "@/lib/ai/adapter";
import { loadCompetitorBenchmarkContext } from "@/lib/content/competitorBenchmark";
import { prisma } from "@/lib/db";

const MAX_TOPIC_TOKENS = 8;
const MAX_CATEGORY_CANDIDATES = 20;
const MAX_CONTEXT_QUERY_ROWS = 24;
const MAX_PLAYBOOK_CONTEXT_ROWS = 6;

type ProductCategorySource = {
  readonly isActive: boolean;
  readonly product: { readonly category: string | null };
};

type CompanyCategorySource = {
  readonly primaryCategories: readonly string[];
};

type GenerationContextTask = "generateBlogDraft" | "generateSearchStructure";

type GenerationContextInput = {
  readonly task: GenerationContextTask;
  readonly topic: string;
  readonly shoppingConnectLinks: readonly ProductCategorySource[];
  readonly companyProfile: CompanyCategorySource;
};

function normalizeText(value: string): string {
  return value.trim().toLocaleLowerCase("ko-KR");
}

function uniqueNonEmpty(values: readonly string[], limit: number): readonly string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const trimmed = value.trim();
    const key = normalizeText(trimmed);
    if (key.length === 0 || seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(trimmed);
    if (result.length >= limit) {
      break;
    }
  }

  return result;
}

function topicTokens(topic: string): readonly string[] {
  return uniqueNonEmpty(
    topic
      .split(/[\s,./\\|!?()[\]{}:;"'`~+=_-]+/u)
      .map((token) => token.trim())
      .filter((token) => token.length >= 2),
    MAX_TOPIC_TOKENS,
  );
}

function activeProductCategories(
  shoppingConnectLinks: readonly ProductCategorySource[],
): readonly string[] {
  return uniqueNonEmpty(
    shoppingConnectLinks.filter((link) => link.isActive).map((link) => link.product.category ?? ""),
    MAX_CATEGORY_CANDIDATES,
  );
}

function mergeUniqueById<T extends { readonly id: string }>(
  firstRows: readonly T[],
  secondRows: readonly T[],
): readonly T[] {
  const seen = new Set<string>();
  const result: T[] = [];

  for (const row of [...firstRows, ...secondRows]) {
    if (seen.has(row.id)) {
      continue;
    }
    seen.add(row.id);
    result.push(row);
  }

  return result;
}

function playbookRank(
  category: string,
  exactCategoryKeys: ReadonlySet<string>,
  normalizedTopic: string,
  normalizedTopicTokens: ReadonlySet<string>,
): number | null {
  const normalizedCategory = normalizeText(category);
  if (exactCategoryKeys.has(normalizedCategory)) {
    return 0;
  }
  if (normalizedCategory.length > 0 && normalizedTopic.includes(normalizedCategory)) {
    return 1;
  }
  for (const token of normalizedTopicTokens) {
    if (normalizedCategory.includes(token)) {
      return 2;
    }
  }
  return null;
}

async function loadCategoryPlaybookContext(
  input: GenerationContextInput,
): Promise<readonly CategoryPlaybookGenerationContext[]> {
  const exactCategories = uniqueNonEmpty(
    [
      ...activeProductCategories(input.shoppingConnectLinks),
      ...input.companyProfile.primaryCategories,
    ],
    MAX_CATEGORY_CANDIDATES,
  );
  const tokens = topicTokens(input.topic);
  const exactCategoryKeys = new Set(exactCategories.map(normalizeText));
  const normalizedTopic = normalizeText(input.topic);
  const normalizedTopicTokens = new Set(tokens.map(normalizeText));
  if (exactCategories.length === 0 && tokens.length === 0) {
    return [];
  }

  const exactRows =
    exactCategories.length === 0
      ? []
      : await prisma.categoryPlaybook.findMany({
          where: { category: { in: [...exactCategories], mode: "insensitive" as const } },
          orderBy: { category: "asc" },
          take: MAX_CONTEXT_QUERY_ROWS,
        });
  const tokenRows =
    tokens.length === 0
      ? []
      : await prisma.categoryPlaybook.findMany({
          where: {
            OR: tokens.map((token) => ({
              category: { contains: token, mode: "insensitive" as const },
            })),
          },
          orderBy: { category: "asc" },
          take: MAX_CONTEXT_QUERY_ROWS,
        });
  const rows = mergeUniqueById(exactRows, tokenRows);

  return rows
    .map((row) => ({
      row,
      rank: playbookRank(row.category, exactCategoryKeys, normalizedTopic, normalizedTopicTokens),
    }))
    .filter(
      (item): item is { readonly row: (typeof rows)[number]; readonly rank: number } =>
        item.rank !== null,
    )
    .sort(
      (left, right) =>
        left.rank - right.rank || left.row.category.localeCompare(right.row.category, "ko-KR"),
    )
    .slice(0, MAX_PLAYBOOK_CONTEXT_ROWS)
    .map(({ row }) => ({
      category: row.category,
      homefeedToneGuidance: row.homefeedToneGuidance,
      searchGuidance: row.searchGuidance,
      productRecommendations: row.productRecommendations,
      commonMistakes: row.commonMistakes,
      winningPatterns: row.winningPatterns,
    }));
}

function promptTemplateNames(task: GenerationContextTask): readonly string[] {
  if (task === "generateBlogDraft") {
    return [
      "generateBlogDraft",
      "blog_draft_generation",
      "blogDraft",
      "blog draft",
      "contentBlogDraft",
      "naver_blog",
    ];
  }
  return [
    "generateSearchStructure",
    "search_structure_generation",
    "searchStructure",
    "search structure",
  ];
}
function promptTemplateMatchRank(templateName: string, names: readonly string[]): number | null {
  const normalizedTemplateName = normalizeText(templateName);
  const normalizedNames = names.map(normalizeText);

  if (normalizedNames.includes(normalizedTemplateName)) {
    return 0;
  }

  for (const name of normalizedNames) {
    if (normalizedTemplateName.includes(name)) {
      return 1;
    }
  }

  return null;
}

async function loadPromptTemplateContext(
  task: GenerationContextTask,
): Promise<PromptTemplateGenerationContext | undefined> {
  const names = promptTemplateNames(task);
  const exactTemplates = await prisma.promptTemplate.findMany({
    where: { name: { in: [...names], mode: "insensitive" as const } },
    orderBy: [{ version: "desc" }, { updatedAt: "desc" }],
    take: MAX_CONTEXT_QUERY_ROWS,
  });
  const partialTemplates =
    exactTemplates.length > 0
      ? []
      : await prisma.promptTemplate.findMany({
          where: {
            OR: names.map((name) => ({ name: { contains: name, mode: "insensitive" as const } })),
          },
          orderBy: [{ version: "desc" }, { updatedAt: "desc" }],
          take: MAX_CONTEXT_QUERY_ROWS,
        });
  const templates = mergeUniqueById(exactTemplates, partialTemplates);
  const template = templates
    .map((row) => ({ row, rank: promptTemplateMatchRank(row.name, names) }))
    .filter(
      (item): item is { readonly row: (typeof templates)[number]; readonly rank: number } =>
        item.rank !== null,
    )
    .sort(
      (left, right) =>
        left.rank - right.rank ||
        right.row.version - left.row.version ||
        right.row.updatedAt.getTime() - left.row.updatedAt.getTime() ||
        left.row.name.localeCompare(right.row.name, "ko-KR"),
    )[0]?.row;

  if (template === undefined) {
    return undefined;
  }

  return {
    id: template.id,
    name: template.name,
    engine: template.engine,
    version: template.version,
    template: template.template,
    variables: template.variables,
  };
}

export async function loadContentGenerationContext(
  input: GenerationContextInput,
): Promise<ContentGenerationContext> {
  const [categoryPlaybooks, competitorBenchmark, promptTemplate] = await Promise.all([
    loadCategoryPlaybookContext(input),
    input.task === "generateBlogDraft"
      ? loadCompetitorBenchmarkContext(input.topic)
      : Promise.resolve(undefined),
    loadPromptTemplateContext(input.task),
  ]);

  return {
    categoryPlaybooks,
    ...(competitorBenchmark === undefined ? {} : { competitorBenchmark }),
    ...(promptTemplate === undefined ? {} : { promptTemplate }),
  };
}
