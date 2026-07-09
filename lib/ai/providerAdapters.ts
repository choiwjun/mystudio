import type {
  AIAdapter,
  BlogDraftOutput,
  ComplianceInput,
  ComplianceOutput,
  ContentInput,
  DailyBriefingInput,
  DailyBriefingOutput,
  HermesInput,
  OpportunityMemoOutput,
  SearchStructureOutput,
  SnsProfile,
  SnsVariantOutput,
} from "@/lib/ai/adapter";
import {
  parseBlogDraftOutput,
  parseComplianceOutput,
  parseDailyBriefingOutput,
  parseOpportunityMemoOutput,
  parseSearchStructureOutput,
  parseSnsVariantOutput,
} from "@/lib/ai/adapter";
import { buildProviderPrompt, providerSystemPrompt } from "@/lib/ai/departmentPrompts";
import {
  claudeUsage,
  estimateCostUsd,
  openAIUsage,
  pipelineStepForTask,
  providerModelIdentity,
  requireRuntimeCostLogger,
} from "@/lib/ai/providerCost";
import {
  AIProviderResponseError,
  type FetchLike,
  type ProviderAdapterOptions,
  type ProviderCostLogger,
  parseProviderJson,
  readResponseJson,
  requireRecord,
  requireString,
  resolveFetch,
  scoreFromJson,
} from "@/lib/ai/providerProtocol";

export { AIProviderResponseError };

export class OpenAIAdapter implements AIAdapter {
  private readonly apiKey: string;
  private readonly fetchImpl: FetchLike;
  private readonly model: string;
  private readonly costLogger: ProviderCostLogger | undefined;
  readonly metadata: { readonly provider: "openai"; readonly model: string };

  constructor(options: ProviderAdapterOptions) {
    this.apiKey = options.apiKey;
    this.fetchImpl = resolveFetch("openai", options.fetch);
    this.model = options.model ?? "gpt-4o-mini";
    this.costLogger = options.costLogger;
    this.metadata = { provider: "openai", model: this.model };
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

  async generateDailyBriefing(input: DailyBriefingInput): Promise<DailyBriefingOutput> {
    return parseDailyBriefingOutput(await this.requestJson("generateDailyBriefing", input));
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
            content: providerSystemPrompt(),
          },
          { role: "user", content: buildProviderPrompt(task, input) },
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
    const content = requireString(message["content"], "openai", task, "message content");
    await this.recordCostLog(task, payload);
    return parseProviderJson("openai", task, content);
  }

  private async recordCostLog(task: string, payload: Record<string, unknown>): Promise<void> {
    const costLogger = requireRuntimeCostLogger("openai", task, this.costLogger);
    if (costLogger === null) {
      return;
    }

    const usage = openAIUsage(payload, task);
    const modelIdentity = providerModelIdentity("openai", this.model);
    await costLogger({
      model: modelIdentity,
      task,
      pipelineStep: pipelineStepForTask(task),
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      costUsd: estimateCostUsd("openai", task, modelIdentity, usage),
      blockedByCap: false,
    });
  }
}

export class ClaudeAIAdapter implements AIAdapter {
  private readonly apiKey: string;
  private readonly fetchImpl: FetchLike;
  private readonly model: string;
  private readonly costLogger: ProviderCostLogger | undefined;
  readonly metadata: { readonly provider: "claude"; readonly model: string };

  constructor(options: ProviderAdapterOptions) {
    this.apiKey = options.apiKey;
    this.fetchImpl = resolveFetch("claude", options.fetch);
    this.model = options.model ?? "claude-3-5-haiku-latest";
    this.costLogger = options.costLogger;
    this.metadata = { provider: "claude", model: this.model };
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

  async generateDailyBriefing(input: DailyBriefingInput): Promise<DailyBriefingOutput> {
    return parseDailyBriefingOutput(await this.requestJson("generateDailyBriefing", input));
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
        system: providerSystemPrompt(),
        messages: [{ role: "user", content: buildProviderPrompt(task, input) }],
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
    const contentText = requireString(firstBlock["text"], "claude", task, "content text");
    await this.recordCostLog(task, payload);
    return parseProviderJson("claude", task, contentText);
  }

  private async recordCostLog(task: string, payload: Record<string, unknown>): Promise<void> {
    const costLogger = requireRuntimeCostLogger("claude", task, this.costLogger);
    if (costLogger === null) {
      return;
    }

    const usage = claudeUsage(payload, task);
    const modelIdentity = providerModelIdentity("claude", this.model);
    await costLogger({
      model: modelIdentity,
      task,
      pipelineStep: pipelineStepForTask(task),
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      costUsd: estimateCostUsd("claude", task, modelIdentity, usage),
      blockedByCap: false,
    });
  }
}
