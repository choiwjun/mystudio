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
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "module": "ESNext",
    "moduleResolution": "bundler",
    
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "alwaysStrict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "allowUnusedLabels": false,
    "allowUnreachableCode": false,
    
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "esModuleInterop": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./*"],
      "@/app/*": ["./app/*"],
      "@/components/*": ["./components/*"],
      "@/types/*": ["./types/*"],
      "@/lib/*": ["./lib/*"]
    }
  },
  "include": ["app/**/*.ts", "app/**/*.tsx"],
  "exclude": ["node_modules"]
}
```

---

## 2. 디렉토리 구조

```
project/
├── app/                          # Next.js App Router
│   ├── layout.tsx               # Root layout
│   ├── page.tsx                 # Home (HQ 메인)
│   ├── (hq)/
│   │   ├── layout.tsx
│   │   ├── page.tsx             # HQ 메인
│   │   ├── content/
│   │   │   └── [id]/
│   │   │       └── page.tsx     # 콘텐츠 상세
│   │   ├── products/
│   │   │   └── page.tsx         # 상품 관리
│   │   ├── performance/
│   │   │   └── page.tsx         # 성과 기록
│   │   └── settings/
│   │       └── page.tsx         # 설정
│   ├── api/                     # API Routes
│   │   ├── hq/
│   │   │   ├── today/route.ts
│   │   │   ├── decisions/route.ts
│   │   │   └── decisions/[id]/route.ts
│   │   ├── hermes/
│   │   │   ├── scan/route.ts
│   │   │   └── opportunity-memos/route.ts
│   │   ├── content-packages/
│   │   │   ├── route.ts
│   │   │   ├── [id]/route.ts
│   │   │   └── [id]/generate/route.ts
│   │   ├── products/
│   │   │   ├── route.ts
│   │   │   └── [id]/route.ts
│   │   ├── compliance/
│   │   │   ├── check/route.ts
│   │   │   └── checks/[id]/route.ts
│   │   ├── performance-logs/
│   │   │   └── route.ts
│   │   └── memory/
│   │       └── patterns/route.ts
│   └── middleware.ts            # Auth middleware
├── components/                  # React 컴포넌트
│   ├── hq/
│   │   ├── OpportunityCard.tsx
│   │   ├── KanbanBoard.tsx
│   │   └── MainDashboard.tsx
│   ├── common/
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── Card.tsx
│   │   └── Modal.tsx
│   └── ui/                      # 원시 UI (headless)
│       ├── badge.tsx
│       ├── tabs.tsx
│       └── select.tsx
├── lib/
│   ├── api.ts                   # API 클라이언트
│   ├── db.ts                    # Prisma 클라이언트
│   ├── auth.ts                  # NextAuth
│   ├── ai/
│   │   ├── adapter.ts           # AI 어댑터 인터페이스
│   │   ├── claude.ts            # Claude 구현 (미결)
│   │   └── openai.ts            # OpenAI 구현 (미결)
│   ├── services/
│   │   ├── HermesService.ts
│   │   ├── ContentEngine.ts
│   │   ├── ComplianceEngine.ts
│   │   └── AnalyticsService.ts
│   └── utils/
│       ├── date.ts
│       ├── format.ts
│       └── validators.ts
├── types/
│   ├── index.ts                 # 전체 타입 export
│   ├── entities.ts              # DB 엔티티 타입
│   ├── api.ts                   # API 요청/응답 타입
│   └── services.ts              # 서비스 타입
├── styles/
│   ├── globals.css
│   └── variables.css            # CSS 변수 (컬러 등)
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
├── .env.example
├── next.config.js
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

타입/인터페이스:   PascalCase.ts
  예: types/Entities.ts

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
import { OpportunityMemo } from "@/types/entities";
import { Button } from "@/components/ui/Button";

interface OpportunityCardProps {
  memo: OpportunityMemo;
  onSelect: (memo_id: string) => Promise<void>;
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
    <div className="opportunity-card">
      <h3 className="card-title">{memo.topic}</h3>
      <p className="card-body">{memo.whyNow}</p>
      <div className="scores">
        <ScoreChip label="HomeFeed" value={memo.homefeedFit} />
        <ScoreChip label="Search" value={memo.searchFit} />
        <ScoreChip label="Revenue" value={memo.shoppingConnectFit} />
      </div>
      <Button
        onClick={handleSelect}
        disabled={isLoading}
        variant="primary"
      >
        {isLoading ? "선택 중..." : "선택"}
      </Button>
      {error && <div className="error-message">{error}</div>}
    </div>
  );
}
```

---

## 6. API 라우트

### GET 라우트 (데이터 조회)

```typescript
// app/api/hq/today/route.ts

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ApiResponse } from "@/types/api";

