"use client";

import ky, { HTTPError } from "ky";
import { useEffect, useState } from "react";
import type { ApiResponse } from "@/lib/api/response";

type SessionPayload = { readonly csrf_token: string };
type SummaryPayload = {
  readonly summary: {
    readonly average_views: number;
    readonly average_clicks: number;
    readonly average_revenue: number;
    readonly best_hook_type: string | null;
  };
};
type ContentPackagePayload = {
  readonly content_packages: readonly {
    readonly id: string;
    readonly topic: { readonly title: string };
    readonly status: string;
  }[];
};

type WinningPatternsPayload = {
  readonly hook_type_stats: readonly {
    readonly hook_type: string;
    readonly sample_count: number;
    readonly average_views: number;
  }[];
  readonly refresh_candidates: {
    readonly stale_products_count: number;
    readonly stale_links_count: number;
  };
};


const hookTypes = ["problem_empathy", "comparison_choice", "checklist", "seasonal_timing"] as const;

async function getApiData<T>(url: string): Promise<T> {
  const response = await ky.get(url).json<ApiResponse<T>>();
  if (!response.success || response.data === null) {
    throw new Error("API response failed.");
  }
  return response.data;
}

export function PerformanceRecorder() {
  const [csrfToken, setCsrfToken] = useState("");
  const [postUrl, setPostUrl] = useState("");
  const [views, setViews] = useState("");
  const [clicks, setClicks] = useState("");
  const [directRevenue, setDirectRevenue] = useState("");
  const [hookType, setHookType] = useState("problem_empathy");
  const [contentPackageId, setContentPackageId] = useState("");
  const [message, setMessage] = useState("");
  const [summary, setSummary] = useState<SummaryPayload["summary"]>({
    average_views: 0,
    average_clicks: 0,
    average_revenue: 0,
    best_hook_type: null,
  });
  const [contentPackages, setContentPackages] = useState<ContentPackagePayload["content_packages"]>([]);
  const [winningPatterns, setWinningPatterns] = useState<WinningPatternsPayload | null>(null);

  useEffect(() => {
    async function load(): Promise<void> {
      try {
        const session = await getApiData<SessionPayload>("/api/auth/session");
        setCsrfToken(session.csrf_token);
        const [performance, packages, patterns] = await Promise.all([
          getApiData<SummaryPayload>("/api/performance-logs?period=week"),
          getApiData<ContentPackagePayload>("/api/content-packages"),
          getApiData<WinningPatternsPayload>("/api/memory/winning-patterns"),
        ]);
        setSummary(performance.summary);
        setContentPackages(packages.content_packages);
        setWinningPatterns(patterns);
      } catch (error) {
        if (error instanceof HTTPError && error.response.status === 401) {
          window.location.assign("/login?from=/performance");
          return;
        }
        setMessage("성과 데이터를 불러오지 못했습니다.");
      }
    }
    void load();
  }, []);

  async function submit(): Promise<void> {
    const parsedViews = Number(views);
    const parsedClicks = Number(clicks);
    const parsedDirectRevenue = directRevenue.trim() === "" ? 0 : Number(directRevenue);
    if (
      contentPackageId.trim() === "" ||
      postUrl.trim() === "" ||
      views.trim() === "" ||
      clicks.trim() === "" ||
      !Number.isInteger(parsedViews) ||
      !Number.isInteger(parsedClicks) ||
      !Number.isInteger(parsedDirectRevenue) ||
      parsedViews < 0 ||
      parsedClicks < 0 ||
      parsedDirectRevenue < 0
    ) {
      setMessage("필수 필드를 입력하세요");
      return;
    }
    try {
      await ky.post("/api/performance-logs", {
        headers: { "x-csrf-token": csrfToken },
        json: {
          content_package_id: contentPackageId,
          post_url: postUrl,
          views: parsedViews,
          clicks: parsedClicks,
          direct_revenue: parsedDirectRevenue,
          hook_type: hookType,
        },
      });
      setMessage("성과 기록 저장됨");
      const performance = await getApiData<SummaryPayload>("/api/performance-logs?period=week");
      setSummary(performance.summary);
    } catch (error) {
      if (error instanceof HTTPError || error instanceof Error) {
        setMessage("성과 기록 저장 실패");
        return;
      }
      throw error;
    }
  }

  return (
    <section className="product-create-grid">
      <form className="form-panel" onSubmit={(event) => event.preventDefault()}>
        <h2>성과 기록</h2>
        <label>
          게시 URL
          <input onChange={(event) => setPostUrl(event.target.value)} value={postUrl} />
        </label>
        <label>
          콘텐츠 패키지
          <select onChange={(event) => setContentPackageId(event.target.value)} value={contentPackageId}>
            <option value="">패키지 선택</option>
            {contentPackages.slice(0, 20).map((contentPackage) => (
              <option key={contentPackage.id} value={contentPackage.id}>
                {contentPackage.topic.title} · {contentPackage.status}
              </option>
            ))}
          </select>
        </label>
        <div className="form-row">
          <label>
            조회수
            <input onChange={(event) => setViews(event.target.value)} type="number" value={views} />
          </label>
          <label>
            클릭 수
            <input onChange={(event) => setClicks(event.target.value)} type="number" value={clicks} />
          </label>
        </div>
        <div className="form-row">
          <label>
            직접 수익
            <input
              onChange={(event) => setDirectRevenue(event.target.value)}
              type="number"
              value={directRevenue}
            />
          </label>
          <label>
            Hook Type
            <select onChange={(event) => setHookType(event.target.value)} value={hookType}>
              {hookTypes.map((hook) => (
                <option key={hook} value={hook}>
                  {hook}
                </option>
              ))}
            </select>
          </label>
        </div>
        {message === "" ? null : <p className="form-error">{message}</p>}
        <button className="button primary" onClick={() => void submit()} type="button">
          기록
        </button>
      </form>

      <section className="section-block">
        <h2>지난주 요약</h2>
        <div className="metric-grid">
          <span className="badge">평균 조회 {summary.average_views.toLocaleString("ko-KR")}</span>
          <span className="badge">평균 클릭 {summary.average_clicks.toLocaleString("ko-KR")}</span>
          <span className="badge">평균 수익 {summary.average_revenue.toLocaleString("ko-KR")}원</span>
          <span className="badge">Best {summary.best_hook_type ?? "없음"}</span>
        </div>
        {winningPatterns === null ? null : (
          <div className="section-block">
            <h3>Company Memory 힌트</h3>
            <p className="muted">
              갱신 후보 상품 {winningPatterns.refresh_candidates.stale_products_count}개 · 링크{" "}
              {winningPatterns.refresh_candidates.stale_links_count}개
            </p>
            <div className="metric-grid">
              {winningPatterns.hook_type_stats.slice(0, 3).map((pattern) => (
                <span className="badge" key={pattern.hook_type}>
                  {pattern.hook_type} · {pattern.sample_count}건 · 평균{" "}
                  {pattern.average_views.toLocaleString("ko-KR")}뷰
                </span>
              ))}
            </div>
          </div>
        )}
        <p className="muted">성과 미기록 1건은 HQ 헤더와 이 화면에서 리마인드합니다.</p>
      </section>
    </section>
  );
}
