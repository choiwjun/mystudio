"use client";

import { useEffect, useState } from "react";
import { z } from "zod";

const hqBriefingResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    hq_briefing: z
      .object({
        id: z.string().min(1),
        goals: z.string().min(1),
        focus_categories: z.array(z.string()),
        priority_angle: z.string().min(1),
        strategy_note: z.string().nullable(),
        status: z.string().min(1),
        date: z.string().min(1),
      })
      .nullable(),
  }),
});

type HqBriefing = NonNullable<z.infer<typeof hqBriefingResponseSchema>["data"]["hq_briefing"]>;

function briefingDateLabel(value: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(new Date(value));
}

export function HqBriefingPanel() {
  const [briefing, setBriefing] = useState<HqBriefing | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let active = true;

    fetch("/api/hq/today")
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("HQ_BRIEFING_FAILED");
        }
        return hqBriefingResponseSchema.parse(await response.json());
      })
      .then((payload) => {
        if (!active) {
          return;
        }
        setBriefing(payload.data.hq_briefing);
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
    <article className="section-block">
      <h2>Daily HQ Briefing</h2>
      {status === "loading" ? <p className="muted">오늘 브리핑을 불러오는 중입니다.</p> : null}
      {status === "error" ? <p className="form-error">오늘 브리핑을 불러오지 못했습니다.</p> : null}
      {status === "ready" && briefing === null ? (
        <>
          <p>아직 생성된 오늘 브리핑이 없습니다.</p>
          <p className="muted">상단의 오늘 브리핑 생성 액션으로 회사 프로필 기반 계획을 만듭니다.</p>
        </>
      ) : null}
      {status === "ready" && briefing !== null ? (
        <>
          <p>{briefing.goals}</p>
          <p className="muted">
            {briefingDateLabel(briefing.date)} · 우선 각도: {briefing.priority_angle} · 상태:{" "}
            {briefing.status}
          </p>
          {briefing.strategy_note === null ? null : <p className="muted">{briefing.strategy_note}</p>}
          <div className="button-row">
            {briefing.focus_categories.map((category) => (
              <span className="badge" key={category}>
                집중 카테고리: {category}
              </span>
            ))}
          </div>
        </>
      ) : null}
    </article>
  );
}
