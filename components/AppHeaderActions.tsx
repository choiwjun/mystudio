"use client";

import Link from "next/link";
import { useState } from "react";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { HqDailyBriefingButton } from "@/components/hq/HqDailyBriefingButton";

export function AppHeaderActions() {
  const [message, setMessage] = useState("");

  return (
    <div className="app-header-actions">
      <div className="button-row compact-actions">
        <HqDailyBriefingButton onStatusMessage={setMessage} />
        <Link className="button" href="/settings">
          설정
        </Link>
        <LogoutButton />
      </div>
      {message === "" ? null : <p className="topbar-message muted">{message}</p>}
    </div>
  );
}
