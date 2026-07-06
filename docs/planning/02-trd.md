# 02-trd.md: 기술 요구사항 (TRD)

> Paperclip Company OS v0.7
> 기준일: 2026-07-02

---

## 기술 스택 (확정)

| 영역 | 기술 | 이유 |
|-----|------|------|
| **Frontend** | Next.js (App Router) | 최신 React 패턴 + 서버 컴포넌트 활용, 빠른 개발 |
| **Backend** | Next.js API Routes | Vercel 올인 전략, 별도 서버 관리 불필요 |
| **데이터베이스** | PostgreSQL (Supabase) | 관계형 데이터 + 벡터 확장 가능 (향후 임베딩) |
| **ORM** | Prisma | TypeScript 안전성, 마이그레이션 자동화 |
| **배포** | Vercel + Supabase | Serverless 운영, 자동 스케일링 |
| **Job Runner** | Vercel Cron | 매일 Hermes 스캔 / 성과 집계 자동화 |
| **Storage** | Supabase Storage | 이미지, Export 파일 저장 |
| **AI 모델** | Open Question | 교체 가능한 인터페이스 뒤에 구현. 후보: Claude API / OpenAI API / 작업별 라우팅 |
| **인증** | jose signed-cookie session (단일 Owner) | `paperclip_session` httpOnly 서명 쿠키, CSRF 토큰, 멀티유저 불필요 |
| **모니터링** | Error logs + Cost logs | 기본 에러 추적, AI 호출 비용 기록 |
| **Environment** | Vercel Environment Variables | API 키, DB 주소 등 보안 관리 |

---

## 1. 시스템 구조

```text
사용자 (Owner)
    ↓
Next.js Frontend (App Router)
    ├── Pages: HQ, Hermes, Content, Revenue, Compliance, Memory, Reports
    └── API Routes: /api/*
    ↓
API Layer (Next.js API Routes)
    ├── /api/hq/*              → Paperclip HQ 의사결정
    ├── /api/hermes/*          → Hermes Research Division
    ├── /api/content-packages/* → 콘텐츠 패키지
    ├── /api/products/*        → 상품/링크 관리
    ├── /api/optimizers/*      → HomeFeed / Search 최적화
    ├── /api/compliance/*      → Compliance Gate
    ├── /api/performance/*     → 성과 로깅
    └── /api/memory/*          → Company Memory
    ↓
Service Layer (Business Logic)
    ├── HermesService          → 기회 발굴
    ├── ContentEngine          → 콘텐츠 생성 (AI 호출)
    ├── ComplianceEngine       → 검수 규칙
    ├── AnalyticsService       → 성과 분석
    └── CompanyMemoryService   → 패턴 저장
    ↓
Data Layer (Prisma ORM)
    ├── Models: company_profile, opportunity_memos, paperclip_decisions, ...
    └── Database: PostgreSQL (Supabase)
    ↓
External Services
    ├── Naver Blog Search API  → 검색 데이터 수집
    ├── Naver Shopping API     → 상품 데이터 수집
    ├── AI Model API           → 콘텐츠 생성 (Claude / OpenAI)
    └── Supabase Storage       → 파일 저장
```

---

## 2. 핵심 엔진 설계 (6개)

### 2.1 Paperclip HQ (의사결정 레이어)

**역할**: 오늘의 기회 선택, 작업 배정, 최종 승인, 위험 판단

**주요 API**:
```
GET  /api/hq/today                    → 일일 브리핑 (상태 요약)
POST /api/hq/daily-briefing           → 오늘 브리핑 생성 (Hermes 결과 수집)
GET  /api/hq/status                   → HQ 대시보드 데이터
POST /api/hq/decisions                → 주제 선택/보류/폐기
GET  /api/hq/decisions/:id            → 의사결정 상세
POST /api/hq/decisions/:id/approve    → 최종 승인
POST /api/hq/decisions/:id/reject     → 검수 실패 처리
```

