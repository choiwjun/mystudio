import type { DailyAiBudgetStatus } from "@/lib/logging/costBudget";

export type HqStatusInput = {
  readonly pendingApprovals: number;
  readonly complianceFailures: number;
  readonly needsPerformanceLog: number;
  readonly monthRevenue: number;
  readonly revenueGoal: number;
  readonly aiBudget?: DailyAiBudgetStatus;
};

export function calculateHqStatus(input: HqStatusInput): {
  readonly status: "Good" | "Warning" | "Revenue" | "Focus";
  readonly reason: string;
} {
  if (input.complianceFailures > 0) {
    return {
      status: "Warning",
      reason: `High risk 또는 검수 실패 콘텐츠 ${input.complianceFailures}건이 있습니다.`,
    };
  }
  if (input.aiBudget?.kind === "hard_blocked") {
    return {
      status: "Warning",
      reason: "오늘의 AI 생성 한도를 모두 사용했습니다.",
    };
  }
  if (input.aiBudget?.kind === "soft_warning") {
    return {
      status: "Warning",
      reason: `AI 생성 비용 ${input.aiBudget.usageRate}% 사용 중입니다.`,
    };
  }
  if (input.needsPerformanceLog > 0) {
    return {
      status: "Focus",
      reason: `성과 미기록 콘텐츠 ${input.needsPerformanceLog}건을 입력해야 합니다.`,
    };
  }
  if (input.revenueGoal > 0 && input.monthRevenue < input.revenueGoal * 0.5) {
    return {
      status: "Revenue",
      reason: "이번 달 수익이 목표 대비 50% 미만입니다.",
    };
  }
  if (input.pendingApprovals > 0) {
    return {
      status: "Focus",
      reason: `승인 대기 콘텐츠 ${input.pendingApprovals}건이 있습니다.`,
    };
  }
  return { status: "Good", reason: "모든 콘텐츠 파이프라인이 정상 범위입니다." };
}
