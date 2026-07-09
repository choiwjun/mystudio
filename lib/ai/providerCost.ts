import {
  AIProviderResponseError,
  type ProviderCostLogger,
  type ProviderName,
} from "@/lib/ai/providerProtocol";
import type { CostLogInput, PipelineStep } from "@/lib/logging/costLogger";

type ProviderUsage = Pick<CostLogInput, "inputTokens" | "outputTokens">;

type ModelTokenPricing = {
  readonly inputUsdPerMillion: number;
  readonly outputUsdPerMillion: number;
};

const modelTokenPricing: Record<string, ModelTokenPricing> = {
  "openai:gpt-4o-mini": { inputUsdPerMillion: 0.15, outputUsdPerMillion: 0.6 },
  "claude:claude-3-5-haiku-latest": {
    inputUsdPerMillion: 0.8,
    outputUsdPerMillion: 4,
  },
};

export function pipelineStepForTask(task: string): PipelineStep {
  switch (task) {
    case "generateOpportunityMemo":
      return "hermes";
    case "checkCompliance":
      return "compliance";
    case "generateDailyBriefing":
      return "hq";
    default:
      return "content";
  }
}

export function providerModelIdentity(provider: ProviderName, model: string): string {
  return `${provider}:${model}`;
}

export function requireRuntimeCostLogger(
  provider: ProviderName,
  task: string,
  costLogger: ProviderCostLogger | undefined,
): ProviderCostLogger | null {
  if (costLogger !== undefined) {
    return costLogger;
  }
  if (process.env["NODE_ENV"] === "test") {
    return null;
  }
  throw new AIProviderResponseError({
    provider,
    task,
    message: "provider cost logger is required outside test mode",
  });
}

function requireUsageRecord(
  payload: Record<string, unknown>,
  provider: ProviderName,
  task: string,
): Record<string, unknown> {
  const usage = payload["usage"];
  if (typeof usage !== "object" || usage === null || Array.isArray(usage)) {
    throw new AIProviderResponseError({
      provider,
      task,
      message: "provider usage metering was missing",
    });
  }
  return usage as Record<string, unknown>;
}

function readRequiredTokenCount(
  value: unknown,
  provider: ProviderName,
  task: string,
  field: string,
): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new AIProviderResponseError({
      provider,
      task,
      message: `provider usage ${field} was missing or invalid`,
    });
  }
  return Math.trunc(value);
}

function readUsageTokenCount(
  usage: Record<string, unknown>,
  provider: ProviderName,
  task: string,
  primaryField: string,
  fallbackField?: string,
): number {
  return readRequiredTokenCount(
    usage[primaryField] ?? (fallbackField === undefined ? undefined : usage[fallbackField]),
    provider,
    task,
    fallbackField === undefined ? primaryField : `${primaryField}/${fallbackField}`,
  );
}

export function openAIUsage(payload: Record<string, unknown>, task: string): ProviderUsage {
  const usage = requireUsageRecord(payload, "openai", task);
  return {
    inputTokens: readUsageTokenCount(usage, "openai", task, "prompt_tokens", "input_tokens"),
    outputTokens: readUsageTokenCount(usage, "openai", task, "completion_tokens", "output_tokens"),
  };
}

export function claudeUsage(payload: Record<string, unknown>, task: string): ProviderUsage {
  const usage = requireUsageRecord(payload, "claude", task);
  return {
    inputTokens: readUsageTokenCount(usage, "claude", task, "input_tokens"),
    outputTokens: readUsageTokenCount(usage, "claude", task, "output_tokens"),
  };
}

export function estimateCostUsd(
  provider: ProviderName,
  task: string,
  modelIdentity: string,
  usage: ProviderUsage,
): number {
  const pricing = modelTokenPricing[modelIdentity];
  if (pricing === undefined) {
    throw new AIProviderResponseError({
      provider,
      task,
      message: `token pricing is not configured for ${modelIdentity}`,
    });
  }

  return Number(
    (
      (usage.inputTokens * pricing.inputUsdPerMillion +
        usage.outputTokens * pricing.outputUsdPerMillion) /
      1_000_000
    ).toFixed(6),
  );
}