**처리 로직**:
```javascript
// 1. Hermes 스캔 결과 수집
// 2. 각 기회마다 4축 점수 계산
// 3. 위험도 필터링 (high risk 제외 또는 사용자 알림)
// 4. 사용자 선택 대기
// 5. 선택 후 → ContentPackage 생성 + 모든 Desk에 task 배정
```

### 2.2 Hermes Research Division (기회 발굴)

**역할**: 네이버 검색 API로 시장 데이터 수집 → Opportunity Memo 생성

**주요 API**:
```
POST /api/hermes/scan                 → 전체 스캔 시작 (Vercel Cron 호출)
POST /api/hermes/scan/naver-blog      → 블로그 검색 API 호출
POST /api/hermes/scan/naver-shopping  → 쇼핑 API 호출
POST /api/hermes/opportunity-memos    → Memo 생성 (AI 처리)
GET  /api/hermes/opportunity-memos    → 모든 Memo 목록
GET  /api/hermes/opportunity-memos/:id → 상세
```

**보안 및 멱등성 (A1)**:
- 모든 cron 트리거 엔드포인트(`POST /api/hermes/scan` 등)는 반드시 `CRON_SECRET` 헤더 검증 필수 (외부인에 의한 AI 비용 폭주 방지)
- 멱등키는 **트리거 실행 ID 단위로** 생성 (일자별 unique 금지 — 예외 흐름의 [새로 스캔] 수동 재스캔과 충돌하므로)
- 동일 트리거 실행 ID로 재호출 시 opportunity_memos 중복 생성 0건 guarantee

**처리 로직**:
```
1. Vercel Cron 매일 아침 6시 실행
2. company_profile의 primary_categories로 검색 키워드 생성
3. 네이버 블로그 검색 API: 최근 7일 인기 글 수집
4. 네이버 쇼핑 검색 API: 트렌드 상품 수집
5. AI로 위 데이터를 기회 1개당:
   - why_now (왜 지금인가)
   - homefeed_angle (피드용 각도)
   - search_angle (검색용 각도)
   - interest_tags (관심사 태그)
   - homefeed_score / search_score / revenue_score / risk_score (4축 점수)
   - score_reasons (4축 근거 종합)
   변환하여 opportunity_memos 테이블에 저장
6. blocked_categories에 걸리면 자동 필터
```

**에러 처리 (폴백)**:
```
- Naver API 장애 시: "이전 스캔 결과 사용 + AI 보완"
- API 응답 느림 시: 타임아웃 10초 설정
```

### 2.3 Master Content Engine (콘텐츠 생성)

**역할**: 선택된 주제 → 채널별 콘텐츠 생성

**설계 원칙**:
- 채널별 Agent 물리 분리 하지 않음
- 1개 Core Engine + Channel Profile로 처리
- 입력: brief, products, shopping_connect_links, policy_rules, channel_profile
- 출력: draft (채널별)

**주요 API**:
```
POST /api/content-packages/:id/generate         → 전체 생성 시작
POST /api/content-packages/:id/generate-blog    → 블로그 본문만
POST /api/content-packages/:id/generate-sns     → SNS 변환만
POST /api/content-packages/:id/regenerate-draft → 특정 draft 재생성
```

**처리 로직**:
```
입력 분석:
- brief: 주제, 4축 점수, 각도
- products: [{ name, url, price, price_checked_at, memo }]
- shopping_connect_links: [{ product_id, link, commission_rate, direct_score }]
- company_profile: tone_rules, content_principles
- category_playbook: 카테고리별 포맷 (자취 / 계절 / 청소 등)
- policy_rules: 피해야 할 표현 리스트

AI에 전달:
- Prompt: ContentEngine.nunjucks 템플릿
- Context: 모든 입력 데이터
- 제약: token limit 6000 (안전 마진), temperature 0.7

출력 저장 (drafts 테이블, A6):
- homefeed_title: 상위 3개
- search_title: 검색용 1개
- thumbnail_text: 5개
- body_markdown: 블로그 원문 (Markdown) — **콘텐츠 정본** (AI 출력)
- body_html: **(상시 저장 폐지)** HTML은 Export 경계에서만 생성
- disclosure_text: 쇼핑커넥트 대가성 문구
- price_notice: 가격 기준일 표기
- status: 'draft'

**Sanitization 이원화 (A6 — 신뢰 경계)**:
| 영역 | 방식 | 도구 | 목표 |
|-----|------|------|------|
| **미리보기** (에디터 내 렌더) | 엄격한 화이트리스트 | DOMPurify (default config) | XSS 원천 차단 |
| **Export** (산출물 생성) | 허용적 allowlist | 네이버 에디터 호환 태그 (ul/ol/li/strong/em/a/img/br/p 등) | 콘텐츠 품질·가독성 유지 |
| raw_items (제3자 검색 결과) | 외부 신뢰 불가 | DOMPurify + CSP 헤더 | Stored XSS 방어 |
```

