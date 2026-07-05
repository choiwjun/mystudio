import { prisma } from "@/lib/db";

export type PipelineStep = "hermes" | "content" | "compliance" | "export";

export type CostLogInput = {
  readonly model: string;
  readonly task: string;
  readonly pipelineStep: PipelineStep;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly costUsd: number;
  readonly blockedByCap: boolean;
};

export async function recordCostLog(input: CostLogInput): Promise<void> {
  if (process.env["COST_LOG_ENABLED"] === "false") {
    return;
  }

  await prisma.costLog.create({
    data: input,
  });
}
