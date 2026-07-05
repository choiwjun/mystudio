"use client";

import { useEffect, useState } from "react";
import { z } from "zod";

const winningPatternsResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    winning_patterns: z.object({
      hook_type_stats: z.array(
        z.object({
          hook_type: z.string().min(1),
          average_views: z.number().int().nonnegative(),
          sample_count: z.number().int().nonnegative(),
        }),
      ),
      top_product_categories: z.array(
        z.object({
          category: z.string().nullable(),
          product_name: z.string().min(1),
          price: z.number().int().nonnegative().nullable(),
        }),
      ),
      refresh_candidates: z.object({
        stale_products_count: z.number().int().nonnegative(),
        stale_links_count: z.number().int().nonnegative(),
      }),
    }),
  }),
});

type WinningPatterns = z.infer<typeof winningPatternsResponseSchema>["data"]["winning_patterns"];

function formatPrice(value: number | null): string {
  if (value === null) {
    return "가격 미확인";
  }
  return `${value.toLocaleString("ko-KR")}원`;
}

export function HqWinningPatternsPanel() {
  const [patterns, setPatterns] = useState<WinningPatterns | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let active = true;

    fetch("/api/hq/today")
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("HQ_WINNING_PATTERNS_FAILED");
        }
        return winningPatternsResponseSchema.parse(await response.json());
      })
      .then((payload) => {
        if (!active) {
          return;
        }
        setPatterns(payload.data.winning_patterns);
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

  const refreshTotal =
    (patterns?.refresh_candidates.stale_products_count ?? 0) +
    (patterns?.refresh_candidates.stale_links_count ?? 0);

  return (
    <section className="section-block" aria-labelledby="patterns-title">
      <h2 id="patterns-title">Winning Patterns</h2>
      {status === "loading" ? <p className="muted">성과 패턴을 불러오는 중입니다.</p> : null}
      {status === "error" ? <p className="form-error">성과 패턴을 불러오지 못했습니다.</p> : null}
      {status === "ready" && patterns !== null ? (
        <div className="winning-patterns-grid">
          <div>
            <h3>잘 먹힌 제목 유형</h3>
            {patterns.hook_type_stats.length === 0 ? (
              <p className="muted">아직 학습된 제목 유형이 없습니다.</p>
            ) : null}
            {patterns.hook_type_stats.slice(0, 3).map((hookStat) => (
              <p className="muted" key={hookStat.hook_type}>
                {hookStat.hook_type}: 평균 {hookStat.average_views.toLocaleString("ko-KR")} 조회 · 표본{" "}
                {hookStat.sample_count.toLocaleString("ko-KR")}
              </p>
            ))}
          </div>
          <div>
            <h3>수익 난 상품군</h3>
            {patterns.top_product_categories.length === 0 ? (
              <p className="muted">아직 수익 상품군이 없습니다.</p>
            ) : null}
            {patterns.top_product_categories.slice(0, 3).map((product) => (
              <p className="muted" key={`${product.category ?? "uncategorized"}-${product.product_name}`}>
                {product.category ?? "미분류"} · {product.product_name} · {formatPrice(product.price)}
              </p>
            ))}
          </div>
          <div>
            <h3>갱신 필요</h3>
            <p className="muted">
              가격 {patterns.refresh_candidates.stale_products_count.toLocaleString("ko-KR")}건 · 링크{" "}
              {patterns.refresh_candidates.stale_links_count.toLocaleString("ko-KR")}건 · 총{" "}
              {refreshTotal.toLocaleString("ko-KR")}건
            </p>
          </div>
        </div>
      ) : null}
    </section>
  );
}
