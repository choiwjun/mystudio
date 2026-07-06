import { z } from "zod";

export const ScoreSchema = z.number().int().min(0).max(100);

export type AIAdapterProvider = "mock" | "openai" | "claude";

export type AIAdapterMetadata = {
  readonly provider: AIAdapterProvider;
  readonly model: string;
};

export const OpportunityMemoOutputSchema = z.object({
  topic: z.string().min(1),
  why_now: z.string().min(10),
  homefeed_angle: z.string().min(5),
  search_angle: z.string().min(5),
  interest_tags: z.array(z.string()).min(1).max(8),
  homefeed_score: ScoreSchema,
  homefeed_reasons: z.string().min(5),
  search_score: ScoreSchema,
  search_reasons: z.string().min(5),
  revenue_score: ScoreSchema,
  revenue_reasons: z.string().min(5),
  risk_score: ScoreSchema,
  score_reasons: z.string().min(10),
});

export const BlogDraftOutputSchema = z.object({
  homefeed_title: z.array(z.string().min(1)).min(3).max(10),
  search_title: z.string().min(1),
  thumbnail_text: z.array(z.string().min(1)).min(1).max(5),
  first_screen: z.string().min(10),
  body_markdown: z.string().min(100),
  comparison_table: z.string().optional(),
  faq: z.array(z.object({ question: z.string(), answer: z.string() })).min(3),
  disclosure_text: z.string().optional(),
  price_notice: z.string().optional(),
});

export const SearchStructureOutputSchema = z.object({
  search_title: z.string().min(1),
  h2: z.array(z.string().min(1)).min(3).max(4),
  faq: z.array(z.object({ question: z.string(), answer: z.string() })).min(3),
  comparison_table: z.string().min(1),
});

export const ComplianceOutputSchema = z.object({
  pass: z.boolean(),
  risk_level: z.enum(["low", "medium", "high"]),
  export_allowed: z.boolean(),
  issues: z.array(
    z.object({
      type: z.string(),
      field: z.string(),
      severity: z.enum(["low", "medium", "high"]),
      message: z.string(),
      suggested_fix: z.string().optional(),
    }),
  ),
});

export const SnsVariantOutputSchema = z.object({
  platform: z.enum(["instagram", "threads", "x"]),
  format: z.string().min(1),
  hook: z.string().optional(),
  body: z.string().min(1),
  cta: z.string().optional(),
  hashtags: z.array(z.string()).max(20),
  score: ScoreSchema.optional(),
});

export const DailyBriefingOutputSchema = z.object({
  goals: z.string().min(10),
  focus_categories: z.array(z.string().min(1)).min(1).max(5),
  priority_angle: z.string().min(5),
  strategy_note: z.string().min(10),
});

export type OpportunityMemoOutput = z.infer<typeof OpportunityMemoOutputSchema>;
export type BlogDraftOutput = z.infer<typeof BlogDraftOutputSchema>;
export type SearchStructureOutput = z.infer<typeof SearchStructureOutputSchema>;
export type ComplianceOutput = z.infer<typeof ComplianceOutputSchema>;
export type SnsVariantOutput = z.infer<typeof SnsVariantOutputSchema>;
export type DailyBriefingOutput = z.infer<typeof DailyBriefingOutputSchema>;

export class AIOutputValidationError extends Error {
  readonly code = "AI_OUTPUT_SCHEMA_INVALID";
  readonly task: string;
  readonly issues: readonly string[];

  constructor(input: { readonly task: string; readonly issues: readonly string[] }) {
    super(`AI output failed schema validation for ${input.task}.`);
    this.name = "AIOutputValidationError";
    this.task = input.task;
    this.issues = input.issues;
  }
}

function formatZodIssues(error: z.ZodError): readonly string[] {
  return error.issues.map((issue) => {
    const path = issue.path.length === 0 ? "root" : issue.path.join(".");
    return `${path}: ${issue.message}`;
  });
}

function parseAiOutput<T>(schema: z.ZodType<T>, value: unknown, task: string): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new AIOutputValidationError({
      task,
      issues: formatZodIssues(parsed.error),
    });
  }
  return parsed.data;
}

export function parseOpportunityMemoOutput(value: unknown): OpportunityMemoOutput {
  return parseAiOutput(OpportunityMemoOutputSchema, value, "generateOpportunityMemo");
}

export function parseBlogDraftOutput(value: unknown): BlogDraftOutput {
  return parseAiOutput(BlogDraftOutputSchema, value, "generateBlogDraft");
}

