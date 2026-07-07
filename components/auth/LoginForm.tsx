"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";

type LoginState = "idle" | "submitting" | "error";

export function sanitizeLoginRedirectPath(value: string | null): string {
  if (
    value === null ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.startsWith("/\\")
  ) {
    return "/";
  }

  try {
    const parsed = new URL(value, "http://paperclip.local");
    return parsed.origin === "http://paperclip.local"
      ? `${parsed.pathname}${parsed.search}${parsed.hash}`
      : "/";
  } catch {
    return "/";
  }
}

export function LoginForm() {
  const searchParams = useSearchParams();
  const [state, setState] = useState<LoginState>("idle");
  const [message, setMessage] = useState("");

  async function submit(formData: FormData): Promise<void> {
    setState("submitting");
    setMessage("");

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: formData.get("email"),
        password: formData.get("password"),
      }),
    });

    if (!response.ok) {
      setState("error");
      setMessage(
        response.status === 429
          ? "잠시 후 다시 로그인하세요."
          : "이메일 또는 비밀번호를 확인하세요.",
      );
      return;
    }

    window.location.assign(sanitizeLoginRedirectPath(searchParams.get("from")));
  }

  return (
    <form action={submit} className="auth-form">
      <label>
        이메일
        <input autoComplete="email" name="email" required type="email" />
      </label>
      <label>
        비밀번호
        <input autoComplete="current-password" name="password" required type="password" />
      </label>
      {message !== "" ? <p className="form-error">{message}</p> : null}
      <button className="button primary" disabled={state === "submitting"} type="submit">
        {state === "submitting" ? "로그인 중" : "로그인"}
      </button>
    </form>
  );
}
