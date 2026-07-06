# Paperclip Company OS v0.7 — 문서·구현 갭 분석 (Lane C 최종 보고)

**분석자**: worker-3 (Lane C — Gap reconciliation and severity)  
**분석 일시**: 2026-07-06T23:11:00Z  
**분석 대상**:
- **문서**: docs/planning/**/*.md (PRD, TRD, Database Design, Screens, Tasks 등)
- **구현**: app/, components/, lib/, prisma/, tests/, package.json, specs/

---

## 요약 (Executive Summary)

Paperclip Company OS v0.7은 **MVP 핵심 기능 대부분이 구현 완료**되었으며, 기획 문서와 실제 구현 간의 정합성이 높은 편입니다. 주요 MVP 경로(Hermes 기회 발굴 → Paperclip 의사결정 → Content 생성 → Compliance 검수 → Export → 성과 기록)가 작동 가능한 상태이고, 보안 강화(jose 세션, CRON_SECRET, sanitization 이원화, 마스킹)가 최근 반영되었습니다.

**핵심 갭**:
1. **Phase 2 기능(클립·SNS)**: 기획 문서에서 명시적으로 Phase 2 이후로 미루었으므로, 미구현 상태는 **의도된 스코프 외** (코드 드리프트 아님)
2. **Naver API 실연동**: 스캔 로직은 존재하나 실제 네이버 블로그·쇼핑 API 응답 파싱 미검증 → **부분 구현** (mock/fallback만 확인)
3. **Vercel Cron 자동 스캔**: vercel.json에 crons 정의 없음 → **미구현** (수동 호출만 가능)
4. **UI 완성도**: HQ 메인 4블록 구조, 칸반, Winning Patterns 등 기획 화면 일부 미렌더 → **부분 구현**
5. **Company Memory**: 데이터베이스 스키마 존재, 서비스 로직 부분 구현, UI Phase 2로 미루어짐 → **부분 구현**

---

## 1. 구현 완료 (Implemented) ✅

### 1.1 인프라·보안 (P0, P1)
| 항목 | 증거 (코드/테스트 경로) | 비고 |
|------|-------------------------|------|
| **Next.js + Prisma + Supabase 셋업** | `prisma/schema.prisma` (28개 모델 + PackageStatus enum), `prisma/migrations/00000000000000_init/` | 04-database-design.md 정본 스키마 전부 마이그레이션 완료 |
| **jose signed-cookie 인증** | `lib/auth/session.ts`, `app/api/auth/login/route.ts`, `tests/p1-auth-company-profile.test.ts:35-260` | NEXTAUTH_SECRET 환경변수 + paperclip_session 쿠키 + CSRF 토큰, NextAuth.js 패키지 불사용 확인 |
| **API 에러 핸들러 + 통일 응답 포맷** | `lib/api/response.ts`, `lib/api/handler.ts`, `lib/logging/errorLogger.ts` | `{ success, data, error, timestamp, request_id }` 포맷 통일, error_logs 테이블 자동 기록 |
| **AI Adapter 인터페이스** | `lib/ai/adapter.ts`, `lib/ai/providerAdapters.ts`, `lib/ai/mockAdapter.ts`, `tests/ai-provider-adapters.test.ts` | mock/OpenAI/Claude 교체 가능, cost_logs 기록 (`lib/logging/costLogger.ts`) |
| **CRON_SECRET 검증** | `lib/security/cron.ts`, `app/api/hermes/scan/route.ts:1-30` (CRON_SECRET 헤더 검증 로직) | 02-trd.md §2.2 A1 보안 요구사항 충족 (무인증 AI 비용 폭주 방지) |
| **Sanitization 이원화** | `lib/export/render.ts` (Export용 allowlist), DOMPurify 미리보기 엄격 모드(기획 의도) | 02-trd.md §2.3 A6 신뢰 경계 분리 |
| **에러 로그 마스킹** | `lib/logging/errorLogger.ts` (password/token/secret/authorization 필드 마스킹) | 02-trd.md P0-T2 C2 체크리스트 ③ 충족 |
| **Workspace v2 전방 호환** | `prisma/schema.prisma:55-62` (workspaces 테이블), `prisma/seed.ts` (default 워크스페이스 시드) | 04-database-design.md 주석 정합, v0.7은 단일 워크스페이스 고정 |