**✅ 비동기 실행 모델 — 확정: 경량 중간해 (2026-07-02, council-report §4-2 사용자 결정)**:
동기식 단일 `POST /api/content-packages/:id/generate`는 Vercel Serverless 타임아웃과 충돌하므로 폐기하고, 아래 방식으로 확정합니다.

- **실행 방식**: Vercel `maxDuration` 연장 + **클라이언트가 생성 단계를 순차 호출** — 제목 생성 → 검색 구조 → 본문 생성 → 검수를 각각 별도 POST로 분리 (단계당 1 함수 실행, 타임아웃 내 완료)
- **진행 가시성**: 각 단계 응답이 다음 단계 트리거 — §9 성능 기준(시작 피드백 <1초 + 단계별 진행 표시)과 자연 정합
- **비용 정합**: 단계 경계 = 서킷브레이커 예산 체크 지점(§5) — soft-stop이 단계 단위로 동작, 중단 시 데이터 유실 없음
- **중단/재개**: 브라우저 이탈 시 파이프라인 중단 — content_packages.progress + drafts 저장 상태 기준으로 **완료된 단계 다음부터 재개** (미완료 단계 재호출은 멱등)
- **기각안 기록**: 잡 큐(Inngest/QStash/Supabase Queues)는 새 벤더 종속 + 웹훅 서명 검증 공격면 + eventual consistency UX 복잡성으로 1인 MVP에 과잉 — Phase 2+ 재검토 가능

P3-R1 착수 조건 충족 (선행 결정 완료).

### 2.4 Channel Profiles (채널 규칙)

각 채널별로 프롬프트 변형만 다르게:

**NaverBlogProfile**
- 목표: 홈피드 + 검색 동시 최적화
- 출력: homefeed_title, search_title, thumbnail_text, first_screen, blog_body, comparison_table, faq, price_notice
- 제약: 대가성 문구 상단, 미사용 상품 후기 금지

**NaverClipProfile**
- 목표: 20~30초 숏폼 (Phase 2)
- 출력: clip_script, opening_hook, scene_plan, tag_memo, blog_cta
- 제약: 빠른 문제 제기 + 해결 리스트

**InstagramProfile**
- 목표: 저장·공유 유도
- 출력: carousel_slides, caption, hashtags
- 제약: 첫 장 강한 후킹

**ThreadsProfile**
- 목표: 공감·답글 유도
- 출력: post_series, question_ending, soft_cta
- 제약: 요약체 금지, 질문형 끝

**XProfile**
- 목표: 선명한 관점, 반응 유도
- 출력: single_posts, thread, hook_variants
- 제약: 한 문장에 관점, 링크 첫 문장 금지

### 2.5 Compliance Engine (검수 규칙)

**역할**: 규칙 기반 + LLM 의미 검수

**주요 API**:
```
POST /api/compliance/check            → Draft 검수 시작
GET  /api/compliance/checks/:id       → 검수 보고서
POST /api/compliance/checks/:id/apply-fixes → 자동 수정 적용
```

