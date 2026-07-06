import { prisma } from "@/lib/db";

export type PipelineStep = "hermes" | "content" | "compliance" | "export" | "hq";

export type CostLogInput = {
  readonly model: string;
  readonly task: string;
  readonly pipelineStep: PipelineStep;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly costUsd: number;
  readonly blockedByCap: boolean;
};

export class CostLoggingDisabledError extends Error {
  constructor() {
    super("Cost logging cannot be disabled outside test mode.");
    this.name = "CostLoggingDisabledError";
  }
}

export async function recordCostLog(input: CostLogInput): Promise<void> {
  if (process.env["COST_LOG_ENABLED"] === "false") {
    if (process.env["NODE_ENV"] === "test") {
      return;
    }
    throw new CostLoggingDisabledError();
  }

  await prisma.costLog.create({
    data: input,
  });
}
