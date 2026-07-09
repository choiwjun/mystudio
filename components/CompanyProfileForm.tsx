"use client";

import { useEffect, useMemo, useState } from "react";
import { z } from "zod";

type Profile = {
  readonly id: string;
  readonly company_name: string;
  readonly primary_categories: readonly string[];
  readonly blocked_categories: readonly string[];
  readonly tone_rules: string;
  readonly content_principles: string;
  readonly revenue_goal_monthly: number;
  readonly updated_at: string;
  readonly setup_required: boolean;
};

const companyProfileSchema = z.object({
  id: z.string(),
  company_name: z.string(),
  primary_categories: z.array(z.string()),
  blocked_categories: z.array(z.string()),
  tone_rules: z.string(),
  content_principles: z.string(),
  revenue_goal_monthly: z.number().int().nonnegative(),
  updated_at: z.string(),
  setup_required: z.boolean(),
});

const companyProfileResponseSchema = z.object({
  success: z.literal(true),
  data: companyProfileSchema,
});

const sessionResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    csrf_token: z.string().min(1),
  }),
});

const emptyProfile: Profile = {
  id: "",
  company_name: "",
  primary_categories: [],
  blocked_categories: [],
  tone_rules: "",
  content_principles: "",
  revenue_goal_monthly: 500000,
  updated_at: "",
  setup_required: true,
};

function splitList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function joinList(value: readonly string[]): string {
  return value.join(", ");
}

export function CompanyProfileForm() {
  const [profile, setProfile] = useState<Profile>(emptyProfile);
  const [lastSaved, setLastSaved] = useState<Profile>(emptyProfile);
  const [csrfToken, setCsrfToken] = useState("");
  const [status, setStatus] = useState("불러오는 중");

  useEffect(() => {
    async function load(): Promise<void> {
      const [sessionResponse, profileResponse] = await Promise.all([
        fetch("/api/auth/session"),
        fetch("/api/company-profile"),
      ]);

      if (sessionResponse.status === 401 || profileResponse.status === 401) {
        setStatus("세션 확인 실패");
        return;
      }

      if (!sessionResponse.ok || !profileResponse.ok) {
        setStatus("불러오기 실패");
        return;
      }

      const sessionPayload = sessionResponseSchema.parse(await sessionResponse.json());
      const profilePayload = companyProfileResponseSchema.parse(await profileResponse.json());
      setCsrfToken(sessionPayload.data.csrf_token);
      setProfile(profilePayload.data);
      setLastSaved(profilePayload.data);
      setStatus("저장됨");
    }

    void load().catch((error: unknown) => {
      if (error instanceof Error) {
        setStatus("불러오기 실패");
        return;
      }
      throw error;
    });
  }, []);

  const setupRequired = useMemo(() => profile.setup_required, [profile.setup_required]);
  const formBusy = status === "불러오는 중" || status === "저장 중";
  const canSaveProfile =
    profile.company_name.trim().length > 0 &&
    profile.primary_categories.length > 0 &&
    csrfToken !== "";

  async function save(): Promise<void> {
    if (!canSaveProfile) {
      setStatus("회사명과 주요 카테고리를 입력하세요");
      return;
    }

    setStatus("저장 중");
    const wasSetupRequired = lastSaved.setup_required;
    try {
      const response = await fetch("/api/company-profile", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "x-csrf-token": csrfToken,
        },
        body: JSON.stringify({
          company_name: profile.company_name,
          primary_categories: profile.primary_categories,
          blocked_categories: profile.blocked_categories,
          tone_rules: profile.tone_rules,
          content_principles: profile.content_principles,
          revenue_goal_monthly: profile.revenue_goal_monthly,
        }),
      });

      if (!response.ok) {
        setStatus("저장 실패");
        return;
      }

      const payload = companyProfileResponseSchema.parse(await response.json());
      setProfile(payload.data);
      setLastSaved(payload.data);
      if (wasSetupRequired && !payload.data.setup_required) {
        setStatus("설정 완료! Hermes 스캔 시작");
        window.location.assign("/?setup=complete");
        return;
      }
      setStatus("저장됨");
    } catch (error: unknown) {
      if (error instanceof Error) {
        setStatus("저장 실패");
        return;
      }
      throw error;
    }
  }

  return (
    <section className="settings-grid">
      {setupRequired ? (
        <aside className="setup-modal" aria-label="초기 설정 필요">
          <h2>초기 설정 필요</h2>
          <p>
            회사명과 주요 카테고리 1개 이상이 저장되기 전까지 Hermes와 Content 생성은 차단됩니다.
          </p>
        </aside>
      ) : null}

      <div className="form-panel">
        <div className="form-row">
          <label>
            회사명
            <input
              disabled={formBusy}
              onChange={(event) => setProfile({ ...profile, company_name: event.target.value })}
              required
              value={profile.company_name}
            />
          </label>
          <label>
            월 매출 목표
            <input
              disabled={formBusy}
              min="0"
              onChange={(event) =>
                setProfile({
                  ...profile,
                  revenue_goal_monthly: Number.parseInt(event.target.value, 10) || 0,
                })
              }
              type="number"
              value={profile.revenue_goal_monthly}
            />
          </label>
        </div>

        <label>
          주요 카테고리
          <input
            disabled={formBusy}
            onChange={(event) =>
              setProfile({ ...profile, primary_categories: splitList(event.target.value) })
            }
            placeholder="자취, 계절, 청소"
            required
            value={joinList(profile.primary_categories)}
          />
        </label>

        <label>
          차단 카테고리
          <input
            disabled={formBusy}
            onChange={(event) =>
              setProfile({ ...profile, blocked_categories: splitList(event.target.value) })
            }
            placeholder="건강, 의료, 투자"
            value={joinList(profile.blocked_categories)}
          />
        </label>

        <label>
          톤 규칙
          <textarea
            disabled={formBusy}
            onChange={(event) => setProfile({ ...profile, tone_rules: event.target.value })}
            rows={4}
            value={profile.tone_rules}
          />
        </label>

        <label>
          콘텐츠 원칙
          <textarea
            disabled={formBusy}
            onChange={(event) => setProfile({ ...profile, content_principles: event.target.value })}
            rows={4}
            value={profile.content_principles}
          />
        </label>

        <div className="button-row">
          <button
            className="button primary"
            disabled={!canSaveProfile || status === "저장 중"}
            onClick={save}
            type="button"
          >
            저장
          </button>
          <button
            className="button"
            disabled={formBusy}
            onClick={() => setProfile(lastSaved)}
            type="button"
          >
            취소
          </button>
          <span className="badge">{status}</span>
        </div>
      </div>
    </section>
  );
}
