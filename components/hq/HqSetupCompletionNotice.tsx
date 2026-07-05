"use client";

import { useEffect, useState } from "react";

export function HqSetupCompletionNotice() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("setup") !== "complete") {
      return;
    }

    setVisible(true);
    params.delete("setup");
    const nextQuery = params.toString();
    const nextUrl = `${window.location.pathname}${nextQuery === "" ? "" : `?${nextQuery}`}${window.location.hash}`;
    window.history.replaceState(null, "", nextUrl);
  }, []);

  if (!visible) {
    return null;
  }

  return (
    <div className="setup-completion-notice" role="status" aria-live="polite">
      <strong>설정 완료! Hermes 스캔 시작</strong>
      <span>회사 프로필이 준비되어 HQ에서 브리핑과 기회 선택을 진행할 수 있습니다.</span>
    </div>
  );
}
