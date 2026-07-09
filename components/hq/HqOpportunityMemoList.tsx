"use client";

import { useEffect, useState } from "react";
import { z } from "zod";
import { HqProfileSetupModal } from "@/components/hq/HqProfileSetupModal";

const decisionValues = ["selected", "on_hold", "rejected"] as const;
const hiddenMemoStatuses = new Set(["selected", "on_hold", "archived"]);

const sessionResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    csrf_token: z.string().min(1),
  }),
});

const opportunityMemoSchema = z.object({
  id: z.string().min(1),
  topic: z.string().min(1),
  why_now: z.string().min(1),
  homefeed_angle: z.string().min(1),
  search_angle: z.string().min(1),
  interest_tags: z.array(z.string()),
  homefeed_score: z.number(),
  search_score: z.number(),
  revenue_score: z.number(),
  risk_score: z.number(),
  homefeed_reasons: z.string().nullable().optional(),
  search_reasons: z.string().nullable().optional(),
  revenue_reasons: z.string().nullable().optional(),
  risk_reasons: z.string().nullable().optional(),
  score_reasons: z.string().nullable().optional(),
  status: z.string(),
});

const opportunityMemosResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    opportunity_memos: z.array(opportunityMemoSchema),
  }),
});

const companyProfileResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    setup_required: z.boolean(),
  }),
});

const decisionResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    content_package_id: z.string().nullable(),
  }),
});

type DecisionValue = (typeof decisionValues)[number];
type OpportunityMemo = z.infer<typeof opportunityMemoSchema>;

const scoreAxes = [
  {
    key: "homefeed_score",
    reasonKey: "homefeed_reasons",
    label: "홈피드",
    tone: "#1d4ed8",
  },
  {
    key: "search_score",
    reasonKey: "search_reasons",
    label: "검색",
    tone: "#047857",
  },
  {
    key: "revenue_score",
    reasonKey: "revenue_reasons",
    label: "수익",
    tone: "#b45309",
  },
  {
    key: "risk_score",
    reasonKey: "risk_reasons",
    label: "안전성",
    tone: "#b91c1c",
  },
] as const satisfies readonly {
  readonly key: keyof Pick<
    OpportunityMemo,
    "homefeed_score" | "search_score" | "revenue_score" | "risk_score"
  >;
  readonly reasonKey: keyof Pick<
    OpportunityMemo,
    "homefeed_reasons" | "search_reasons" | "revenue_reasons" | "risk_reasons"
  >;
  readonly label: string;
  readonly tone: string;
}[];

function scoreReason(
  memo: OpportunityMemo,
  reasonKey: (typeof scoreAxes)[number]["reasonKey"],
): string {
  return memo[reasonKey] ?? memo.score_reasons ?? "축별 근거가 아직 없습니다.";
}

function scoreAxisAria(memo: OpportunityMemo, axis: (typeof scoreAxes)[number]): string {
  const value = memo[axis.key];
  const inverseText = axis.key === "risk_score" ? " 낮을수록 안전" : "";
  return `${axis.label} ${value}점.${inverseText} 근거: ${scoreReason(memo, axis.reasonKey)}`;
}

function decisionLabel(value: DecisionValue): string {
  switch (value) {
    case "selected":
      return "선택";
    case "on_hold":
      return "보류";
    case "rejected":
      return "폐기";
  }
}

function isPendingMemo(memo: OpportunityMemo): boolean {
  return !hiddenMemoStatuses.has(memo.status);
}

async function parseJsonResponse<T>(response: Response, schema: z.ZodType<T>): Promise<T> {
  return schema.parse(await response.json());
}

