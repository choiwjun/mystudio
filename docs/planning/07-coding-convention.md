# 07-coding-convention.md: 코딩 컨벤션

> Paperclip Company OS v0.7
> TypeScript + Next.js + Prisma 스택
> 기준일: 2026-07-02

---

## 1. TypeScript 설정

### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["DOM", "DOM.Iterable", "ES2022"],
    "jsx": "react-jsx",
    "module": "ESNext",
    "moduleResolution": "Bundler",

    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "useUnknownInCatchVariables": true,
    "alwaysStrict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "noPropertyAccessFromIndexSignature": true,
    "allowUnusedLabels": false,
    "allowUnreachableCode": false,

    "resolveJsonModule": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "declaration": false,
    "sourceMap": true,
    "esModuleInterop": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./*"],
      "@/app/*": ["./app/*"],
      "@/components/*": ["./components/*"],
      "@/lib/*": ["./lib/*"],
      "@/types/*": ["./types/*"]
    },
    "noEmit": true
  },
  "include": [
    "next-env.d.ts",
    "**/*.ts",
    "**/*.tsx",
    ".next/types/**/*.ts",
    ".next/dev/types/**/*.ts"
  ],
  "exclude": ["node_modules"]
}
```

---

## 2. 디렉토리 구조

```
project/
├── app/                          # Next.js App Router
│   ├── layout.tsx
│   ├── globals.css               # dark command-center token/style source
│   ├── login/page.tsx
│   ├── (app)/                    # authenticated app shell
│   │   ├── layout.tsx
│   │   ├── page.tsx              # HQ 메인
│   │   ├── hermes/page.tsx
│   │   ├── packages/[id]/page.tsx
│   │   ├── products/page.tsx
│   │   ├── compliance/page.tsx
│   │   ├── performance/page.tsx
│   │   ├── memory/page.tsx
│   │   └── settings/page.tsx
│   └── api/                      # API Routes
│       ├── auth/
│       ├── company-profile/
│       ├── hq/
│       ├── hermes/
│       ├── content-packages/
│       ├── drafts/
│       ├── compliance/
│       ├── optimizers/
│       ├── products/
│       ├── shopping-connect-links/
│       ├── performance/
│       ├── performance-logs/
│       ├── revenue/
│       └── memory/
├── components/                   # React 컴포넌트
│   ├── auth/
│   ├── content/
│   ├── hq/
│   ├── performance/
│   ├── products/
│   ├── AppHeader.tsx
│   ├── CompanyProfileForm.tsx
│   └── DepartmentNav.tsx
├── lib/
│   ├── api/                      # envelope, JSON body, request logging helpers
│   ├── auth/                     # single-user no-login session + CSRF helpers
│   ├── ai/                       # AIAdapter runtime + provider adapters
│   ├── company-profile/
│   ├── content/
│   ├── compliance/
│   ├── decisions/
│   ├── export/
│   ├── hermes/
│   ├── hq/
│   ├── logging/
│   ├── memory/
│   ├── naver/
│   ├── performance/
│   ├── products/
│   ├── retention/
│   ├── security/
│   └── db.ts
├── specs/
├── tests/
├── prisma/
│   ├── schema.prisma
│   ├── seed.ts
│   └── migrations/
├── proxy.ts                      # Next 16 page/API session guard
├── biome.json
├── next.config.mjs
├── tsconfig.json
└── package.json
```

---

## 3. 파일 네이밍

### TypeScript/React

```
컴포넌트:          PascalCase.tsx
  예: OpportunityCard.tsx, MainDashboard.tsx

유틸/라이브러리:   camelCase.ts
  예: dateUtils.ts, apiClient.ts

도메인 타입:        도메인 파일 내부 export 또는 adapter/repository 타입
  예: lib/content/statusTransitions.ts, lib/ai/adapter.ts

API 라우트:        camelCase/route.ts
  예: app/api/hq/decisions/route.ts
      app/api/hermes/scan/route.ts

Prisma:           snake_case (DB 테이블)
  예: opportunity_memos, content_packages
```

---

## 4. 타입 정의

### 기본 패턴

```typescript
// types/entities.ts

