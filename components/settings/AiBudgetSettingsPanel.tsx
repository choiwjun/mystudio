"use client";

import { useEffect, useState } from "react";
import { type HqStatusData, hqStatusResponseSchema } from "@/components/hq/HqStatusBadge";

type AiBudget = HqStatusData["ai_budget"];

export const AI_BUDGET_KIND_LABELS: Record<AiBudget["kind"], string> = {
  within_budget: "정상",
  soft_warning: "주의 (70% 이상 사용)",
  hard_blocked: "한도 초과 (생성 차단)",
};

export type AiBudgetSummary = {
  readonly capText: string;
  readonly usedText: string;
  readonly remainingText: string;
  readonly usageRateText: string;
  readonly statusLabel: string;
};

export function formatAiBudgetSummary(budget: AiBudget): AiBudgetSummary {
  return {
    capText: `$${budget.capUsd.toFixed(2)}`,
    usedText: `$${budget.totalCostUsd.toFixed(2)}`,
    remainingText: `$${budget.remainingUsd.toFixed(2)}`,
    usageRateText: `${budget.usageRate}%`,
    statusLabel: AI_BUDGET_KIND_LABELS[budget.kind] ?? budget.kind,
  };
}

export function AiBudgetSettingsPanel() {
  const [budget, setBudget] = useState<AiBudget | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let active = true;

    async function load(): Promise<void> {
      try {
        const response = await fetch("/api/hq/status");
        if (!response.ok) {
          throw new Error("HQ_STATUS_LOAD_FAILED");
        }
        const data = hqStatusResponseSchema.parse(await response.json()).data;
        if (!active) {
          return;
        }
        setBudget(data.ai_budget);
        setLoadState("ready");
      } catch {
        if (active) {
          setLoadState("error");
        }
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, []);

  const summary = budget === null ? null : formatAiBudgetSummary(budget);

  return (
    <section className="section-block" aria-label="AI 예산">
      <h3>AI 예산</h3>
      <p className="muted">
        일일 AI 생성 비용 한도는 <code>DAILY_AI_COST_CAP_USD</code> 환경변수로 설정하며 기본값은
        $5.00입니다. 70% 사용 시 HQ 배지에 주의 경고가 표시되고, 100% 도달 시 신규 생성이
        차단됩니다. 외부 결제/청구 플로우는 제공하지 않습니다.
      </p>

      {loadState === "loading" ? (
        <p className="muted">오늘의 AI 예산 사용량을 불러오는 중입니다.</p>
      ) : null}
      {loadState === "error" ? (
        <p className="form-error">AI 예산 사용량을 불러오지 못했습니다.</p>
      ) : null}

      {loadState === "ready" && budget !== null && summary !== null ? (
        <>
          <dl className="budget-grid" aria-label="일일 AI 예산 사용 현황">
            <div>
              <dt className="muted">일일 한도</dt>
              <dd>{summary.capText}</dd>
            </div>
            <div>
              <dt className="muted">오늘 사용액</dt>
              <dd>{summary.usedText}</dd>
            </div>
            <div>
              <dt className="muted">남은 예산</dt>
              <dd>{summary.remainingText}</dd>
            </div>
            <div>
              <dt className="muted">사용률</dt>
              <dd>{summary.usageRateText}</dd>
            </div>
          </dl>
          <progress
            aria-label={`AI 예산 사용률 ${summary.usageRateText}`}
            className="progress-meter"
            max={100}
            value={Math.min(budget.usageRate, 100)}
          />
          <p className={budget.kind === "within_budget" ? "muted" : "form-error"}>
            상태: {summary.statusLabel}
          </p>
        </>
      ) : null}
    </section>
  );
}
