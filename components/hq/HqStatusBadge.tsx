"use client";

import { useEffect, useState } from "react";
import { z } from "zod";

export const hqStatusRefreshEvent = "paperclip:hq-status-refresh";

export const hqStatusResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    status: z.string().min(1),
    reason: z.string().min(1),
    needs_performance_log: z.number().int().nonnegative(),
    ai_budget: z.object({
      kind: z.string().min(1),
      totalCostUsd: z.number(),
      capUsd: z.number(),
      usageRate: z.number(),
      remainingUsd: z.number(),
    }),
  }),
});

export type HqStatusData = z.infer<typeof hqStatusResponseSchema>["data"];

type HqStatusBadgeProps = {
  readonly compact?: boolean;
};

const statusLabels: Record<string, string> = {
  Good: "Good",
  Warning: "Warning",
  Focus: "Focus",
  Revenue: "Revenue",
};

function formatAiBudget(budget: HqStatusData["ai_budget"]): string {
  return `AI ${budget.usageRate}% · $${budget.totalCostUsd.toFixed(2)}/$${budget.capUsd.toFixed(2)}`;
}

export function formatHqStatusText(status: HqStatusData, compact: boolean): string {
  const statusLabel = statusLabels[status.status] ?? status.status;
  const missingText = compact
    ? `미기록 ${status.needs_performance_log.toLocaleString("ko-KR")}건`
    : `성과 미기록 ${status.needs_performance_log.toLocaleString("ko-KR")}건`;
  return compact
    ? `Status ${statusLabel} · ${missingText}`
    : `Status ${statusLabel} · ${missingText} · ${formatAiBudget(status.ai_budget)}`;
}
async function fetchHqStatus(): Promise<HqStatusData> {
  const response = await fetch("/api/hq/status");
  if (!response.ok) {
    throw new Error("HQ_STATUS_LOAD_FAILED");
  }
  return hqStatusResponseSchema.parse(await response.json()).data;
}

export function requestHqStatusRefresh(): void {
  window.dispatchEvent(new Event(hqStatusRefreshEvent));
}

export function HqStatusBadge({ compact = false }: HqStatusBadgeProps) {
  const [status, setStatus] = useState<HqStatusData | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let active = true;

    async function refreshStatus(): Promise<void> {
      try {
        const nextStatus = await fetchHqStatus();
        if (!active) {
          return;
        }
        setStatus(nextStatus);
        setLoadState("ready");
      } catch {
        if (active) {
          setLoadState("error");
        }
      }
    }

    function handleStatusRefresh(): void {
      void refreshStatus();
    }

    void refreshStatus();
    window.addEventListener(hqStatusRefreshEvent, handleStatusRefresh);

    return () => {
      active = false;
      window.removeEventListener(hqStatusRefreshEvent, handleStatusRefresh);
    };
  }, []);

  if (loadState === "loading") {
    return <span className="badge">Status 확인 중</span>;
  }

  if (loadState === "error" || status === null) {
    return <span className="badge">Status 확인 실패</span>;
  }

  return (
    <span className="badge" title={status.reason}>
      {formatHqStatusText(status, compact)}
    </span>
  );
}
