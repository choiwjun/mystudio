import type {
  AIAdapter,
  BlogDraftOutput,
  ComplianceInput,
  ComplianceOutput,
  ContentInput,
  HermesInput,
  OpportunityMemoOutput,
  SearchStructureOutput,
  SnsProfile,
  SnsVariantOutput,
} from "@/lib/ai/adapter";
import {
  parseBlogDraftOutput,
  parseComplianceOutput,
  parseOpportunityMemoOutput,
  parseScoreOutput,
  parseSearchStructureOutput,
  parseSnsVariantOutput,
} from "@/lib/ai/adapter";

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

type ProviderAdapterOptions = {
  readonly apiKey: string;
  readonly fetch?: FetchLike | undefined;
  readonly model?: string | undefined;
};

export class AIProviderResponseError extends Error {
  readonly code = "AI_PROVIDER_RESPONSE_INVALID";
  readonly provider: "openai" | "claude";
  readonly task: string;

  constructor(input: {
    readonly provider: "openai" | "claude";
    readonly task: string;
    readonly message: string;
  }) {
    super(`${input.provider} returned an invalid AI response for ${input.task}: ${input.message}`);
    this.name = "AIProviderResponseError";
    this.provider = input.provider;
    this.task = input.task;
  }
}

function resolveFetch(provider: "openai" | "claude", fetchImpl: FetchLike | undefined): FetchLike {
  if (fetchImpl !== undefined) {
    return fetchImpl;
  }

  if (globalThis.fetch === undefined) {
    throw new AIProviderResponseError({
      provider,
      task: "configuration",
      message: "global fetch is not available",
    });
  }

  return globalThis.fetch.bind(globalThis);
}

function parseProviderJson(provider: "openai" | "claude", task: string, content: string): unknown {
  try {
    return JSON.parse(content) as unknown;
  } catch {
    throw new AIProviderResponseError({
      provider,
      task,
      message: "model content was not valid JSON",
    });
  }
}

async function readResponseJson(
  response: Response,
  provider: "openai" | "claude",
  task: string,
): Promise<unknown> {
  try {
    return (await response.json()) as unknown;
  } catch {
    throw new AIProviderResponseError({
      provider,
      task,
      message: "HTTP response body was not valid JSON",
    });
  }
}

function requireRecord(
  value: unknown,
  provider: "openai" | "claude",
  task: string,
  context: string,
): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new AIProviderResponseError({ provider, task, message: `${context} was not an object` });
  }
  return value as Record<string, unknown>;
}

function requireString(
  value: unknown,
  provider: "openai" | "claude",
  task: string,
  context: string,
): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new AIProviderResponseError({ provider, task, message: `${context} was empty` });
  }
  return value;
}

function outputContract(task: string): string {
  switch (task) {
    case "generateOpportunityMemo":
      return "Output object: topic string; why_now string; homefeed_angle string; search_angle string; interest_tags string[]; homefeed_score/search_score/revenue_score/risk_score integers 0-100; homefeed_reasons/search_reasons/revenue_reasons strings; score_reasons string.";
    case "generateBlogDraft":
      return "Output object: homefeed_title string[3..10]; search_title string; thumbnail_text string[1..5]; first_screen string; body_markdown markdown string at least 100 chars; optional comparison_table string; faq array of at least 3 {question, answer}; optional disclosure_text; optional price_notice.";
    case "generateSearchStructure":
      return "Output object: search_title string; h2 string[3..4]; faq array of at least 3 {question, answer}; comparison_table markdown table string.";
    case "generateSNSVariant":
      return "Output object: platform one of instagram, threads, x; format string; optional hook string; body string; optional cta string; hashtags string[] max 20; optional score integer 0-100.";
    case "scoreHomefeed":
      return "Output object: score integer 0-100 only.";
    case "checkCompliance":
      return "Output object: pass boolean; risk_level one of low, medium, high; export_allowed boolean; issues array of {type string, field string, severity low|medium|high, message string, optional suggested_fix string}.";
    default:
      return "Output object must match the named task.";
  }
}

function buildPrompt(task: string, input: unknown): string {
  return [
    `Task: ${task}`,
    "Return exactly one JSON value and no markdown, comments, or surrounding text.",
    "Use the requested schema field names exactly. Do not omit required fields.",
    outputContract(task),
    `Input JSON: ${JSON.stringify(input)}`,
  ].join("\n");
}

function scoreFromJson(provider: "openai" | "claude", task: string, value: unknown): number {
  const record = requireRecord(value, provider, task, "score response");
  return parseScoreOutput(record["score"]);
}

export class OpenAIAdapter implements AIAdapter {
  private readonly apiKey: string;
  private readonly fetchImpl: FetchLike;
  private readonly model: string;

