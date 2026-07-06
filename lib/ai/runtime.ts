import type { AIAdapter } from "@/lib/ai/adapter";
import { MockAIAdapter } from "@/lib/ai/mockAdapter";
import { ClaudeAIAdapter, OpenAIAdapter } from "@/lib/ai/providerAdapters";

export class AIAdapterConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AIAdapterConfigurationError";
  }
}

type AIAdapterMode = "mock" | "openai" | "claude";

type RuntimeEnv = {
  readonly AI_ADAPTER?: string;
  readonly AI_ADAPTER_ALLOW_MOCK?: string;
  readonly NODE_ENV?: string;
  readonly OPENAI_API_KEY?: string;
  readonly CLAUDE_API_KEY?: string;
};

type RuntimeAIAdapterOptions = {
  readonly fetch?:
    | ((input: string | URL | Request, init?: RequestInit) => Promise<Response>)
    | undefined;
  readonly openAIModel?: string | undefined;
  readonly claudeModel?: string | undefined;
};

const supportedAdapterModes = new Set<string>(["mock", "openai", "claude"]);

function readAdapterMode(env: RuntimeEnv): AIAdapterMode {
  const rawMode = env.AI_ADAPTER?.trim().toLowerCase();

  if (rawMode === undefined || rawMode === "") {
    throw new AIAdapterConfigurationError(
      "AI_ADAPTER is required. Set AI_ADAPTER=mock only for explicit test/development mock mode, or configure AI_ADAPTER=openai|claude with provider credentials.",
    );
  }

  if (!supportedAdapterModes.has(rawMode)) {
    throw new AIAdapterConfigurationError(
      `Unsupported AI_ADAPTER value "${rawMode}". Expected one of: mock, openai, claude.`,
    );
  }

  return rawMode as AIAdapterMode;
}

function requireEnvValue(env: RuntimeEnv, key: keyof RuntimeEnv, adapter: AIAdapterMode): string {
  const value = env[key]?.trim();
  if (value === undefined || value === "") {
    throw new AIAdapterConfigurationError(
      `AI_ADAPTER=${adapter} requires ${key}. Configure ${key} before starting runtime AI generation.`,
    );
  }
  return value;
}

function assertMockModeAllowed(env: RuntimeEnv): void {
  if (env.NODE_ENV === "production") {
    throw new AIAdapterConfigurationError(
      "AI_ADAPTER=mock is not allowed in production. Configure AI_ADAPTER=openai|claude with provider credentials.",
    );
  }

  if (env.NODE_ENV !== "test" && env.AI_ADAPTER_ALLOW_MOCK !== "true") {
    throw new AIAdapterConfigurationError(
      "AI_ADAPTER=mock requires NODE_ENV=test or AI_ADAPTER_ALLOW_MOCK=true for explicit development mock mode.",
    );
  }
}

export function createRuntimeAIAdapter(
  env: RuntimeEnv = process.env,
  options: RuntimeAIAdapterOptions = {},
): AIAdapter {
  const mode = readAdapterMode(env);

  if (mode === "mock") {
    assertMockModeAllowed(env);
    return new MockAIAdapter();
  }

  if (mode === "openai") {
    const apiKey = requireEnvValue(env, "OPENAI_API_KEY", mode);
    return new OpenAIAdapter({
      apiKey,
      fetch: options.fetch,
      model: options.openAIModel,
    });
  }

  const apiKey = requireEnvValue(env, "CLAUDE_API_KEY", mode);
  return new ClaudeAIAdapter({
    apiKey,
    fetch: options.fetch,
    model: options.claudeModel,
  });
}