export function HqOpportunityMemoList() {
  const [csrfToken, setCsrfToken] = useState("");
  const [memos, setMemos] = useState<OpportunityMemo[]>([]);
  const [profileSetupRequired, setProfileSetupRequired] = useState(false);
  const [profileGuardOpen, setProfileGuardOpen] = useState(false);
  const [loadStatus, setLoadStatus] = useState<"loading" | "ready" | "error">("loading");
  const [actingMemoId, setActingMemoId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;

    async function load(): Promise<void> {
      const [sessionResponse, memosResponse, profileResponse] = await Promise.all([
        fetch("/api/auth/session"),
        fetch("/api/hermes/opportunity-memos"),
        fetch("/api/company-profile"),
      ]);
      if (
        sessionResponse.status === 401 ||
        memosResponse.status === 401 ||
        profileResponse.status === 401
      ) {
        setLoadStatus("error");
        return;
      }
      if (!sessionResponse.ok || !memosResponse.ok || !profileResponse.ok) {
        throw new Error("HQ_MEMOS_LOAD_FAILED");
      }
      const sessionPayload = await parseJsonResponse(sessionResponse, sessionResponseSchema);
      const memosPayload = await parseJsonResponse(memosResponse, opportunityMemosResponseSchema);
      const profilePayload = await parseJsonResponse(profileResponse, companyProfileResponseSchema);
      if (!active) {
        return;
      }
      setCsrfToken(sessionPayload.data.csrf_token);
      setMemos(memosPayload.data.opportunity_memos.filter(isPendingMemo));
      setProfileSetupRequired(profilePayload.data.setup_required);
      setLoadStatus("ready");
    }

    load().catch(() => {
      if (active) {
        setLoadStatus("error");
      }
    });

    return () => {
      active = false;
    };
  }, []);

  async function submitDecision(memoId: string, decisionValue: DecisionValue): Promise<void> {
    if (decisionValue === "selected" && profileSetupRequired) {
      setProfileGuardOpen(true);
      return;
    }
    if (csrfToken === "") {
      setMessage("세션을 불러오는 중입니다.");
      return;
    }

    setActingMemoId(memoId);
    setMessage("");
    try {
      const response = await fetch("/api/hq/decisions", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-csrf-token": csrfToken,
        },
        body: JSON.stringify({
          opportunity_memo_id: memoId,
          decision: decisionValue,
        }),
      });
      if (response.status === 428) {
        setProfileSetupRequired(true);
        setProfileGuardOpen(true);
        return;
      }
      if (response.status === 401) {
        setMessage("세션 확인에 실패했습니다.");
        return;
      }
      if (!response.ok) {
        throw new Error("HQ_DECISION_FAILED");
      }
      const payload = await parseJsonResponse(response, decisionResponseSchema);
      if (decisionValue === "selected" && payload.data.content_package_id !== null) {
        window.location.assign(`/packages/${payload.data.content_package_id}`);
        return;
      }
      setMemos((current) => current.filter((memo) => memo.id !== memoId));
      setMessage(`${decisionLabel(decisionValue)} 처리됨`);
    } catch {
      setMessage("의사결정 처리에 실패했습니다.");
    } finally {
      setActingMemoId(null);
    }
  }

  return (
    <>
      <section className="section-block" aria-labelledby="memos-title">
        <h2 id="memos-title">Hermes Opportunity Memos</h2>
        {loadStatus === "loading" ? <p className="muted">기회 메모를 불러오는 중입니다.</p> : null}
        {loadStatus === "error" ? (
          <p className="form-error">기회 메모를 불러오지 못했습니다.</p>
        ) : null}
        {message === "" ? null : <p className="muted">{message}</p>}
        {loadStatus === "ready" && memos.length === 0 ? (
          <p className="muted">선택 대기 중인 기회 메모가 없습니다.</p>
        ) : null}
        {loadStatus === "ready" && memos.length > 0 ? (
          <div className="memo-list">
            {memos.map((memo) => (
              <article className="memo-row" key={memo.id}>
                <h3>{memo.topic}</h3>
                <p>{memo.why_now}</p>
                <fieldset className="severity-grid" aria-label={`${memo.topic} 4축 점수와 근거`}>
                  {scoreAxes.map((axis) => (
                    <span
                      role="img"
                      aria-label={scoreAxisAria(memo, axis)}
                      className="badge"
                      key={axis.key}
                      style={{
                        borderColor: axis.tone,
                        color: axis.tone,
                      }}
                      title={scoreReason(memo, axis.reasonKey)}
                    >
                      {axis.label} {memo[axis.key]}
                      {axis.key === "risk_score" ? " · 낮을수록 안전" : ""}
                    </span>
                  ))}
                </fieldset>
                <div className="button-row compact-actions">
                  {decisionValues.map((decisionValue) => (
                    <button
                      className={decisionValue === "selected" ? "button primary" : "button"}
                      disabled={actingMemoId !== null}
                      key={decisionValue}
                      onClick={() => void submitDecision(memo.id, decisionValue)}
                      type="button"
                    >
                      {decisionLabel(decisionValue)}
                    </button>
                  ))}
                  <a className="button" href="/hermes">
                    상세
                  </a>
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </section>
      {profileGuardOpen ? <HqProfileSetupModal onClose={() => setProfileGuardOpen(false)} /> : null}
    </>
  );
}
