import { Suspense } from "react";
import { LoginForm } from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <main className="login-shell">
      <section className="login-panel" aria-labelledby="login-title">
        <div>
          <p className="muted">Owner Access</p>
          <h1 id="login-title">Paperclip Company OS</h1>
          <p>단일 오너 계정으로 회사 운영실에 접속합니다.</p>
        </div>
        <Suspense fallback={<div className="muted">로그인 폼을 준비 중입니다.</div>}>
          <LoginForm />
        </Suspense>
      </section>
    </main>
  );
}
