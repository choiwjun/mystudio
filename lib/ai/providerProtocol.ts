import { parseScoreOutput } from "@/lib/ai/adapter";
import type { CostLogInput } from "@/lib/logging/costLogger";

export type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
export type ProviderName = "openai" | "claude" | "ollama";
export type ProviderCostLogger = (input: CostLogInput) => Promise<void> | void;

export type ProviderAdapterOptions = {
  readonly apiKey: string;
  readonly fetch?: FetchLike | undefined;
  readonly model?: string | undefined;
  readonly costLogger?: ProviderCostLogger | undefined;
};

export class AIProviderResponseError extends Error {
  readonly code = "AI_PROVIDER_RESPONSE_INVALID";
  readonly provider: ProviderName;
  readonly task: string;

  constructor(input: {
    readonly provider: ProviderName;
    readonly task: string;
    readonly message: string;
  }) {
    super(`${input.provider} returned an invalid AI response for ${input.task}: ${input.message}`);
    this.name = "AIProviderResponseError";
    this.provider = input.provider;
    this.task = input.task;
  }
}

export function resolveFetch(provider: ProviderName, fetchImpl: FetchLike | undefined): FetchLike {
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

export function parseProviderJson(provider: ProviderName, task: string, content: string): unknown {
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

export async function readResponseJson(
  response: Response,
  provider: ProviderName,
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

export function requireRecord(
  value: unknown,
  provider: ProviderName,
  task: string,
  context: string,
): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new AIProviderResponseError({ provider, task, message: `${context} was not an object` });
  }
  return value as Record<string, unknown>;
}

export function requireString(
  value: unknown,
  provider: ProviderName,
  task: string,
  context: string,
): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new AIProviderResponseError({ provider, task, message: `${context} was empty` });
  }
  return value;
}

export function scoreFromJson(provider: ProviderName, task: string, value: unknown): number {
  const record = requireRecord(value, provider, task, "score response");
  return parseScoreOutput(record["score"]);
}