export function parseSearchStructureOutput(value: unknown): SearchStructureOutput {
  return parseAiOutput(SearchStructureOutputSchema, value, "generateSearchStructure");
}

export function parseComplianceOutput(value: unknown): ComplianceOutput {
  return parseAiOutput(ComplianceOutputSchema, value, "checkCompliance");
}

export function parseSnsVariantOutput(value: unknown): SnsVariantOutput {
  return parseAiOutput(SnsVariantOutputSchema, value, "generateSNSVariant");
}

export function parseDailyBriefingOutput(value: unknown): DailyBriefingOutput {
  return parseAiOutput(DailyBriefingOutputSchema, value, "generateDailyBriefing");
}

export function parseScoreOutput(value: unknown): number {
  return parseAiOutput(ScoreSchema, value, "scoreHomefeed");
}

export type HermesInput = {
  readonly categories: readonly string[];
  readonly rawItems: readonly unknown[];
  readonly memoryContext?: HermesMemoryContext;
};

export type HermesMemoryPattern = {
  readonly pattern_type:
    | "homefeed_hook"
    | "search_keyword"
    | "product_angle"
    | "pricing_strategy"
    | "seasonal_theme";
  readonly pattern_text: string;
  readonly tags: readonly string[];
  readonly sample_count: number;
  readonly avg_views: number | null;
  readonly avg_clicks: number | null;
  readonly avg_revenue_usd: number | null;
  readonly created_pattern_ids: readonly string[];
};

export type HermesMemoryContext = {
  readonly status: "ready" | "learning";
  readonly minimum_sample_count: number;
  readonly learning_pattern_count: number;
  readonly patterns: readonly HermesMemoryPattern[];
};

export type CategoryPlaybookGenerationContext = {
  readonly category: string;
  readonly homefeedToneGuidance: string | null;
  readonly searchGuidance: string | null;
  readonly productRecommendations: readonly string[];
  readonly commonMistakes: readonly string[];
  readonly winningPatterns: readonly string[];
};

export type PromptTemplateGenerationContext = {
  readonly id: string;
  readonly name: string;
  readonly engine: string;
  readonly version: number;
  readonly template: string;
  readonly variables: unknown;
};

export type ContentGenerationContext = {
  readonly categoryPlaybooks: readonly CategoryPlaybookGenerationContext[];
  readonly promptTemplate?: PromptTemplateGenerationContext;
};

export type ContentInput = {
  readonly topic: string;
  readonly products: readonly unknown[];
  readonly companyProfile: unknown;
  readonly generationContext?: ContentGenerationContext;
};

export type CompliancePolicyRuleContext = {
  readonly rule_type: string;
  readonly rule_code: string;
  readonly description: string;
};

export type ComplianceInput = {
  readonly bodyMarkdown: string;
  readonly hasShoppingConnectLinks: boolean;
  readonly hasPriceMentions: boolean;
  readonly policyRules?: readonly CompliancePolicyRuleContext[];
};

export type SnsProfile = {
  readonly platform: "instagram" | "threads" | "x";
  readonly format: string;
};

export type DailyBriefingCompanyProfileContext = {
  readonly companyName?: string;
  readonly primaryCategories: readonly string[];
  readonly blockedCategories?: readonly string[];
  readonly toneRules?: string;
  readonly contentPrinciples?: string;
  readonly revenueGoalMonthly?: number | null;
};

export type DailyBriefingOpportunityMemoContext = {
  readonly topic?: string;
  readonly whyNow?: string;
  readonly homefeedAngle?: string;
  readonly searchAngle?: string;
  readonly interestTags?: readonly string[];
};

export type DailyBriefingInput = {
  readonly companyProfile: DailyBriefingCompanyProfileContext;
  readonly opportunityMemoContext?: {
    readonly latestMemo?: DailyBriefingOpportunityMemoContext | null;
    readonly recentMemos?: readonly DailyBriefingOpportunityMemoContext[];
  };
};

export interface AIAdapter {
  readonly metadata: AIAdapterMetadata;
  generateOpportunityMemo(input: HermesInput): Promise<OpportunityMemoOutput>;
  generateBlogDraft(input: ContentInput): Promise<BlogDraftOutput>;
  generateSearchStructure(input: ContentInput): Promise<SearchStructureOutput>;
  generateSNSVariant(input: ContentInput, profile: SnsProfile): Promise<SnsVariantOutput>;
  scoreHomefeed(draft: BlogDraftOutput): Promise<number>;
  checkCompliance(input: ComplianceInput): Promise<ComplianceOutput>;
  generateDailyBriefing(input: DailyBriefingInput): Promise<DailyBriefingOutput>;
}