export type OpportunityMemoStatus = 
  | "opportunity_found"
  | "paperclip_review"
  | "selected"
  | "rejected"
  | "duplicate"
  | "stale";

export interface OpportunityMemo {
  id: string;
  topic: string;
  whyNow: string;
  homefeedAngle: string;
  searchAngle: string;
  interestTags: string[];
  shoppingConnectFit: number;      // 0~100
  shoppingConnectReason?: string;
  homefeedFit: number;
  homefeedReason?: string;
  searchFit: number;
  searchReason?: string;
  riskFlags: string[];
  recommendedPackages: string[];
  source: "naver_api" | "fallback";
  status: OpportunityMemoStatus;
  createdAt: Date;
}

export interface ContentPackage {
  id: string;
  paperclipDecisionId: string;
  topicId: string;
  
  homefeedScore?: number;
  homefeedReason?: string;
  searchScore?: number;
  searchReason?: string;
  revenueScore?: number;
  revenueReason?: string;
  riskScore?: number;
  riskReason?: string;
  
  status: string;
  publishReadiness: "ready" | "issues" | "not_ready";
  createdAt: Date;
  updatedAt: Date;
}
```

### API 요청/응답

```typescript
// types/api.ts

export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  } | null;
  timestamp: string;
  request_id: string;
}

// 예시
export interface GetHQTodayRequest {
  // GET이므로 body 없음
}

export interface GetHQTodayResponse extends ApiResponse<{
  company_profile: CompanyProfile;
  today_memos: OpportunityMemo[];
  pending_decisions: PaperclipDecision[];
  revenue_snapshot: RevenueSnapshot;
  compliance_alerts: ComplianceAlert[];
}> {}

export interface PostHermesDecisionRequest {
  opportunity_memo_id: string;
  decision: "selected" | "on_hold" | "rejected";
  reason?: string[];
}

export interface PostHermesDecisionResponse extends ApiResponse<{
  content_package: ContentPackage;
  tasks_assigned: Task[];
}> {}
```

---

## 5. Next.js App Router 패턴

### 페이지 컴포넌트

```typescript
// app/(hq)/page.tsx

import { Suspense } from "react";
import { MainDashboard } from "@/components/hq/MainDashboard";
import { LoadingDashboard } from "@/components/hq/LoadingDashboard";

export const metadata = {
  title: "Paperclip HQ | Company OS",
};

export default function HQPage() {
  return (
    <Suspense fallback={<LoadingDashboard />}>
      <MainDashboard />
    </Suspense>
  );
}
```

### 서버 컴포넌트 (데이터 페칭)

```typescript
// components/hq/MainDashboard.tsx

import { getHQToday } from "@/lib/api";
import { OpportunityCard } from "./OpportunityCard";

export async function MainDashboard() {
  // 서버에서 데이터 페칭 (caching 자동 적용)
  const response = await getHQToday();
  
  if (!response.success) {
    throw new Error("Failed to load HQ data");
  }

  const {
    company_profile,
    today_memos,
    pending_decisions,
    compliance_alerts,
  } = response.data!;

  return (
    <div className="hq-container">
      {/* 각 블록 렌더링 */}
    </div>
  );
}
```

### 클라이언트 컴포넌트 (상호작용)

```typescript
// components/hq/OpportunityCard.tsx

"use client";

import { useState } from "react";

type OpportunityMemoCard = {
  readonly id: string;
  readonly topic: string;
  readonly why_now: string;
  readonly homefeed_score: number;
  readonly search_score: number;
  readonly revenue_score: number;
};

interface OpportunityCardProps {
  readonly memo: OpportunityMemoCard;
  readonly onSelect: (memoId: string) => Promise<void>;
}