**검수 규칙** (policy_rules 테이블):
```javascript
규칙 1: [쇼핑커넥트]
- 링크 존재? → 필수
- 대가성 문구? → 필수 (위치: 본문 상단)
- 활동 제한 채널? → 블로그 OK, SNS는 채널별 확인

규칙 2: [가격]
- 가격 포함? → price_checked_at 필수
- 변동 가능 표현? → "기준일 기준, 변동 가능" 추가

규칙 3: [출처]
- 상품명·스펙의 출처 명시?
- 이미지 출처?
- 클레임의 근거?

규칙 4: [표현]
- 금지: 100% / 무조건 / 완벽 / 최저가 / 1위 / 최고 / 0원
- 금지: 미사용 상품 후기체
- 금지: 건강·효능·안전성 단정
- 금지: 의료·투자 조언

규칙 5: [내용]
- 본문 첫 화면에서 약속 회수?
- 낚시성? (AI 루브릭)
```

**검수 출력** (compliance_checks 테이블):
```json
{
  "pass": false,
  "risk_level": "medium",  // low / medium / high
  "issues": [
    {
      "type": "price_checked_at_missing",
      "field": "body_markdown",
      "severity": "medium",
      "message": "상품 가격이 포함되어 있으나 가격 확인일이 없습니다.",
      "suggested_fix": "가격은 2026년 7월 1일 확인 기준이며 변동될 수 있습니다."
    }
  ],
  "export_allowed": true  // high risk 0건 + medium 사용자 확인 완료
}
```

### 2.6 Analytics / CFO Engine (성과 분석)

**역할**: 게시 후 성과 기록 → Company Memory 반영

**주요 API**:
```
POST /api/performance-logs            → 성과 기록
GET  /api/performance-logs            → 성과 목록
GET  /api/performance/content/:id     → 글별 성과 분석
GET  /api/revenue/summary             → 수익 요약
GET  /api/memory/winning-patterns     → 잘 된 패턴
```

**처리 로직**:
```
1. 사용자 입력: 게시 URL, 조회수, 클릭, 수익, 후킹 유형 (5개 필드만)
2. performance_logs에 저장
3. 동시에 content_packages의 publish_readiness 업데이트
4. Company Memory 규칙:
   - 후킹 유형별 성과 저장
   - 상품 카테고리별 수익 저장
   - 제목 유형별 CTR 저장
   - 실패 패턴 저장 (조회수 <100 글)
5. 다음 의사결정 시 company_memory 조회해서 추천값 계산
```

**Company Memory 최소 실효선 (A9)**:

| 요구사항 | 설명 | 근거 |
|--------|------|------|
| **구조화 필드** | 자유 텍스트 단일 `pattern` 필드 → `pattern_type`(enum) + `pattern_text` + `tags`(배열) 분해 | Prompt Injection 주입면 축소, 집계 가능성 확보 |
| **Enum 태그** | pattern_type ∈ {homefeed_hook, search_keyword, product_angle, pricing_strategy, seasonal_theme} | 자유 텍스트 금지 |
| **표본 N<5 제어** | sample_count < 5이면 추천 배제, 대신 "배우는 중" 배지 표시 | 통계 신뢰도 확보 |
| **패턴 가시성** | memory.created_pattern_ids 필드: "이 패턴이 실제 #content_pkg_123번 생성에 쓰임" 추적 | 추천의 근거 명시 |

**company_memory 테이블 확장** (A9):
```typescript
{
  id: string,
  user_id: string,
  
  // 구조화 필드 (A9)
  pattern_type: "homefeed_hook" | "search_keyword" | "product_angle" | "pricing_strategy" | "seasonal_theme",
  pattern_text: string,           // AI가 추출한 핵심 문구
  tags: string[],                  // enum 태그들
  
  // 통계
  sample_count: number,            // 몇 개의 performance_logs 기반인가
  avg_views: number,
  avg_clicks: number,
  avg_revenue_usd: number,
  
  // 신뢰도 추적
  created_pattern_ids: string[],   // 이 패턴이 생성한 content_package IDs
  used_in_recommendations: number, // 추천에 몇 번 쓰였나
  
  created_at: timestamp,
  updated_at: timestamp
}
```

---