  constructor(options: ProviderAdapterOptions) {
    this.apiKey = options.apiKey;
    this.fetchImpl = resolveFetch("openai", options.fetch);
    this.model = options.model ?? "gpt-4o-mini";
  }

  async generateOpportunityMemo(input: HermesInput): Promise<OpportunityMemoOutput> {
    return parseOpportunityMemoOutput(await this.requestJson("generateOpportunityMemo", input));
  }

  async generateBlogDraft(input: ContentInput): Promise<BlogDraftOutput> {
    return parseBlogDraftOutput(await this.requestJson("generateBlogDraft", input));
  }

  async generateSearchStructure(input: ContentInput): Promise<SearchStructureOutput> {
    return parseSearchStructureOutput(await this.requestJson("generateSearchStructure", input));
  }

  async generateSNSVariant(input: ContentInput, profile: SnsProfile): Promise<SnsVariantOutput> {
    return parseSnsVariantOutput(await this.requestJson("generateSNSVariant", { input, profile }));
  }

  async scoreHomefeed(draft: BlogDraftOutput): Promise<number> {
    return scoreFromJson("openai", "scoreHomefeed", await this.requestJson("scoreHomefeed", draft));
  }

  async checkCompliance(input: ComplianceInput): Promise<ComplianceOutput> {
    return parseComplianceOutput(await this.requestJson("checkCompliance", input));
  }

  private async requestJson(task: string, input: unknown): Promise<unknown> {
    const response = await this.fetchImpl("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You are a deterministic production JSON generator for a commerce content system.",
          },
          { role: "user", content: buildPrompt(task, input) },
        ],
      }),
    });

    if (!response.ok) {
      throw new AIProviderResponseError({
        provider: "openai",
        task,
        message: `HTTP ${response.status}`,
      });
    }

    const payload = requireRecord(
      await readResponseJson(response, "openai", task),
      "openai",
      task,
      "OpenAI response",
    );
    const choices = payload["choices"];
    if (!Array.isArray(choices)) {
      throw new AIProviderResponseError({
        provider: "openai",
        task,
        message: "choices was not an array",
      });
    }
    const firstChoice = requireRecord(choices[0], "openai", task, "first choice");
    const message = requireRecord(firstChoice["message"], "openai", task, "choice message");
    return parseProviderJson(
      "openai",
      task,
      requireString(message["content"], "openai", task, "message content"),
    );
  }
}

export class ClaudeAIAdapter implements AIAdapter {
  private readonly apiKey: string;
  private readonly fetchImpl: FetchLike;
  private readonly model: string;

  constructor(options: ProviderAdapterOptions) {
    this.apiKey = options.apiKey;
    this.fetchImpl = resolveFetch("claude", options.fetch);
    this.model = options.model ?? "claude-3-5-haiku-latest";
  }

  async generateOpportunityMemo(input: HermesInput): Promise<OpportunityMemoOutput> {
    return parseOpportunityMemoOutput(await this.requestJson("generateOpportunityMemo", input));
  }

  async generateBlogDraft(input: ContentInput): Promise<BlogDraftOutput> {
    return parseBlogDraftOutput(await this.requestJson("generateBlogDraft", input));
  }

  async generateSearchStructure(input: ContentInput): Promise<SearchStructureOutput> {
    return parseSearchStructureOutput(await this.requestJson("generateSearchStructure", input));
  }

  async generateSNSVariant(input: ContentInput, profile: SnsProfile): Promise<SnsVariantOutput> {
    return parseSnsVariantOutput(await this.requestJson("generateSNSVariant", { input, profile }));
  }

  async scoreHomefeed(draft: BlogDraftOutput): Promise<number> {
    return scoreFromJson("claude", "scoreHomefeed", await this.requestJson("scoreHomefeed", draft));
  }

  async checkCompliance(input: ComplianceInput): Promise<ComplianceOutput> {
    return parseComplianceOutput(await this.requestJson("checkCompliance", input));
  }

  private async requestJson(task: string, input: unknown): Promise<unknown> {
    const response = await this.fetchImpl("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 4096,
        temperature: 0.2,
        system: "You are a deterministic production JSON generator for a commerce content system.",
        messages: [{ role: "user", content: buildPrompt(task, input) }],
      }),
    });

    if (!response.ok) {
      throw new AIProviderResponseError({
        provider: "claude",
        task,
        message: `HTTP ${response.status}`,
      });
    }

    const payload = requireRecord(
      await readResponseJson(response, "claude", task),
      "claude",
      task,
      "Claude response",
    );
    const content = payload["content"];
    if (!Array.isArray(content)) {
      throw new AIProviderResponseError({
        provider: "claude",
        task,
        message: "content was not an array",
      });
    }
    const firstBlock = requireRecord(content[0], "claude", task, "first content block");
    return parseProviderJson(
      "claude",
      task,
      requireString(firstBlock["text"], "claude", task, "content text"),
    );
  }
}
