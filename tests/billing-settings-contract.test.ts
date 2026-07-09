import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  AI_BUDGET_KIND_LABELS,
  formatAiBudgetSummary,
} from "@/components/settings/AiBudgetSettingsPanel";
import { DEFAULT_DAILY_AI_COST_CAP_USD, evaluateDailyAiBudget } from "@/lib/logging/costBudget";

const settingsSpecSource = readFileSync("specs/screens/settings.yaml", "utf8");
const settingsPageSource = readFileSync("app/(app)/settings/page.tsx", "utf8");
const aiBudgetPanelSource = readFileSync("components/settings/AiBudgetSettingsPanel.tsx", "utf8");
const trdSource = readFileSync("docs/planning/02-trd.md", "utf8");

describe("billing settings contract", () => {
  it("maps every AI budget guard kind to a Korean label", () => {
    expect(Object.keys(AI_BUDGET_KIND_LABELS).sort()).toEqual([
      "hard_blocked",
      "soft_warning",
      "within_budget",
    ]);
    expect(AI_BUDGET_KIND_LABELS["within_budget"]).toContain("정상");
    expect(AI_BUDGET_KIND_LABELS["soft_warning"]).toContain("70%");
    expect(AI_BUDGET_KIND_LABELS["hard_blocked"]).toContain("차단");
  });

  it("formats the daily AI budget guard result into the settings display contract", () => {
    const budget = evaluateDailyAiBudget({
      capUsd: DEFAULT_DAILY_AI_COST_CAP_USD,
      totalCostUsd: 3.5,
      nextCostUsd: 0,
    });

    expect(budget.kind).toBe("soft_warning");
    expect(formatAiBudgetSummary(budget)).toEqual({
      capText: "$5.00",
      usedText: "$3.50",
      remainingText: "$1.50",
      usageRateText: "70%",
      statusLabel: AI_BUDGET_KIND_LABELS["soft_warning"],
    });
  });

  it("labels a hard-blocked budget so the settings panel warns the owner", () => {
    const budget = evaluateDailyAiBudget({
      capUsd: DEFAULT_DAILY_AI_COST_CAP_USD,
      totalCostUsd: 4.95,
      nextCostUsd: 0.1,
    });

    expect(budget.kind).toBe("hard_blocked");
    expect(formatAiBudgetSummary(budget).statusLabel).toBe(AI_BUDGET_KIND_LABELS["hard_blocked"]);
  });

  it("documents the daily cap source and reuses the HQ status budget feed", () => {
    expect(aiBudgetPanelSource).toContain("DAILY_AI_COST_CAP_USD");
    expect(aiBudgetPanelSource).toContain('fetch("/api/hq/status")');
    expect(aiBudgetPanelSource).toContain("hqStatusResponseSchema");
    expect(aiBudgetPanelSource).not.toContain("stripe");
    expect(aiBudgetPanelSource).not.toContain("Stripe");
    expect(aiBudgetPanelSource).toContain("외부 결제/청구 플로우는 제공하지 않습니다.");
  });

  it("renders the AI budget panel on the settings screen without regressing profile settings copy", () => {
    expect(settingsPageSource).toContain("AiBudgetSettingsPanel");
    expect(settingsPageSource).toContain(
      'import { AiBudgetSettingsPanel } from "@/components/settings/AiBudgetSettingsPanel"',
    );
    expect(settingsPageSource).toContain("주요/차단 카테고리");
    expect(settingsPageSource).not.toContain("금지 단어");
  });

  it("keeps the settings spec aligned with the two-stage circuit breaker in the TRD", () => {
    expect(settingsSpecSource).toContain("ai_budget");
    expect(settingsSpecSource).toContain("DAILY_AI_COST_CAP_USD");
    expect(settingsSpecSource).toContain("soft_warning");
    expect(settingsSpecSource).toContain("hard_blocked");
    expect(settingsSpecSource).toContain("GET /api/hq/status");
    expect(settingsSpecSource).toContain("70");
    expect(settingsSpecSource).toContain("100");
    expect(trdSource).toContain("AI 생성 비용 72% 사용 중");
  });
});