## 3. 상태값 머신

**주요 상태 전이**:

```text
opportunity_found
    ↓
paperclip_review
    ├→ selected (선택)
    ├→ on_hold (보류)
    └→ rejected (폐기)
    ↓ (selected만 진행)
assigned
    ↓
brief_created
    ↓
homefeed_packaged
    ↓
search_structured
    ↓
revenue_links_attached
    ↓
blog_draft_generated
    ↓
sns_repurposed (Phase 2)
    ↓
compliance_checked
    ├→ compliance_failed (수정 필요)
    │   └→ ... (재진행)
    └→ compliance_passed
        ↓
        owner_approval_required
        ├→ approved
        └→ needs_revisions
        ↓ (approved만 진행)
        exported
        ↓
        published_manually
        ↓
        performance_recorded
        ↓
        memory_updated
        ↓
        archived
```

**예외 상태**:
- `duplicate`: 비슷한 주제 최근 발행
- `stale`: 가격/링크 갱신 필요
- `needs_research`: 데이터 부족
- `low_revenue_fit`: 수익 가능성 낮음
- `low_homefeed_fit`: 홈피드 적합도 낮음
- `policy_risk`: 고위험 카테고리

---

## 3.5 데이터 접근 경계 설계 (A7)

**원칙**: Row-Level Security(RLS) 미사용 + 모든 데이터 접근은 서버 API Routes 경유

| 항목 | 정책 | 근거 |
|-----|------|------|
| **데이터베이스 RLS** | 미사용 | 단일 사용자 + Prisma ORM 직결이므로 row-level filtering 불필요. 대신 서버측 API에서 검증 |
| **Supabase Anon Key** | 클라이언트 미사용 | 모든 DB 접근은 API Routes 경유. anon key는 Storage 서명 URL 생성 전용 |
| **Connection Pooling** | PgBouncer 또는 Vercel Postgres | DATABASE_URL(풀) / DIRECT_URL(마이그레이션) 구분 명시 |
| **Storage 버킷** | 비공개 (Private) | 임포트 이미지, Export 파일 모두 서명된 URL만 제공 (public read 금지) |
| **API Routes** | Vercel serverless 함수 | 모든 비즈니스 로직 검증·로깅·속도 제한은 이 계층에서 수행 |

**신뢰 경계 도식**:
```
클라이언트 (브라우저)
    ↓ (HTTPS + 쿠키 세션)
API Routes (Next.js, env 시크릿 보유)
    ├→ Prisma ORM (DATABASE_URL)
    ├→ Supabase Storage (SERVICE_KEY로 서명 URL 생성)
    └→ 외부 API (NAVER_*, OPENAI_*, 등)
    
❌ 클라이언트 → 데이터베이스 직결 (anon key 사용 금지)
❌ 클라이언트 → Storage 직접 업로드 (presigned URL도 제한적)
```

---

## 4. 데이터 흐름

```text
매일 아침 6시
    ↓ Vercel Cron
Hermes 스캔
    ├→ Naver Blog API (최근 키워드 글)
    ├→ Naver Shopping API (인기 상품)
    └→ AI로 기회 종합 (3~5개)
    ↓
opportunity_memos 테이블에 저장
    ↓
사용자 HQ 접속 (아침 10시경)
    ├→ 3~5개 기회 표시
    ├→ 각 기회의 4축 점수 + 근거 문장
    └→ [선택] 클릭
    ↓
Paperclip Decision 생성
    ├→ content_packages 생성
    ├→ 모든 Desk에 task 배정
    └→ status = 'assigned'
    ↓
AI 차례대로 처리
    ├→ HomeFeed Desk → homefeed_score, homefeed_title
    ├→ Search Desk → search_score, search_title, keyword_cluster
    ├→ ShoppingConnect Desk → revenue_score, link_placement
    ├→ Blog Desk → blog_draft 생성
    ├→ SNS Desk → sns_variants (Phase 2)
    └→ Compliance Desk → compliance_check
    ↓
Export 가능 여부 결정
    ├→ high risk 0건? → OK
    ├→ medium risk? → 사용자 수동 확인
    └→ 통과 → export_allowed = true
    ↓
사용자 [Export] 클릭
    ├→ Markdown, HTML, Copy Block 4가지 형식
    └→ exports 테이블에 기록
    ↓
사용자 수동 게시 (네이버, SNS)
    ↓
사용자 성과 기록 (URL, 조회수, 클릭, 수익, 후킹 유형)
    ├→ performance_logs 저장
    └→ company_memory 업데이트
```