export async function GET(
  req: NextRequest
): Promise<NextResponse<ApiResponse<any>>> {
  const requestId = crypto.randomUUID();

  try {
    // 인증 확인
    const session = await auth();
    if (!session) {
      return NextResponse.json(
        {
          success: false,
          data: null,
          error: {
            code: "UNAUTHORIZED",
            message: "Authentication required",
          },
          timestamp: new Date().toISOString(),
          request_id: requestId,
        },
        { status: 401 }
      );
    }

    // 데이터 조회
    const [
      companyProfile,
      todayMemos,
      pendingDecisions,
      revenueSnapshot,
    ] = await Promise.all([
      db.companyProfile.findFirst(),
      db.opportunityMemo.findMany({
        where: {
          status: "opportunity_found",
          created_at: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
        },
        orderBy: { created_at: "desc" },
        take: 5,
      }),
      // ... 다른 조회들
    ]);

    return NextResponse.json({
      success: true,
      data: {
        company_profile,
        today_memos,
        pending_decisions,
        revenue_snapshot,
      },
      error: null,
      timestamp: new Date().toISOString(),
      request_id: requestId,
    });
  } catch (error) {
    console.error(`[${requestId}] HQ today error:`, error);

    // 에러 로깅
    await db.errorLog.create({
      data: {
        error_code: error instanceof Error ? error.name : "UNKNOWN_ERROR",
        message: error instanceof Error ? error.message : "Unknown error",
        severity: "high",
        context: {
          request_id: requestId,
          api_path: "/api/hq/today",
        },
      },
    });

    return NextResponse.json(
      {
        success: false,
        data: null,
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch HQ data",
        },
        timestamp: new Date().toISOString(),
        request_id: requestId,
      },
      { status: 500 }
    );
  }
}
```

### POST 라우트 (데이터 생성/수정)

```typescript
// app/api/hq/decisions/route.ts

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { validateDecisionRequest } from "@/lib/validators";
import { PostHermesDecisionRequest } from "@/types/api";

export async function POST(
  req: NextRequest
): Promise<NextResponse> {
  const requestId = crypto.randomUUID();

  try {
    const session = await auth();
    if (!session) return unauthorized(requestId);

    // 요청 검증
    const body = await req.json();
    const validation = validateDecisionRequest(body);
    if (!validation.valid) {
      return badRequest(validation.errors, requestId);
    }

    const request = body as PostHermesDecisionRequest;

    // 트랜잭션 처리
    const result = await db.$transaction(async (tx) => {
      // 1. OpportunityMemo 조회
      const memo = await tx.opportunityMemo.findUnique({
        where: { id: request.opportunity_memo_id },
      });
      if (!memo) throw new Error("Memo not found");

      // 2. ContentPackage 생성
      const contentPackage = await tx.contentPackage.create({
        data: {
          topic_id: memo.id,
          status: "assigned",
          publish_readiness: "not_ready",
        },
      });

      // 3. PaperclipDecision 기록
      const decision = await tx.paperclipDecision.create({
        data: {
          opportunity_memo_id: request.opportunity_memo_id,
          decision: request.decision,
          reason_json: request.reason || [],
        },
      });

      return { contentPackage, decision };
    });

    return NextResponse.json({
      success: true,
      data: result,
      error: null,
      timestamp: new Date().toISOString(),
      request_id: requestId,
    });
  } catch (error) {
    // 에러 처리
    return serverError(error, requestId);
  }
}

// 헬퍼 함수들
function unauthorized(requestId: string) {
  return NextResponse.json(
    {
      success: false,
      data: null,
      error: { code: "UNAUTHORIZED", message: "Not authenticated" },
      timestamp: new Date().toISOString(),
      request_id: requestId,
    },
    { status: 401 }
  );
}

function badRequest(errors: Record<string, string>, requestId: string) {
  return NextResponse.json(
    {
      success: false,
      data: null,
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid request",
        details: errors,
      },
      timestamp: new Date().toISOString(),
      request_id: requestId,
    },
    { status: 400 }
  );
}

