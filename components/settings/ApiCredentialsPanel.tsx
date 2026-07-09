"use client";

import { useEffect, useState } from "react";
import { z } from "zod";
import { sessionResponseSchema } from "@/components/products/productSchemas";

const credentialProviders = ["openai", "claude", "naver", "instagram", "threads", "x"] as const;
const credentialProviderSchema = z.enum(credentialProviders);

const providerLabels: Record<(typeof credentialProviders)[number], string> = {
  openai: "OpenAI",
  claude: "Claude",
  naver: "네이버 API",
  instagram: "인스타그램",
  threads: "스레드",
  x: "X",
};

const credentialSchema = z.object({
  id: z.string().min(1),
  provider: credentialProviderSchema,
  label: z.string().min(1),
  status: z.enum(["active", "paused"]),
  last_validated_at: z.string().nullable(),
  secret_preview: z.string().min(1),
  created_at: z.string(),
  updated_at: z.string(),
});

const credentialListResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({ api_credentials: z.array(credentialSchema) }),
});

const credentialMutationResponseSchema = z.object({
  success: z.literal(true),
  data: credentialSchema,
});

type ApiCredential = z.infer<typeof credentialSchema>;

type CredentialForm = {
  readonly provider: (typeof credentialProviders)[number];
  readonly label: string;
  readonly secret: string;
};

const emptyForm: CredentialForm = {
  provider: "openai",
  label: "OpenAI 기본 키",
  secret: "",
};

function parseCredentialProvider(value: string): CredentialForm["provider"] {
  const parsed = credentialProviderSchema.safeParse(value);
  return parsed.success ? parsed.data : "openai";
}

export function ApiCredentialsPanel() {
  const [credentials, setCredentials] = useState<readonly ApiCredential[]>([]);
  const [form, setForm] = useState<CredentialForm>(emptyForm);
  const [csrfToken, setCsrfToken] = useState("");
  const [message, setMessage] = useState("AI 모델/API 키 연결 상태를 불러오는 중입니다");

  useEffect(() => {
    async function load(): Promise<void> {
      const [sessionResponse, credentialsResponse] = await Promise.all([
        fetch("/api/auth/session"),
        fetch("/api/api-credentials"),
      ]);
      if (sessionResponse.status === 401 || credentialsResponse.status === 401) {
        setMessage("세션 확인 실패");
        return;
      }
      if (!sessionResponse.ok || !credentialsResponse.ok) {
        setMessage("API 키 불러오기 실패");
        return;
      }
      const sessionPayload = sessionResponseSchema.parse(await sessionResponse.json());
      const credentialsPayload = credentialListResponseSchema.parse(
        await credentialsResponse.json(),
      );
      setCsrfToken(sessionPayload.data.csrf_token);
      setCredentials(credentialsPayload.data.api_credentials);
      setMessage("OpenAI/Claude 키를 저장하면 생성 엔진이 실제 모델을 사용할 수 있습니다");
    }

    void load().catch(() => setMessage("API 키 불러오기 실패"));
  }, []);

  async function createCredential(): Promise<void> {
    if (form.label.trim() === "" || form.secret.trim() === "") {
      setMessage("라벨과 API 키를 입력하세요");
      return;
    }
    const response = await fetch("/api/api-credentials", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-csrf-token": csrfToken,
      },
      body: JSON.stringify({
        provider: form.provider,
        label: form.label,
        secret: form.secret,
        status: "active",
      }),
    });
    if (!response.ok) {
      setMessage("API 키 저장 실패");
      return;
    }
    const payload = credentialMutationResponseSchema.parse(await response.json());
    setCredentials([payload.data, ...credentials]);
    setForm(emptyForm);
    setMessage("API 키가 암호화되어 저장되었습니다");
  }

  async function toggleCredential(credential: ApiCredential): Promise<void> {
    const response = await fetch(`/api/api-credentials/${credential.id}`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        "x-csrf-token": csrfToken,
      },
      body: JSON.stringify({ status: credential.status === "active" ? "paused" : "active" }),
    });
    if (!response.ok) {
      setMessage("API 키 상태 변경 실패");
      return;
    }
    const payload = credentialMutationResponseSchema.parse(await response.json());
    setCredentials(credentials.map((item) => (item.id === payload.data.id ? payload.data : item)));
    setMessage("API 키 상태가 변경되었습니다");
  }

  async function deleteCredential(credentialId: string): Promise<void> {
    const response = await fetch(`/api/api-credentials/${credentialId}`, {
      method: "DELETE",
      headers: { "x-csrf-token": csrfToken },
    });
    if (!response.ok) {
      setMessage("API 키 삭제 실패");
      return;
    }
    setCredentials(credentials.filter((credential) => credential.id !== credentialId));
    setMessage("API 키가 삭제되었습니다");
  }

  return (
    <section className="section-block" aria-label="AI 모델과 API 키 관리">
      <h3>AI 모델/API 키 연결</h3>
      <p className="muted">
        OpenAI 또는 Claude 키를 저장하면 <code>AI_ADAPTER</code> 설정에 맞춰 Hermes와 콘텐츠 생성
        엔진이 사용합니다. Ollama는 <code>OLLAMA_HOST</code>, <code>OLLAMA_MODEL</code>,
        <code>OLLAMA_API_KEY</code> 환경변수로 연결합니다. 키 원문은 다시 표시하지 않습니다.
      </p>
      <div className="form-grid">
        <label>
          제공자
          <select
            onChange={(event) =>
              setForm({
                ...form,
                provider: parseCredentialProvider(event.target.value),
              })
            }
            value={form.provider}
          >
            {credentialProviders.map((provider) => (
              <option key={provider} value={provider}>
                {providerLabels[provider]}
              </option>
            ))}
          </select>
        </label>
        <label>
          라벨
          <input
            onChange={(event) => setForm({ ...form, label: event.target.value })}
            value={form.label}
          />
        </label>
        <label>
          API 키
          <input
            onChange={(event) => setForm({ ...form, secret: event.target.value })}
            type="password"
            value={form.secret}
          />
        </label>
      </div>
      <div className="button-row">
        <button className="button primary" onClick={() => void createCredential()} type="button">
          키 저장
        </button>
        <span className="badge">{message}</span>
      </div>
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>제공자</th>
              <th>라벨</th>
              <th>키</th>
              <th>상태</th>
              <th>액션</th>
            </tr>
          </thead>
          <tbody>
            {credentials.length === 0 ? (
              <tr>
                <td colSpan={5}>저장된 API 키가 없습니다.</td>
              </tr>
            ) : (
              credentials.map((credential) => (
                <tr key={credential.id}>
                  <td>{providerLabels[credential.provider]}</td>
                  <td>{credential.label}</td>
                  <td>{credential.secret_preview}</td>
                  <td>{credential.status === "active" ? "활성" : "일시중지"}</td>
                  <td>
                    <div className="button-row compact-actions">
                      <button
                        className="button"
                        onClick={() => void toggleCredential(credential)}
                        type="button"
                      >
                        상태 변경
                      </button>
                      <button
                        className="button"
                        onClick={() => void deleteCredential(credential.id)}
                        type="button"
                      >
                        삭제
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