---

## 5. AI 비용 관리 및 서킷브레이커 (A2)

**역할**: AI 호출 비용의 실시간 추적 및 예산 보호

**2단계 서킷브레이커**:
```
1. 소프트 임계 (Soft Alert)
   - 일일 누적 비용이 설정 한도의 70% 도달 시
   - HQ 헤더에 경고 배지 표시: "AI 생성 비용 72% 사용 중"
   - 사용자 액션 계속 허용

2. 하드 캡 (Hard Stop)
   - 일일 누적 비용이 한도 100% 도달
   - 신규 Content 생성 및 regenerate 호출 차단
   - 응답: { success: false, error: { code: "COST_LIMIT_EXCEEDED", message: "오늘의 생성 한도를 모두 사용했습니다. 내일 다시 시도하세요." } }
```

**진행 중 파이프라인 안전성**:
- 각 단계 경계(Hermes → Content → Compliance → Export)에서 예산 체크
- 남은 예산 < 필요 토큰이면 current step 완주 + 다음 step은 soft-stop (중단 ≠ 데이터 유실 금지)
- cost_logs에 step별 누적 기록 + "차단된 상태" flag

**cost_logs 테이블 확장**:
```javascript
{
  id: string,
  model: string,
  task: string,
  input_tokens: number,
  output_tokens: number,
  cost_usd: number,
  pipeline_step: "hermes" | "content" | "compliance" | "export",
  blocked_by_cap: boolean,   // 새로 추가
  created_at: timestamp
}
```

---

## 6. AI 모델 인터페이스 (어댑터 패턴)

**현재 Open Question**, 다음 원칙으로 설계:

```typescript
// AI 호출은 항상 Adapter 뒤에
interface AIAdapterInterface {
  generateOpportunityMemo(input: HermesInput): Promise<OpportunityMemo>;
  generateBlogDraft(input: ContentInput, profile: NaverBlogProfile): Promise<Draft>;
  generateSNSVariant(input: ContentInput, profile: SNSProfile): Promise<SNSVariant>;
  scoreHomefeed(draft: Draft): Promise<HomefeedScore>;
  checkCompliance(draft: Draft, rules: ComplianceRules): Promise<ComplianceCheck>;
}

// 구현체 (모델별)
class ClaudeAdapter implements AIAdapterInterface { ... }
class OpenAIAdapter implements AIAdapterInterface { ... }
class HybridAdapter implements AIAdapterInterface {
  // 작업별 최적 모델 라우팅
}
```

**모델 변경 시 최소한만 수정**:
1. AIAdapter 구현체만 변경
2. 프롬프트 템플릿만 변경
3. API 경로 / 비용 로깅만 수정
4. 나머지 비즈니스 로직은 그대로

**Export 어댑터 (PublisherAdapter — v2 전방 호환, 2026-07-04)**:

Export 생성 로직도 AI와 같은 원칙으로 어댑터 뒤에 둔다. v0.7의 유일 구현체는 네이버 수동 게시용
Export지만, v2(Studio)의 Instagram/Threads/X 발행 확장 시 인터페이스는 불변이어야 한다.

```typescript
interface PublisherAdapter {
  render(pkg: ContentPackage, draft: Draft): Promise<ExportBundle>; // Markdown/HTML/Copy/ZIP
  publish?(bundle: ExportBundle): Promise<PublishResult>;           // v0.7 미구현 (수동 게시)
}

class NaverExportAdapter implements PublisherAdapter { ... }  // v0.7 유일 구현체
// v2: InstagramPublisherAdapter, ThreadsPublisherAdapter, XPublisherAdapter
```