export function OpportunityCard({ memo, onSelect }: OpportunityCardProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSelect = async () => {
    try {
      setIsLoading(true);
      setError(null);
      await onSelect(memo.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <article className="card">
      <h3>{memo.topic}</h3>
      <p className="muted">{memo.why_now}</p>
      <div className="severity-grid">
        <span className="badge">HomeFeed {memo.homefeed_score}</span>
        <span className="badge">Search {memo.search_score}</span>
        <span className="badge">Revenue {memo.revenue_score}</span>
      </div>
      <button className="button primary" disabled={isLoading} onClick={handleSelect} type="button">
        {isLoading ? "선택 중..." : "선택"}
      </button>
      {error === null ? null : <p className="form-error">{error}</p>}
    </article>
  );
}
```

---

## 6. API 라우트

### GET 라우트 (데이터 조회)

```typescript
// app/api/hq/today/route.ts

import { withAuthenticatedApi } from "@/lib/auth/guards";
import { ok } from "@/lib/api/response";
import { getHqToday } from "@/lib/hq/service";

export const GET = withAuthenticatedApi("hq.today", async () => {
  return ok(await getHqToday());
});
```

- 모든 API 응답은 `ok()` / `fail()`을 사용해 `success/data/error/timestamp/request_id` envelope를 유지한다.
- `withApiErrorLogging(routeName, handler)`가 요청 시작 시 `request_id`를 1회 생성하고, 같은 요청 안의 `ok()`/`fail()` 응답 본문과 `error_logs.context.request_id`에 동일하게 전파한다.
- single-user no-login API도 `withAuthenticatedApi()`를 사용한다. 이 가드는 자동 Owner 세션을 읽고 상태 변경 요청의 `x-csrf-token`을 검증한다.

### POST 라우트 (데이터 생성/수정)

```typescript
// app/api/hq/decisions/route.ts

import { withAuthenticatedApi } from "@/lib/auth/guards";
import { fail, ok } from "@/lib/api/response";
import { readJsonBody } from "@/lib/api/json";
import { createPaperclipDecision } from "@/lib/decisions/service";
import { decisionCreateSchema } from "@/lib/decisions/schemas";

export const POST = withAuthenticatedApi("hq.decisions.create", async (request) => {
  const parsed = decisionCreateSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) {
    return fail(
      {
        code: "VALIDATION_ERROR",
        message: "Invalid decision payload.",
        details: { issues: parsed.error.flatten().fieldErrors },
      },
      400,
    );
  }

  return ok(await createPaperclipDecision(parsed.data), { status: 201 });
});
```

---

## 7. AI 어댑터 패턴

### 인터페이스 정의

```typescript
// lib/ai/adapter.ts

export interface AIAdapterInterface {
  generateOpportunityMemo(input: HermesInput): Promise<OpportunityMemo>;
  generateBlogDraft(input: ContentInput): Promise<BlogDraft>;
  generateSNSVariant(input: ContentInput, platform: string): Promise<SNSVariant>;
  scoreHomefeed(draft: Draft): Promise<HomefeedScore>;
  checkCompliance(draft: Draft, rules: ComplianceRules): Promise<ComplianceCheck>;
}

export interface HermesInput {
  topic: string;
  keywords: string[];
  searchResults: SearchResult[];
  productCandidates: Product[];
  categoryPlaybook?: CategoryPlaybook;
}

export interface BlogDraft {
  homefeedTitle: string[];
  searchTitle: string;
  thumbnailText: string[];
  bodyMarkdown: string;
  disclosureText?: string;
  priceNotice?: string;
}
```

### Claude 구현 (미결)

```typescript
// lib/ai/claude.ts

import Anthropic from "@anthropic-ai/sdk";
import { AIAdapterInterface, HermesInput, BlogDraft } from "./adapter";

export class ClaudeAdapter implements AIAdapterInterface {
  private client: Anthropic;

  constructor() {
    this.client = new Anthropic({
      apiKey: process.env.CLAUDE_API_KEY,
    });
  }

  async generateOpportunityMemo(input: HermesInput): Promise<any> {
    const prompt = this.buildHermesPrompt(input);

    const message = await this.client.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    // 응답 파싱
    const content = message.content[0];
    if (content.type !== "text") throw new Error("Invalid response type");

    return JSON.parse(content.text);
  }

  private buildHermesPrompt(input: HermesInput): string {
    // Nunjucks 템플릿 사용
    return `
당신은 Hermes 연구팀입니다.
주어진 검색 결과와 상품 후보를 기반으로 Opportunity Memo를 생성하세요.

주제: ${input.topic}
키워드: ${input.keywords.join(", ")}
카테고리 가이드: ${input.categoryPlaybook?.homefeedToneGuidance || "기본"}

응답 형식 (JSON):
{
  "topic": "...",
  "why_now": "...",
  "homefeed_angle": "...",
  "search_angle": "...",
  "interest_tags": ["..."],
  "homefeed_score": 0-100,
  "search_score": 0-100,
  "revenue_score": 0-100,
  "risk_score": 0-100,
  "score_reasons": "..."
}
`;
  }
}
```

---

## 8. 데이터베이스 쿼리 (Prisma)

### 기본 규칙

```typescript
// lib/db 관련 함수들

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

// 네이밍: snake_case로 DB 조작
// 예외: Prisma에서 PascalCase로 변환됨

// 조회
const memos = await db.opportunityMemo.findMany({
  where: {
    status: "opportunity_found",
    createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
  },
  orderBy: { createdAt: "desc" },
  take: 5,
  select: {
    id: true,
    topic: true,
    homefeedScore: true,
    // 불필요한 필드 제외로 성능 최적화
  },
});

// 생성
const decision = await db.paperclipDecision.create({
  data: {
    opportunity_memo_id: memoId,
    decision: "selected",
    reason_json: reasonArray,
    created_at: new Date(),
  },
});

// 업데이트 (부분)
const updated = await db.contentPackage.update({
  where: { id: packageId },
  data: {
    homefeed_score: 72,
    homefeed_reason: "...",
    updated_at: new Date(),
  },
});

// 트랜잭션
const result = await db.$transaction(async (tx) => {
  const memo = await tx.opportunityMemo.findUnique({ where: { id } });
  const decision = await tx.paperclipDecision.create({
    data: { opportunity_memo_id: id, decision: "selected" },
  });
  return { memo, decision };
});
```

---

## 9. 에러 처리

### 에러 타입 정의

```typescript
// lib/errors.ts

export class AppError extends Error {
  constructor(
    public code: string,
    public message: string,
    public statusCode: number = 500,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, string>) {
    super("VALIDATION_ERROR", message, 400, details);
    this.name = "ValidationError";
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super("NOT_FOUND", `${resource} not found`, 404);
    this.name = "NotFoundError";
  }
}

export class ComplianceError extends AppError {
  constructor(message: string, public issues: ComplianceIssue[]) {
    super("COMPLIANCE_ERROR", message, 400, { issues });
    this.name = "ComplianceError";
  }
}
```

### 사용 예시

```typescript
// API 라우트 내
try {
  const memo = await db.opportunityMemo.findUnique({ where: { id } });
  if (!memo) throw new NotFoundError("Opportunity Memo");

  if (memo.riskScore >= 70) {
    throw new ComplianceError("High risk detected", [
      { type: "risk_score", message: "Risk score is above publishing threshold" },
    ]);
  }
} catch (error) {
  if (error instanceof AppError) {
    return NextResponse.json(
      {
        success: false,
        data: null,
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
      },
      { status: error.statusCode }
    );
  }
  // 예상 밖 에러
  throw error;
}
```

---

## 10. 로깅

### 에러 로깅

```typescript
// lib/logger.ts

export async function logError(
  code: string,
  message: string,
  context: Record<string, unknown>,
  severity: "low" | "medium" | "high" = "medium"
) {
  await db.errorLog.create({
    data: {
      error_code: code,
      message,
      severity,
      context,
      created_at: new Date(),
    },
  });
}

// 사용
logError("NAVER_API_TIMEOUT", "Naver API timeout", {
  request_id: "req_123",
  api: "naver_shopping",
  timeout_ms: 10000,
}, "high");
```

### 비용 로깅 (AI 모델)

```typescript
// lib/logger.ts

export async function logCost(
  model: string,
  task: string,
  inputTokens: number,
  outputTokens: number,
  costUsd: number
) {
  await db.costLog.create({
    data: {
      model,
      task,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cost_usd: costUsd,
      created_at: new Date(),
    },
  });
}

// 사용
logCost(
  "claude",
  "generate_blog",
  2500,
  1200,
  0.034  // 비용 계산: (2500 * 0.003 + 1200 * 0.015) / 1000
);
```

---

## 11. Sanitization 이원화 규칙 (F1)

**신뢰 경계**: body_markdown(AI 출력) + raw_items(제3자 검색 결과) = 외부 신뢰 불가

```typescript
// lib/sanitize.ts
import DOMPurify from 'isomorphic-dompurify';

// 미리보기용 (엄격)
export function sanitizeForPreview(htmlString: string): string {
  return DOMPurify.sanitize(htmlString, {
    ALLOWED_TAGS: ['p', 'strong', 'em', 'a', 'br', 'ul', 'ol', 'li', 'img'],
    ALLOWED_ATTR: ['href', 'src', 'alt'],
  });
}

// Export용 (허용적 — 네이버 에디터 호환)
export function sanitizeForExport(htmlString: string): string {
  return DOMPurify.sanitize(htmlString, {
    ALLOWED_TAGS: [
      'p', 'br', 'ul', 'ol', 'li',
      'strong', 'em', 'u', 'a', 'h1', 'h2', 'h3',
      'img', 'table', 'tr', 'td', 'th',
      'blockquote', 'pre'
    ],
    ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'style'],
    ALLOW_DATA_ATTR: false,
  });
}