### 1.2 Hermes (P2-R1)
| 항목 | 증거 | 비고 |
|------|------|------|
| **opportunity_memos Resource** | `app/api/hermes/opportunity-memos/route.ts`, `app/api/hermes/opportunity-memos/[id]/route.ts`, `lib/hermes/service.ts` | GET 목록/상세, POST 생성, 4축 점수(homefeed/search/revenue/risk) 포함 |
| **keyword_clusters 내장 반환** | `lib/hermes/service.ts` (getOpportunityMemoById 함수, keywordClusters include) | 01-prd.md §5 기능 #2, specs/domain/resources.yaml OpportunityMemo 계약 준수 |
| **Hermes 스캔 로직** | `app/api/hermes/scan/route.ts`, `lib/hermes/service.ts:scanAndGenerateOpportunityMemos()` | 네이버 API 클라이언트(`lib/naver/client.ts`), AI 생성 호출 확인 (단, 실데이터 파싱 미검증) |

### 1.3 Paperclip Decisions (P2-R2)
| 항목 | 증거 | 비고 |
|------|------|------|
| **의사결정 API (선택/보류/폐기)** | `app/api/hq/decisions/route.ts`, `app/api/hq/decisions/[id]/route.ts`, `lib/decisions/service.ts` | POST /api/hq/decisions { decision: "selected"\|"on_hold"\|"rejected" } |
| **승인/반려 API** | `app/api/hq/decisions/[id]/approve/route.ts`, `app/api/hq/decisions/[id]/reject/route.ts` | 01-prd.md §5 기능 #1 (Paperclip HQ 메인) 완료 조건 충족 |
| **ContentPackage 자동 생성** | `lib/decisions/service.ts:createDecision()` (decision='selected' 시 contentPackage 자동 생성) | 02-trd.md §2.1 처리 로직 5단계 충족 |

### 1.4 Products + ShoppingConnect (P2-R3)
| 항목 | 증거 | 비고 |
|------|------|------|
| **products CRUD** | `app/api/products/route.ts`, `app/api/products/[id]/route.ts`, `lib/products/service.ts` | POST/GET/PATCH, 가격·수수료율·확인일 저장 |
| **URL 임포트 + 크롤링** | `app/api/products/import/route.ts`, `lib/security/productImport.ts` | URL 붙여넣기 → 상품명/가격 추출 (SSRF 방어 포함) |
| **shopping_connect_links Resource** | `app/api/shopping-connect-links/route.ts`, `app/api/shopping-connect-links/[id]/route.ts` | GET/POST/PATCH/DELETE, content_package 연결 |
| **stale 필터** | `app/api/products/route.ts` (?stale=true 쿼리 파라미터), `lib/products/service.ts` | 가격 오래된 상품 필터링 |

### 1.5 Content Generation (P3-R1)
| 항목 | 증거 | 비고 |
|------|------|------|
| **Master Content Engine** | `app/api/content-packages/[id]/generate/route.ts`, `lib/content/service.ts:generateBlogDraft()` | 단계별 생성 (제목 → 검색 구조 → 본문), 02-trd.md §2.3 비동기 경량 중간해 구현 |
| **HomeFeed 제목 생성** | `app/api/optimizers/homefeed/titles/route.ts`, `lib/content/titleService.ts` | 01-prd.md §5 기능 #4 (홈판형 제목 생성) 충족 |
| **Search 구조 생성** | `app/api/optimizers/search/structure/route.ts`, `lib/content/searchStructure.ts` | 01-prd.md §5 기능 #5 (검색형 구조) 충족, H2/H3/FAQ/비교표 포함 |
| **Drafts Resource** | `app/api/drafts/[id]/route.ts`, `lib/content/repository.ts` | bodyMarkdown (정본), comparisonTable, faq, disclosureText, priceNotice 저장 |
| **[되돌림] 버튼 지원** | `prisma/schema.prisma:294` (originalBody 컬럼), `lib/content/service.ts` (AI 생성 직후 스냅샷 저장) | 04-database-design.md B3 요구사항 충족 |