원칙: 채널 추가 시 어댑터 구현체만 추가, Export API(P3-R3)·승인 플로우·Compliance Gate는 수정하지 않는다.

---

**AI 출력 검증 (A8)**:

**원칙**: 모든 AI 출력은 zod 스키마 검증 후 저장. 규칙 기반 컴플라이언스가 LLM 판정을 override.

**단계별 적용 우선순위**:
1. **AI 생성 JSON 파싱** (최고 우선) — 모든 generateOpportunityMemo, generateBlogDraft 출력
2. **상태 변경·외부 데이터 유입** — POST /api/products/import, POST /api/hermes/scan
3. **일반 사용자 입력** (낮은 우선)
4. **JSON 컬럼 내부 구조** (MVP 후순위)

**검증 흐름**:
```
LLM 응답 → zod 스키마 파싱 (Validation) 
  → 실패: 에러 로깅 + 재시도 또는 폴백
  → 성공: DB 저장

Compliance Check 실행:
  → 규칙 기반 점수 (Rule Engine) ← 이것이 최종 권위
  → LLM 의미 검수 (의견 참고용) 
  → Rule 점수가 High/Critical 이면 LLM 판정 무시 (export_allowed = false)
  → Rule 점수가 Low/Medium 이면 LLM 의견 포함
```

**zod 스키마 예시** (lib/validators.ts):
```typescript
import { z } from 'zod';

export const OpportunityMemoSchema = z.object({
  topic: z.string().min(1),
  why_now: z.string().min(10),
  homefeed_angle: z.string().min(5),
  search_angle: z.string().min(5),
  interest_tags: z.array(z.string()).min(1).max(5),
  homefeed_score: z.number().int().min(0).max(100),
  search_score: z.number().int().min(0).max(100),
  revenue_score: z.number().int().min(0).max(100),
  risk_score: z.number().int().min(0).max(100),
  score_reasons: z.string().min(10),
});

export type OpportunityMemo = z.infer<typeof OpportunityMemoSchema>;
```

---

## 6. API 응답 포맷 (통일)

모든 엔드포인트:

```json
{
  "success": true,
  "data": { /* 실제 데이터 */ },
  "error": null,
  "timestamp": "2026-07-02T10:30:00Z",
  "request_id": "req_xxx"
}
```

에러 응답:

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "HERMES_API_TIMEOUT",
    "message": "Naver API가 응답하지 않습니다. 이전 스캔 결과를 사용합니다.",
    "details": { "api": "naver_shopping", "timeout_ms": 10000 }
  },
  "timestamp": "2026-07-02T10:30:00Z",
  "request_id": "req_xxx"
}
```

---

## 7. 환경변수 관리 (Vercel)

```env
# Database
DATABASE_URL=postgresql://...@supabase.com/postgres

# Auth
NEXTAUTH_SECRET=... # legacy-compatible name; jose paperclip_session signing secret
OWNER_EMAIL=owner@example.com
OWNER_PASSWORD_HASH=...

# AI Model (미결)
# OPENAI_API_KEY=...
# CLAUDE_API_KEY=...
AI_ADAPTER=hybrid

# External APIs
NAVER_BLOG_SEARCH_API_KEY=...
NAVER_SHOPPING_API_KEY=...

# Storage
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_KEY=...

# Logging
SENTRY_DSN=...