// Export 경계에서만 HTML 생성
export async function generateExportHtml(draft: Draft): Promise<string> {
  // body_markdown → HTML 변환 후 sanitize
  const html = markdownToHtml(draft.body_markdown);
  return sanitizeForExport(html);
}
```

---

## 12. 로깅 마스킹 규칙 (F2)

```typescript
// lib/logger.ts
const SENSITIVE_FIELDS = ['password', 'token', 'secret', 'authorization', 'apiKey'];

export function maskSensitiveFields(obj: any): any {
  const masked = JSON.parse(JSON.stringify(obj));
  
  function mask(target: any) {
    if (!target || typeof target !== 'object') return;
    Object.keys(target).forEach(key => {
      if (SENSITIVE_FIELDS.some(f => key.toLowerCase().includes(f))) {
        target[key] = '[MASKED]';
      } else if (typeof target[key] === 'object') {
        mask(target[key]);
      }
    });
  }
  
  mask(masked);
  return masked;
}

// error_logs.context에 저장할 때
await db.errorLog.create({
  data: {
    error_code: 'API_ERROR',
    message: error.message,
    context: {
      request_body: maskSensitiveFields(body), // 마스킹 적용
      api_path: '/api/auth/login',
    },
  },
});
```

---

## 13. Zod 검증 규칙 (F3)

```typescript
// lib/validators.ts
import { z } from 'zod';