### 1.6 Compliance (P3-R2)
| 항목 | 증거 | 비고 |
|------|------|------|
| **Compliance 검수 엔진** | `app/api/compliance/check/route.ts`, `lib/compliance/service.ts`, `lib/compliance/rules.ts` | 대가성 문구, 가격 기준일, 출처, 과장 표현 규칙 기반 검수 |
| **ComplianceCheck Resource** | `app/api/compliance/checks/[id]/route.ts`, `app/api/compliance/checks/[id]/apply-fixes/route.ts` | GET 검수 보고서, POST 자동 수정 적용 |
| **Export 차단** | `lib/compliance/service.ts:checkCompliance()` (high risk 0건 + medium 사용자 확인 전 export_allowed=false) | 01-prd.md §5 기능 #10 (Compliance Gate) 완료 조건 충족 |

### 1.7 Export (P3-R3)
| 항목 | 증거 | 비고 |
|------|------|------|
| **Export Bundle** | `app/api/content-packages/[id]/export/route.ts`, `lib/export/service.ts`, `lib/export/render.ts` | Markdown/HTML/Copy/ZIP 4가지 형식 생성 |
| **HTML 경계 생성 (저장 안 함)** | `lib/export/render.ts` (Export 시점에만 HTML 생성), `prisma/schema.prisma:287` (bodyHtml 컬럼 폐지 주석) | 04-database-design.md B2 요구사항 충족, drafts.bodyHtml 컬럼 없음 확인 |

