"use client";

import { useEffect, useState } from "react";
import { z } from "zod";
import { HqProfileSetupModal } from "@/components/hq/HqProfileSetupModal";

const sessionResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    csrf_token: z.string().min(1),
  }),
});

const companyProfileResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    setup_required: z.boolean(),
  }),
});

type HqDailyBriefingButtonProps = {
  readonly onStatusMessage?: (message: string) => void;
};

async function parseJsonResponse<T>(response: Response, schema: z.ZodType<T>): Promise<T> {
  return schema.parse(await response.json());
}

export function HqDailyBriefingButton({ onStatusMessage }: HqDailyBriefingButtonProps) {
  const [csrfToken, setCsrfToken] = useState("");
  const [profileSetupRequired, setProfileSetupRequired] = useState(false);
  const [profileGuardOpen, setProfileGuardOpen] = useState(false);
  const [creatingBriefing, setCreatingBriefing] = useState(false);

  useEffect(() => {
    let active = true;

    async function load(): Promise<void> {
      const [sessionResponse, profileResponse] = await Promise.all([
        fetch("/api/auth/session"),
        fetch("/api/company-profile"),
      ]);
      if (sessionResponse.status === 401 || profileResponse.status === 401) {
        window.location.assign("/login?from=/");
        return;
      }
      if (!sessionResponse.ok || !profileResponse.ok) {
        throw new Error("HQ_DAILY_BRIEFING_ACTION_LOAD_FAILED");
      }

      const sessionPayload = await parseJsonResponse(sessionResponse, sessionResponseSchema);
      const profilePayload = await parseJsonResponse(profileResponse, companyProfileResponseSchema);
      if (!active) {
        return;
      }
      setCsrfToken(sessionPayload.data.csrf_token);
      setProfileSetupRequired(profilePayload.data.setup_required);
    }

    load().catch((error: unknown) => {
      if (!active) {
        return;
      }
      if (error instanceof Error) {
        onStatusMessage?.("HQ 액션 상태를 불러오지 못했습니다.");
        return;
      }
      throw error;
    });

    return () => {
      active = false;
    };
  }, [onStatusMessage]);

  async function createBriefing(): Promise<void> {
    if (profileSetupRequired) {
      setProfileGuardOpen(true);
      return;
    }
    if (csrfToken === "") {
      onStatusMessage?.("세션을 불러오는 중입니다.");
      return;
    }

    setCreatingBriefing(true);
    onStatusMessage?.("");
    try {
      const response = await fetch("/api/hq/daily-briefing", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-csrf-token": csrfToken,
        },
        body: JSON.stringify({ force: true }),
      });
      if (response.status === 428) {
        setProfileSetupRequired(true);
        setProfileGuardOpen(true);
        return;
      }
      if (!response.ok) {
        throw new Error("HQ_DAILY_BRIEFING_FAILED");
      }
      onStatusMessage?.("오늘 브리핑을 생성했습니다.");
    } catch (error: unknown) {
      if (error instanceof Error) {
        onStatusMessage?.("오늘 브리핑 생성에 실패했습니다.");
        return;
      }
      throw error;
    } finally {
      setCreatingBriefing(false);
    }
  }

  return (
    <>
      <button
        className="button primary"
        disabled={creatingBriefing}
        onClick={() => void createBriefing()}
        type="button"
      >
        오늘 브리핑 생성
      </button>
      {profileGuardOpen ? <HqProfileSetupModal onClose={() => setProfileGuardOpen(false)} /> : null}
    </>
  );
}