export const OpportunityMemoSchema = z.object({
  topic: z.string().min(1).max(200),
  why_now: z.string().min(10).max(500),
  homefeed_score: z.number().int().min(0).max(100),
  search_score: z.number().int().min(0).max(100),
  revenue_score: z.number().int().min(0).max(100),
  risk_score: z.number().int().min(0).max(100),
  score_reasons: z.string().min(10).max(1000),
}).strict();

// API 라우트에서
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validated = OpportunityMemoSchema.parse(body);
    
    // validated는 완전히 타입 안전
    await db.opportunityMemo.create({ data: validated });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return badRequest(
        error.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message,
        })),
        requestId
      );
    }
  }
}
```

---

## 14. 상태 전이 서비스 규칙 (F4)

```typescript
// lib/content/repository.ts
import type { PackageStatus } from "@prisma/client";
import { assertPackageStatusTransitionAllowed } from "@/lib/content/statusTransitions";
import { prisma } from "@/lib/db";

export async function transitionContentPackageStatus(input: {
  readonly id: string;
  readonly toStatus: PackageStatus;
  readonly actor: string;
  readonly reason?: string;
}) {
  return prisma.$transaction(async (tx) => {
    const contentPackage = await tx.contentPackage.findUniqueOrThrow({
      where: { id: input.id },
    });

    assertPackageStatusTransitionAllowed(contentPackage.status, input.toStatus);

    const updated = await tx.contentPackage.update({
      where: { id: input.id },
      data: { status: input.toStatus },
    });

    await tx.statusTransition.create({
      data: {
        contentPackageId: input.id,
        fromStatus: contentPackage.status,
        toStatus: input.toStatus,
        actor: input.actor,
        reason: input.reason ?? null,
      },
    });

    return updated;
  });
}