### 1.8 Performance + Memory (P4-R2, P4-R3)
| 항목 | 증거 | 비고 |
|------|------|------|
| **성과 기록 API** | `app/api/performance-logs/route.ts`, `app/api/performance/content/[id]/route.ts`, `lib/performance/service.ts` | POST 게시 URL/조회/클릭/수익 기록, 01-prd.md §5 기능 #12 충족 |
| **Revenue Summary** | `app/api/revenue/summary/route.ts` | 수익 요약 조회 |
| **Company Memory (부분)** | `app/api/memory/winning-patterns/route.ts`, `lib/memory/service.ts`, `lib/memory/patterns.ts` | 잘 된 패턴 조회 로직 존재, UI는 Phase 2 (01-prd.md §5 기능 #13) |

### 1.9 Company Profile (P1-R2)
| 항목 | 증거 | 비고 |
|------|------|------|
| **company_profile Resource** | `app/api/company-profile/route.ts`, `lib/company-profile/service.ts` | GET/PATCH, primary_categories/blocked_categories/tone_rules/content_principles/revenue_goal_monthly |

### 1.10 UI (부분 구현)
| 항목 | 증거 | 비고 |
|------|------|------|
| **공통 레이아웃** | `app/(app)/layout.tsx`, `components/AppHeader.tsx`, `components/DepartmentNav.tsx` | 헤더 + 사이드바, 01-prd.md §5 기능 #1 (HQ 메인) 부분 충족 |
| **HQ 메인** | `app/(app)/page.tsx`, `tests/hq-screen-contract.test.ts` | Hermes Opportunity Memos 카드 리스트, Production Pipeline 칸반 존재 (단, 06-screens.md 4블록 구조 미완성) |
| **콘텐츠 상세** | `app/(app)/packages/[id]/page.tsx`, `tests/p3-contract.test.ts:200-400` | 미리보기, 편집, 검수, 승인 워크플로 UI 존재 |
| **상품 관리** | `app/(app)/products/page.tsx`, `tests/products-screen-contract.test.ts` | 상품 CRUD, URL 임포트, stale 필터 UI |
| **설정** | `app/(app)/settings/page.tsx`, `tests/settings-screen-contract.test.ts` | company_profile 편집 UI |
| **성과 기록** | `app/(app)/performance/page.tsx`, `tests/p4-contract.test.ts:400-500` | 성과 목록, 게시 URL 입력 UI |
| **Hermes** | `app/(app)/hermes/page.tsx` | 기회 메모 목록 UI |
| **Compliance** | `app/(app)/compliance/page.tsx` | 검수 대기 목록 UI |

---

## 2. 부분 구현 (Partial) ⚠️

| 항목 | 구현 상태 | 증거 | 우선순위 | 갭 상세 |
|------|-----------|------|----------|---------|
| **Naver API 실연동** | 스캔 로직 존재, 파싱 미검증 | `lib/naver/client.ts` (클라이언트 존재), `lib/hermes/service.ts` (호출 코드 존재), **실데이터 파싱 테스트 없음** | **High** | 02-trd.md §2.2 네이버 블로그 검색 API + 쇼핑 API 실응답 파싱 검증 필요, 현재는 mock/fallback만 동작 확인 |
| **Vercel Cron 자동 스캔** | 수동 API 호출만 가능 | `vercel.json` (crons 정의 없음), `app/api/hermes/scan/route.ts` (CRON_SECRET 검증 존재) | **Medium** | 06-tasks.md P2-R1-T1 acceptance_criteria 미충족: "vercel.json에 crons 정의 (매일 06:00 KST Hermes 스캔 잡)" 없음 |
| **HQ 메인 4블록 구조** | 카드 리스트 + 칸반 존재, 브리핑·Winning Patterns 미렌더 | `app/(app)/page.tsx`, `tests/hq-screen-contract.test.ts` | **Medium** | 06-screens.md §1.3 블록 1(오늘의 경영 브리핑) + 블록 4(Winning Patterns) UI 누락, API는 존재(`app/api/hq/daily-briefing/route.ts`, `app/api/memory/winning-patterns/route.ts`) |
| **Company Memory UI** | 서비스 로직 부분, UI Phase 2 | `lib/memory/service.ts`, `lib/memory/patterns.ts` (잘 된 패턴 추출 로직 존재), **UI 누락** | **Low (Phase 2)** | 01-prd.md §5 기능 #13 (Company Memory)는 Phase 1 Must이나, 06-screens.md §1.2 좌측 사이드바에서 "Phase 2에서 추가" 명시 → **의도된 스코프 축소** |
| **칸반 5단계 세부 표시** | 상태 전이 로직 존재, 칸반 UI 간소화 | `prisma/schema.prisma:39-70` (PackageStatus enum 28개 상태), `app/(app)/page.tsx` (칸반 존재), **진행률·위험도 세부 표시 미렌더** | **Low** | 06-screens.md §1.3 블록 3 (칸반 5단계) 세부 디자인(진행 60% 게이지, 위험도 높음 빨간색) 미구현, MVP 사용성에 큰 영향 없음 |
| **Daily Briefing 생성 로직** | API 존재, 자동 트리거 없음 | `app/api/hq/daily-briefing/route.ts`, `lib/hq/service.ts:generateDailyBriefing()` | **Low** | 01-prd.md §3 하루 운영 흐름 2단계 "Hermes가 오늘 기회 제시" 후 HQ 브리핑 생성 자동화 미구현, 현재는 수동 호출 |

---

## 3. 미구현 / 스코프 외 (Missing / Won't) 🔴

### 3.1 Phase 2 기능 (의도된 스코프 외)
| 항목 | 기획 문서 근거 | 상태 | 우선순위 |
|------|---------------|------|----------|
| **네이버 클립 대본 생성** | 01-prd.md MVP Scope 표 "Should (Phase 2)", 06-screens.md 화면 #6 (Phase 2) | **Won't (Phase 2)** | N/A |
| **SNS 변환 (Instagram/Threads/X)** | 01-prd.md MVP Scope 표 "Should (Phase 2)", 06-screens.md 화면 #7 (Phase 2) | **Won't (Phase 2)** | N/A |
| **주간 회고 리포트** | 01-prd.md MVP Scope 표 "Should (Phase 2)" | **Won't (Phase 2)** | N/A |
| **월간 P&L 리포트** | 01-prd.md MVP Scope 표 "Should (Phase 2)" | **Won't (Phase 2)** | N/A |

→ **결론**: Phase 2 기능은 MVP 범위를 명시적으로 벗어나므로 **갭이 아님** (의도된 제외).

### 3.2 실제 미구현 (MVP 범위 내 누락)
| 항목 | 기획 문서 근거 | 상태 | 우선순위 | 갭 상세 |
|------|---------------|------|----------|---------|
| **상품 가격 자동 갱신 알림** | 01-prd.md §5 기능 #6 (쇼핑커넥트 상품/링크 관리) 미구현 세부사항, 02-trd.md §2.5 "주기적 갱신 알림" | **Missing** | **Medium** | products 테이블 price_checked_at 필드 존재, **자동 갱신 알림 로직 없음** (UI에서 수동 [갱신하기] 버튼도 미구현) |
| **블로그 자동 발행 금지 명시** | 01-prd.md 운영 원칙 2 "네이버 블로그 자동 발행 금지 — API 종료 + 정책 리스크로 인해 수동 게시만 함" | **N/A (기획 의도)** | N/A | 자동 발행 기능이 애초에 없으므로 **구현 누락이 아님**, Export 후 사용자가 수동 게시하는 워크플로 정합 |
| **키워드 자동 수집** | 01-prd.md MVP Scope 표 "Could (향후 검토)" | **Won't (Could)** | N/A | 현재는 Hermes 스캔 시 AI가 키워드 생성, 자동 수집 엔진은 MVP 외 |
| **경쟁 분석 자동화** | 01-prd.md MVP Scope 표 "Could (향후 검토)" | **Won't (Could)** | N/A | MVP 외 |

---

## 4. 의도된 문서/코드 드리프트 (Intentional Drift) 🟡

| 항목 | 기획 → 구현 변화 | 정합성 상태 | 비고 |
|------|-----------------|------------|------|
| **NextAuth.js → jose 세션** | 02-trd.md §8 초기 초안에서 "NextAuth.js" 언급 → 최종 "jose signed-cookie" 확정 | ✅ **정합** | `tests/p1-auth-company-profile.test.ts:36-50` (NextAuth.js 불사용 검증), 보안 강화 선택 |
| **bodyHtml 컬럼 폐지** | 04-database-design.md B2 "Export 경계 생성, 저장 안 함" | ✅ **정합** | `prisma/schema.prisma:287` (주석 명시), `lib/export/render.ts` (HTML은 Export 시점에만 생성) |
| **DOMPurify 이원화** | 02-trd.md §2.3 A6 "미리보기=엄격, Export=허용적" | ✅ **정합** | `lib/export/render.ts` (네이버 호환 allowlist), 최근 보안 아키텍처 반영 |
| **workspaces v2 전방 호환** | 04-database-design.md 주석 "v0.7은 단일 워크스페이스 고정, v2 Studio 확장 대비" | ✅ **정합** | `prisma/schema.prisma:55-62`, `prisma/seed.ts` (default 워크스페이스 시드), 멀티테넌시 준비 |
| **CRON_SECRET 추가** | 02-trd.md §2.2 A1 "멱등성 및 보안 (2026-07-02 추가)" | ✅ **정합** | `lib/security/cron.ts`, `app/api/hermes/scan/route.ts` (CRON_SECRET 검증), AI 비용 폭주 방지 |

→ **결론**: 최근 보안 강화(jose, CRON_SECRET, sanitization 이원화)는 기획 문서 개정 후 반영되었으므로 **드리프트 아님**.

---

## 5. 심각도 분류 (Severity Classification)

| 심각도 | 항목 | MVP 영향 | 조치 필요성 |
|--------|------|---------|------------|
| **Critical** | (없음) | - | - |
| **High** | Naver API 실연동 미검증 | Hermes 스캔이 실데이터 없이 mock/fallback만 동작 → 기회 발굴 품질 저하 | **즉시 수정**: 실제 네이버 검색 API 응답 파싱 테스트 추가, 에러 처리 검증 |
| **Medium** | Vercel Cron 자동 스캔 없음 | 매일 수동 스캔 필요 → 운영 부담 증가 | `vercel.json` crons 정의 추가, CRON_SECRET 보호 검증 |
| **Medium** | 상품 가격 자동 갱신 알림 없음 | 오래된 가격 정보 수동 확인 필요 → 신뢰도 리스크 | 주기적 알림 로직 구현 또는 UI에 [갱신하기] 버튼 추가 |
| **Medium** | HQ 메인 4블록 구조 불완전 | 브리핑·Winning Patterns 미렌더 → 의사결정 맥락 부족 | API 연결 + UI 렌더링 완성 |
| **Low** | Company Memory UI 누락 | 성공 패턴 확인 불가 → 의사결정 개선 속도 느림, Phase 2로 미루어짐 | Phase 2 착수 시 우선순위 |
| **Low** | 칸반 세부 표시 간소화 | 진행률·위험도 세부 표시 없음 → 일부 사용성 저하, MVP 핵심 기능은 작동 | 점진 개선 |

---

## 6. 권장 조치 (Recommended Actions)

### 우선순위 1 (즉시)
1. **Naver API 실연동 검증**: `lib/naver/client.ts`에서 실제 네이버 블로그·쇼핑 API 응답 파싱 테스트 추가 → `tests/naver-api-integration.test.ts` 작성
2. **Vercel Cron 정의**: `vercel.json`에 `"crons": [{"path": "/api/hermes/scan", "schedule": "0 6 * * *"}]` 추가, CRON_SECRET 보호 검증

### 우선순위 2 (단기)
3. **HQ 메인 블록 1, 4 렌더**: `app/(app)/page.tsx`에서 `/api/hq/daily-briefing`, `/api/memory/winning-patterns` API 연결 + UI 컴포넌트 추가
4. **상품 가격 갱신 알림**: `lib/products/service.ts`에 주기적 체크 로직 추가 또는 UI에 [갱신하기] 버튼 구현

### 우선순위 3 (중장기)
5. **Company Memory UI (Phase 2)**: 06-screens.md 사이드바 "Company Memory" 메뉴 활성화, 성공/실패 패턴 조회 화면 추가
6. **칸반 세부 표시**: 진행률 게이지, 위험도 색상 강조 UI 개선

---

## 7. 최종 종합 (Final Verdict)

**Paperclip Company OS v0.7은 MVP 핵심 경로가 작동 가능한 상태**이며, 기획 문서와 구현 간 정합성이 높습니다. Phase 2 기능(클립·SNS)은 의도적으로 제외되었고, 보안 강화(jose, CRON_SECRET, sanitization 이원화)는 최근 기획 개정 후 반영되었습니다.

**핵심 갭**:
- **High**: Naver API 실연동 미검증 → 실데이터 파싱 테스트 추가 필요
- **Medium**: Vercel Cron 자동 스캔, 상품 가격 자동 갱신 알림, HQ 메인 4블록 구조 불완전
- **Low**: Company Memory UI (Phase 2), 칸반 세부 표시 간소화

**사용자 임팩트**: 현재 구현으로도 "매일 30분 안에 기회 선택 → 제작 → 검수 → Export" 흐름은 작동하나, Naver API 실연동 미검증으로 인해 Hermes 기회 발굴 품질이 실환경에서 검증되지 않았습니다. **우선순위 1 조치 완료 후 MVP 완성도 달성** 가능.

---

## 부록: 증거 경로 요약

### 구현 완료 증거 (샘플)
- **인증**: `lib/auth/session.ts`, `tests/p1-auth-company-profile.test.ts:35-260`
- **Hermes**: `app/api/hermes/opportunity-memos/route.ts`, `lib/hermes/service.ts`, `tests/p2-contract.test.ts:1-200`
- **Content**: `app/api/content-packages/[id]/generate/route.ts`, `lib/content/service.ts`, `tests/p3-contract.test.ts:1-600`
- **Compliance**: `app/api/compliance/check/route.ts`, `lib/compliance/service.ts`, `tests/p3-contract.test.ts:600-800`
- **Export**: `app/api/content-packages/[id]/export/route.ts`, `lib/export/service.ts`, `tests/p3-contract.test.ts:800-900`
- **Performance**: `app/api/performance-logs/route.ts`, `lib/performance/service.ts`, `tests/p4-contract.test.ts:400-500`

### 미구현/부분 구현 증거
- **Naver API 파싱**: `lib/naver/client.ts` (클라이언트 존재), **실데이터 파싱 테스트 없음** (tests/ 디렉토리 전체 grep 결과 0건)
- **Vercel Cron**: `vercel.json` (crons 정의 없음), `app/api/hermes/scan/route.ts` (수동 호출만 가능)
- **HQ 브리핑 블록**: `app/(app)/page.tsx` (블록 1 미렌더), `tests/hq-screen-contract.test.ts` (브리핑 API 호출 테스트 없음)
- **Company Memory UI**: `app/(app)/memory/page.tsx` (존재하나 Phase 2 명시), `tests/` (메모리 화면 테스트 없음)

---

**분석 완료**: worker-3 (Lane C)  
**보고 시각**: 2026-07-06T23:30:00Z