# Monitoring
COST_LOG_ENABLED=true
ERROR_LOG_ENABLED=true
```

---

## 8. 에러 처리 및 로깅

**error_logs 테이블**:
```javascript
{
  id: string,
  error_code: string,
  message: string,
  stack_trace: string,
  context: {
    user_id: string,
    api_path: string,
    request_body: object,
    request_id: string
  },
  severity: 'low' | 'medium' | 'high',
  created_at: timestamp,
  resolved_at: timestamp | null,
  resolution_note: string | null
}
```

**cost_logs 테이블**:
```javascript
{
  id: string,
  model: string,       // claude / gpt-4 / gpt-3.5
  task: string,        // generate_memo / generate_blog / etc
  input_tokens: number,
  output_tokens: number,
  cost_usd: number,
  created_at: timestamp
}
```

---

## 9. 성능 기준 (A5)

**기준 재정의**: "생성 시간" 중심에서 "사용자 피드백" 중심으로 변경

| 항목 | 기준 변경 | 근거 |
|-----|--------|------|
| **HQ 메인 로딩** | < 2초 | (변경 없음) |
| **Hermes 스캔 완료** | < 30초 (매일 아침, 병렬 처리) | (변경 없음) |
| **Blog Draft 생성** | **생성 시작 피드백 < 1초** + **단계별 진행 상태 가시화** + **완료 알림 도달** | 기존 "< 10초" 는 Vercel Pro maxDuration과 충돌. 측정 대상 변경으로 비동기 대기 UX를 먼저 설계 |
| **Compliance 검수** | < 5초 | (변경 없음) |
| **Export 생성** | < 3초 | (변경 없음) |
| **API 응답 (일반)** | < 500ms | (변경 없음) |
| **DB 쿼리** | < 100ms | (변경 없음) |

**추가 기준 (A5 — AI 호출량 추적)**:
| 항목 | 목표 |
|-----|------|
| **일일 AI 호출량 기준선** | 초기값 TBD (cost_logs 기반 진행) |
| **재생성 폭주 감지** | 동일 content_package에서 2시간 내 3회 이상 regenerate 시 경고 배지 표시 |

---

## 10. 보안 & 컴플라이언스

- **인증 (A4 — jose signed-cookie 단일 Owner 세션 방식으로 확정)**:
  - 방식: `jose`로 서명한 httpOnly `paperclip_session` 쿠키 기반 세션 인증. Bearer Token 및 `next-auth` 패키지는 사용하지 않음
  - 자격증명: `OWNER_EMAIL` + `OWNER_PASSWORD_HASH` 환경변수 기반 단일 Owner 로그인
  - 로그인 성공: `POST /api/auth/login`은 `paperclip_session` 쿠키와 응답 본문의 CSRF 토큰(`csrf_token`)을 발급
  - 세션 조회: `GET /api/auth/session`은 쿠키를 읽어 사용자 정보, CSRF 토큰, 만료 시각을 반환
  - 보호: middleware/proxy가 `jose` 쿠키를 검증하고 미인증 API 요청은 401 처리. rate limit 미들웨어는 5회 실패 시 1분 lock, 자동 lockout 금지 — 유일 사용자 자기잠금 방지
  - CSRF 방어: 상태 변경 API(`POST /api/hq/decisions`, `POST /api/compliance/*/apply-fixes` 등)는 세션의 CSRF 토큰과 `x-csrf-token` 헤더 일치 검증 필수
  - 세션 만료 중 자동 저장 손실 방지: 에디터 자동 저장 실패 시 로컬 스토리지 보존 → 재로그인 후 재전송 경로 제공
  
- **HTTPS**: 모든 통신 암호화
- **환경변수**: Vercel Secrets (노출 금지) + `CRON_SECRET` 추가 (A1)
- **데이터 삭제**: 아카이브 후 90일 자동 삭제 정책
- **감시**: error_logs / cost_logs 매일 리뷰

---

## Loop Metadata

- **Upstream documents referenced**: 00-source-plan.md (시스템 구조, 엔진 설계, API 설계, 기술 스택, 상태값), 01-prd.md (기능 요구사항)
- **Downstream documents affected**: 04-database-design.md (Prisma 스키마), 07-coding-convention.md (API 구현 규칙), 08-business-model.md (비용 추적)
- **Open questions**: AI 모델 최종 선택 (Claude vs OpenAI vs 하이브리드), Naver API 쿼터 확정, 초기 배포 서버 선택 (Vercel만 vs 혼합)
- **Assumptions**: Vercel Cron의 신뢰성, Naver API의 안정성, PostgreSQL의 확장성 (초기 사용자 1인)