// API 라우트: repository transition 함수만 호출 (직접 contentPackage.update 금지)
```

---

## 15. CSRF 및 Rate Limit 규칙 (F5)

```typescript
// proxy.ts — 페이지/API 공통 세션 보호
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(_request: NextRequest) {
  // single-user no-login: 페이지/API를 로그인 화면으로 리다이렉트하지 않는다.
  return NextResponse.next();
}

// lib/auth/guards.ts — 상태 변경 API 공통 가드
import { withApiErrorLogging } from "@/lib/api/handler";
import { fail } from "@/lib/api/response";
import { readSessionFromRequest, type OwnerSession } from "@/lib/auth/session";

function hasValidCsrf(request: NextRequest, session: OwnerSession): boolean {
  if (request.method === "GET" || request.method === "HEAD" || request.method === "OPTIONS") {
    return true;
  }

  return request.headers.get("x-csrf-token") === session.csrfToken;
}

export function withAuthenticatedApi(routeName: string, handler: AuthenticatedHandler) {
  return withApiErrorLogging(routeName, async (request: NextRequest) => {
    const session = await readSessionFromRequest(request);

    if (!hasValidCsrf(request, session)) {
      return fail({ code: "CSRF_TOKEN_INVALID", message: "A valid CSRF token is required." }, 403);
    }

    return handler(request, session);
  });
}

// API 라우트: Bearer token/next-auth/login 없이 자동 Owner 세션 + CSRF 가드만 사용
export const POST = withAuthenticatedApi("hq.decisions.create", async (req, session) => {
  if (!rateLimit(`decisions:${session.email}`, 5)) {
    return fail({ code: "RATE_LIMIT_EXCEEDED", message: "Too many requests." }, 429);
  }

  // ... 비즈니스 로직
});
```

---

## 16. 환경변수 관리

### .env.example

```env
# Database (local PostgreSQL)
DATABASE_URL=postgresql://paperclip:paperclip@127.0.0.1:5432/paperclip
DIRECT_URL=postgresql://paperclip:paperclip@127.0.0.1:5432/paperclip

# Single-user access
OWNER_EMAIL=owner@example.com # optional display email for single_owner_no_login

# AI Models (Open Question)
AI_ADAPTER=mock
AI_ADAPTER_ALLOW_MOCK=true
# CLAUDE_API_KEY=...
# OPENAI_API_KEY=...

# External APIs
NAVER_CLIENT_ID=...
NAVER_CLIENT_SECRET=...
NAVER_BLOG_SEARCH_URL=https://openapi.naver.com/v1/search/blog.json
NAVER_SHOPPING_SEARCH_URL=https://openapi.naver.com/v1/search/shop.json

# Local scheduler / API trigger guard
CRON_SECRET=replace-with-random-secret

# Local file storage
LOCAL_STORAGE_DIR=./storage

# Monitoring
COST_LOG_ENABLED=true
ERROR_LOG_ENABLED=true
LOG_LEVEL=info
```

---

## Loop Metadata

- **Upstream documents referenced**: 00-source-plan.md (기술 스택), 02-trd.md (시스템 구조, API 설계), 04-database-design.md (Prisma 스키마)
- **Downstream documents affected**: 실제 구현 (Next.js, API, 컴포넌트), 테스트 코드
- **Open questions**: 에러 로깅의 외부 서비스 통합 (Sentry vs 자체), 로컬 개발 시 AI 비용 절감 방법, 마이그레이션 전략
- **Assumptions**: Node.js 18+, npm 10+, Git 사용 가능, TypeScript strict 모드 필수