function serverError(error: unknown, requestId: string) {
  return NextResponse.json(
    {
      success: false,
      data: null,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      timestamp: new Date().toISOString(),
      request_id: requestId,
    },
    { status: 500 }
  );
}
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
// lib/services/StatusTransitionService.ts
export async function transitionStatus(
  packageId: string,
  toStatus: string,
  actor: string // "system" | "user:123" | "cron"
): Promise<{ success: boolean; error?: string }> {
  return await db.$transaction(async (tx) => {
    const pkg = await tx.contentPackage.findUnique({ where: { id: packageId } });
    
    // 유효한 전이인지 검증
    const validTransitions: Record<string, string[]> = {
      'assigned': ['brief_created'],
      'brief_created': ['homefeed_packaged'],
      // ... 전체 상태 그래프 정의
    };
    
    if (!validTransitions[pkg.status]?.includes(toStatus)) {
      return { success: false, error: 'Invalid transition' };
    }
    
    // 상태 변경 + 이력 기록 (원자성)
    await tx.contentPackage.update({
      where: { id: packageId },
      data: { status: toStatus },
    });
    
    await tx.statusTransition.create({
      data: {
        package_id: packageId,
        from_status: pkg.status,
        to_status: toStatus,
        actor,
        created_at: new Date(),
      },
    });
    
    return { success: true };
  });
}

// API 라우트: 이 함수만 호출 (직접 update 금지)
```

---

## 15. CSRF 및 Rate Limit 규칙 (F5)

```typescript
// middleware.ts
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

export function middleware(req: NextRequest) {
  // GET: CSRF 토큰 생성 → 쿠키 설정
  if (req.method === 'GET') {
    const response = NextResponse.next();
    response.cookies.set('__csrfToken', crypto.randomBytes(16).toString('hex'), {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: 3600,
    });
    return response;
  }
  
  // POST/PUT/DELETE: CSRF 검증
  if (['POST', 'PUT', 'DELETE'].includes(req.method)) {
    const isStateChange = ['/api/hq/decisions', '/api/compliance'].some(
      path => req.nextUrl.pathname.startsWith(path)
    );
    
    if (isStateChange) {
      const headerToken = req.headers.get('X-CSRF-Token');
      const cookieToken = req.cookies.get('__csrfToken')?.value;
      
      if (headerToken !== cookieToken) {
        return NextResponse.json(
          { success: false, error: { code: 'CSRF_FAILED' } },
          { status: 403 }
        );
      }
    }
  }
  
  return NextResponse.next();
}

// Rate Limit
const requestCounts = new Map<string, number>();

export function rateLimit(key: string, limit: number = 5): boolean {
  const count = (requestCounts.get(key) || 0) + 1;
  requestCounts.set(key, count);
  
  if (count > limit) {
    return false;
  }
  
  // 1분 후 초기화
  setTimeout(() => requestCounts.delete(key), 60000);
  return true;
}

// API 라우트
export async function POST(req: NextRequest) {
  const session = await auth();
  const userId = session?.user?.id;
  
  if (!rateLimit(`decisions:${userId}`, 5)) {
    return NextResponse.json(
      { success: false, error: { code: 'RATE_LIMIT_EXCEEDED' } },
      { status: 429 }
    );
  }
  
  // ... 비즈니스 로직
}
```

---

## 16. 환경변수 관리

### .env.example

```env
# Database
DATABASE_URL=postgresql://...@supabase.com/postgres

# Authentication
NEXTAUTH_SECRET=...
NEXTAUTH_URL=http://localhost:3000

# AI Models (Open Question)
AI_ADAPTER=hybrid
# CLAUDE_API_KEY=...
# OPENAI_API_KEY=...

# External APIs
NAVER_BLOG_SEARCH_API_KEY=...
NAVER_SHOPPING_API_KEY=...

# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_KEY=...

# Monitoring
SENTRY_DSN=...
LOG_LEVEL=info

# Features
ENABLE_CLIP_GENERATION=false
ENABLE_SNS_POSTING=false
```

---

## Loop Metadata

- **Upstream documents referenced**: 00-source-plan.md (기술 스택), 02-trd.md (시스템 구조, API 설계), 04-database-design.md (Prisma 스키마)
- **Downstream documents affected**: 실제 구현 (Next.js, API, 컴포넌트), 테스트 코드
- **Open questions**: 에러 로깅의 외부 서비스 통합 (Sentry vs 자체), 로컬 개발 시 AI 비용 절감 방법, 마이그레이션 전략
- **Assumptions**: Node.js 18+, npm 10+, Git 사용 가능, TypeScript strict 모드 필수
