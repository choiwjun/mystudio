import ollama, { type ChatRequest, Ollama } from "ollama";
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
  AIProviderResponseError,
  parseProviderJson,
  scoreFromJson,
} from "@/lib/ai/providerProtocol";

type OllamaChatMessage = {
  readonly role: "system" | "user";
  readonly content: string;
};

type OllamaChatRequest = {
  model: string;
  messages: OllamaChatMessage[];
  stream: false;
  format: "json";
  options: { temperature: number };
} & ChatRequest;

type OllamaChatResponse = {
  readonly message?: {
    readonly content?: string;
  };
};

export type OllamaChatClient = {
  chat(request: OllamaChatRequest): Promise<OllamaChatResponse>;
};

export type OllamaAdapterOptions = {
  readonly client?: OllamaChatClient | undefined;
  readonly apiKey?: string | undefined;
  readonly fetch?: typeof fetch | undefined;
  readonly host?: string | undefined;
  readonly model?: string | undefined;
};

export const defaultOllamaModel = "deepseek-v4-flash:cloud";

function isDirectOllamaCloudHost(host: string | undefined): boolean {
  const resolvedHost = host?.trim();
  if (resolvedHost === undefined || resolvedHost === "") {
    return false;
  }
  try {
    return new URL(resolvedHost).hostname === "ollama.com";
  } catch {
    return resolvedHost === "https://ollama.com";
  }
}

function resolveOllamaModel(model: string | undefined, host: string | undefined): string {
  const resolvedModel = model ?? defaultOllamaModel;
  if (isDirectOllamaCloudHost(host) && resolvedModel.endsWith(":cloud")) {
    return resolvedModel.slice(0, -":cloud".length);
  }
  return resolvedModel;
}

function createOllamaClient(
  host: string | undefined,
  apiKey: string | undefined,
  fetcher: typeof fetch | undefined,
): OllamaChatClient {
  const resolvedHost = host?.trim();
  const resolvedApiKey = apiKey?.trim();
  const headers =
    resolvedApiKey === undefined || resolvedApiKey === ""
      ? undefined
      : { Authorization: `Bearer ${resolvedApiKey}` };
  const shouldCreateClient =
    (resolvedHost !== undefined && resolvedHost !== "") || headers !== undefined;
  const config = {
    ...(resolvedHost === undefined || resolvedHost === "" ? {} : { host: resolvedHost }),
    ...(fetcher === undefined ? {} : { fetch: fetcher }),
    ...(headers === undefined ? {} : { headers }),
  };
  const client = shouldCreateClient ? new Ollama(config) : ollama;
  return {
    chat: async (request) => client.chat(request),
  };
}

function readOllamaContent(response: OllamaChatResponse, task: string): string {
  const content = response.message?.content;
  if (typeof content !== "string" || content.trim() === "") {
    throw new AIProviderResponseError({
      provider: "ollama",
      task,
      message: "message content was empty",
    });
  }
  return content;
}

export class OllamaAdapter implements AIAdapter {
  private readonly client: OllamaChatClient;
  private readonly model: string;
  readonly metadata: { readonly provider: "ollama"; readonly model: string };

  constructor(options: OllamaAdapterOptions = {}) {
    this.client = options.client ?? createOllamaClient(options.host, options.apiKey, options.fetch);
    this.model = resolveOllamaModel(options.model, options.host);
    this.metadata = { provider: "ollama", model: this.model };
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
    return scoreFromJson("ollama", "scoreHomefeed", await this.requestJson("scoreHomefeed", draft));
  }

  async checkCompliance(input: ComplianceInput): Promise<ComplianceOutput> {
    return parseComplianceOutput(await this.requestJson("checkCompliance", input));
  }

  async generateDailyBriefing(input: DailyBriefingInput): Promise<DailyBriefingOutput> {
    return parseDailyBriefingOutput(await this.requestJson("generateDailyBriefing", input));
  }

  private async requestJson(task: string, input: unknown): Promise<unknown> {
    const response = await this.callChat(task, input);
    return parseProviderJson("ollama", task, readOllamaContent(response, task));
  }

  private async callChat(task: string, input: unknown): Promise<OllamaChatResponse> {
    try {
      return await this.client.chat({
        model: this.model,
        stream: false,
        format: "json",
        options: { temperature: 0.2 },
        messages: [
          { role: "system", content: providerSystemPrompt() },
          { role: "user", content: buildProviderPrompt(task, input) },
        ],
      });
    } catch (error) {
      if (error instanceof Error) {
        throw new AIProviderResponseError({
          provider: "ollama",
          task,
          message: error.message,
        });
      }
      throw new AIProviderResponseError({
        provider: "ollama",
        task,
        message: "chat request failed",
      });
    }
  }
}
