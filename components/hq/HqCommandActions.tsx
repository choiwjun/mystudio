"use client";

import { useState } from "react";
import { HqDailyBriefingButton } from "@/components/hq/HqDailyBriefingButton";

export function HqCommandActions() {
  const [message, setMessage] = useState("");

  return (
    <>
      <div className="button-row compact-actions">
        <HqDailyBriefingButton onStatusMessage={setMessage} />
        <a className="button" href="/performance">
          성과 기록
        </a>
      </div>
      {message === "" ? null : <p className="topbar-message muted">{message}</p>}
    </>
  );
}
