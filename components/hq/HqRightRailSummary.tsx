"use client";

import { useEffect, useMemo, useState } from "react";
import { z } from "zod";

const complianceSeverityValues = ["low", "medium", "high"] as const;

type ComplianceSeverity = (typeof complianceSeverityValues)[number];
type SeverityCounts = Record<ComplianceSeverity, number>;

const complianceIssueSchema = z.object({
  severity: z.enum(complianceSeverityValues),
});

const complianceCheckSchema = z.object({
  risk_level: z.string(),
  pass: z.boolean(),
  issues: z.array(complianceIssueSchema),
});

const rightRailPackageSchema = z.object({
  compliance_checks: z.array(complianceCheckSchema),
});

const hqRightRailResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    hq_status: z.object({
      status: z.string(),
      reason: z.string(),
      pending_approvals: z.number().int().nonnegative(),
      compliance_failures: z.number().int().nonnegative(),
      needs_performance_log: z.number().int().nonnegative(),
    }),
    revenue_summary: z.object({
      month_total: z.number().int().nonnegative(),
      direct_total: z.number().int().nonnegative(),
      indirect_total: z.number().int().nonnegative(),
      goal_monthly: z.number().int().nonnegative(),
      progress_rate: z.number().int().nonnegative(),
      top_content_title: z.string().nullable(),
      top_content_revenue: z.number().int().nonnegative(),
    }),
    content_packages: z.array(rightRailPackageSchema),
  }),
});

type HqRightRailData = z.infer<typeof hqRightRailResponseSchema>["data"];

const emptySeverityCounts: SeverityCounts = {
  low: 0,
  medium: 0,
  high: 0,
};

function toComplianceSeverity(value: string): ComplianceSeverity | null {
  switch (value) {
    case "low":
      return "low";
    case "medium":
      return "medium";
    case "high":
      return "high";
    default:
      return null;
  }
}

function formatWon(value: number): string {
  return `${value.toLocaleString("ko-KR")}원`;
}

export function complianceSeverityCounts(
  contentPackages: readonly z.infer<typeof rightRailPackageSchema>[],
): SeverityCounts {
  const counts: SeverityCounts = { ...emptySeverityCounts };
  for (const contentPackage of contentPackages) {
    const latestCheck = contentPackage.compliance_checks[0];
    if (latestCheck === undefined) {
      continue;
    }
    if (latestCheck.issues.length > 0) {
      for (const issue of latestCheck.issues) {
        counts[issue.severity] += 1;
      }
      continue;
    }
    const riskLevel = toComplianceSeverity(latestCheck.risk_level);
    if (!latestCheck.pass && riskLevel !== null) {
      counts[riskLevel] += 1;
    }
  }
  return counts;
}

export function HqRightRailSummary() {
  const [summary, setSummary] = useState<HqRightRailData | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const severityCounts = useMemo(
    () => complianceSeverityCounts(summary?.content_packages ?? []),
    [summary],
  );

  useEffect(() => {
    let active = true;

    fetch("/api/hq/today")
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("HQ_RIGHT_RAIL_FAILED");
        }
        return hqRightRailResponseSchema.parse(await response.json());
      })
      .then((payload) => {
        if (!active) {
          return;
        }
        setSummary(payload.data);
        setStatus("ready");
      })
      .catch(() => {
        if (active) {
          setStatus("error");
        }
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <>
      <section className="section-block">
        <h3>Owner Approval Queue</h3>
        {status === "loading" ? <p className="muted">승인 대기 상태를 불러오는 중입니다.</p> : null}
        {status === "error" ? <p className="form-error">승인 대기 상태를 불러오지 못했습니다.</p> : null}
        {status === "ready" && summary !== null ? (
          <>
            <p>{summary.hq_status.pending_approvals.toLocaleString("ko-KR")}건 승인 대기</p>
            <p className="muted">
              성과 미기록 {summary.hq_status.needs_performance_log.toLocaleString("ko-KR")}건 ·{" "}
              {summary.hq_status.reason}
            </p>
          </>
        ) : null}
      </section>
      <section className="section-block">
        <h3>Compliance Alerts</h3>
        {status === "loading" ? <p className="muted">검수 알림을 불러오는 중입니다.</p> : null}
        {status === "error" ? <p className="form-error">검수 알림을 불러오지 못했습니다.</p> : null}
        {status === "ready" && summary !== null ? (
          <>
            <p className={summary.hq_status.compliance_failures > 0 ? "form-error" : "muted"}>
              검수 실패 {summary.hq_status.compliance_failures.toLocaleString("ko-KR")}건
            </p>
            <div className="severity-grid" aria-label="Compliance severity counts">
              <span className="badge">High {severityCounts.high}</span>
              <span className="badge">Medium {severityCounts.medium}</span>
              <span className="badge">Low {severityCounts.low}</span>
            </div>
          </>
        ) : null}
      </section>
      <section className="section-block">
        <h3>Revenue Snapshot</h3>
        {status === "loading" ? <p className="muted">수익 스냅샷을 불러오는 중입니다.</p> : null}
        {status === "error" ? <p className="form-error">수익 스냅샷을 불러오지 못했습니다.</p> : null}
        {status === "ready" && summary !== null ? (
          <>
            <p>
              이번 달 {formatWon(summary.revenue_summary.month_total)} / 목표{" "}
              {formatWon(summary.revenue_summary.goal_monthly)}
            </p>
            <progress
              aria-label={`월 수익 목표 진행률 ${summary.revenue_summary.progress_rate}%`}
              className="progress-meter"
              max={100}
              value={Math.min(summary.revenue_summary.progress_rate, 100)}
            />
            <p className="muted">
              Top content: {summary.revenue_summary.top_content_title ?? "없음"} ·{" "}
              {formatWon(summary.revenue_summary.top_content_revenue)}
            </p>
          </>
        ) : null}
      </section>
    </>
  );
}
