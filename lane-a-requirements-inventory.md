# Lane A — Documentation Requirements Inventory
## Paperclip Company OS (v0.7)

**분석일**: 2026-07-06  
**Worker**: worker-1  
**문서 출처**: docs/planning/**/*.md, specs/**/*.yaml

---

## 1. 제품 핵심 정의 (00-source-plan.md, 01-prd.md)

### 1.1 제품 정체성
- **1인 AI 미디어커머스 회사 운영 OS** — 사용자 혼자 운영하지만 내부는 회사처럼 작동
- Hermes(시장조사) → Paperclip HQ(경영) → 부서형 AI Agent(제작) → Owner(승인) 구조
- **경로**: docs/planning/00-source-plan.md §1, §3

### 1.2 핵심 워크플로우
- 매일 기회 발굴 → 주제 선택 → 콘텐츠 생성 → 검수 → 승인 → Export → 수동 게시 → 성과 기록 → Memory 반영
- **목표**: 하루 30분 이내 운영 (v0.7 확정)
- **경로**: docs/planning/00-source-plan.md §6

---

## 2. MVP 범위 (Phase 1, P0-P1 기술 스택)

### 2.1 기술 스택 확정 (02-trd.md)
- **Frontend**: Next.js (App Router)
- **Backend**: Next.js API Routes
- **DB**: PostgreSQL (Supabase) + Prisma ORM
- **배포**: Vercel + Supabase
- **Job Runner**: Vercel Cron (매일 06:00 Hermes 스캔)
- **인증**: jose signed-cookie session (단일 Owner, httpOnly `paperclip_session` + CSRF)
- **AI 모델**: 교체 가능 인터페이스 (Claude/OpenAI 선택)
- **경로**: docs/planning/02-trd.md §기술 스택, docs/planning/06-tasks.md P0-T1

### 2.2 MVP 포함 기능 (13개, 01-prd.md §5)
| # | 기능 | 설명 | 문서 경로 |
|---|------|------|----------|
| 1 | Paperclip HQ 메인페이지 | 오늘의 기회, 제작·검수·수익 상태 한 화면 확인 | 01-prd.md §5, 06-screens.md §1 |
| 2 | Hermes Opportunity Memo | 네이버 블로그·쇼핑 검색 API 실데이터 기반 기회 보고서 | 01-prd.md §5, 02-trd.md §2.2 |
| 3 | 주제 점수화 | 홈피드/검색/수익/리스크 4축 점수(0~100) + 근거 문장 | 01-prd.md §5, specs/domain/resources.yaml opportunity_memos |
| 4 | 홈판형 제목 생성 | 피드 클릭될 제목, 썸네일 문구, 첫 화면 구조 | 01-prd.md §5 |
| 5 | 검색형 구조 생성 | 검색형 제목, 키워드 클러스터, H2/H3, FAQ, 비교표 | 01-prd.md §5 |
| 6 | 쇼핑커넥트 상품/링크 관리 | 상품명·가격·링크·수수료율·확인일, URL 붙여넣기 수준 입력 | 01-prd.md §5, specs/domain/resources.yaml products |
| 7 | 블로그 원문 생성 | 홈피드+검색+쇼핑 수익형 블로그 본문 (Markdown 정본) | 01-prd.md §5, loop/revision-request-02.md A6 |
| 8 | 네이버 클립 대본 생성 | 20~30초 숏폼 대본, 정보태그/쇼핑태그 메모 (Phase 2로 연기) | 01-prd.md §5 |
| 9 | SNS 변환 | Instagram 캐러셀, Threads, X 문장 (Phase 2) | 01-prd.md §5 |
| 10 | Compliance Gate | 대가성 문구, 가격 기준일, 출처, 과장 표현 검수 | 01-prd.md §5, 02-trd.md §2.5 |
| 11 | Export Bundle | Markdown, HTML, 복사용 본문, ZIP 번들 출력 | 01-prd.md §5, specs/domain/resources.yaml exports |
| 12 | Performance Logger | 게시 URL, 조회수, 클릭, 수익, 후킹 유형 기록 (숫자 3~4개만) | 01-prd.md §5 |
| 13 | Company Memory | 잘 된 제목, 상품, 카테고리, 실패 원인 저장 | 01-prd.md §5, 02-trd.md §2.6 |

---

## 3. 데이터베이스 설계 (04-database-design.md, 28개 모델)

### 3.1 핵심 테이블 그룹
- **Platform**: workspaces (v2 전방 호환)
- **Company**: company_profile, hq_briefing
- **Hermes**: sources, raw_items, opportunity_memos
- **Paperclip**: paperclip_decisions
- **Content**: topics, keyword_clusters, content_packages, drafts, sns_variants, title_candidates, exports
- **ShoppingConnect**: products, shopping_connect_links
- **Compliance**: compliance_checks, compliance_issues, policy_rules, status_transitions
- **Analytics**: performance_logs, revenue_logs, cost_logs, error_logs
- **Memory**: company_memory, prompt_templates
- **Admin**: agent_runs, category_playbooks

### 3.2 핵심 설계 원칙 (loop/revision-request-02.md B1~B7)
- **B1**: PackageStatus는 Prisma enum (String 금지), StatusTransition 이력 테이블, 단일 전이 서비스 경유
- **B2**: Draft.bodyHtml 폐지 (Export 경계에서만 생성), faq는 JSON: `[{question, answer}]`
- **B3**: Draft.originalBody 스냅샷 (되돌림 버튼 지원)
- **B4**: compliance_issues 감사 필드 (dismissed_by, dismissed_at, dismiss_reason)
- **B5**: error_logs.context 민감 필드 마스킹 (password, token, secret, authorization)
- **B6**: company_memory 구조화 (자유 텍스트→enum 태그 + sample_count)

**경로**: docs/planning/04-database-design.md 전체, docs/planning/loop/revision-request-02.md §B

---

## 4. 화면 설계 (06-screens.md, 5개 화면)

| # | 화면 | 경로 | 주요 기능 | 문서 경로 |
|---|------|------|----------|----------|
| 1 | HQ 메인 | / | 4개 블록: 경영 브리핑, Hermes Memo 카드, 칸반 파이프라인, Winning Patterns + 우측 4개 섹션 | 06-screens.md §1, specs/screens/hq-main.yaml |
| 2 | 콘텐츠 상세 | /packages/:id | 제목/본문 에디터, 탭: 요약·검수·Export | 06-screens.md §2, specs/screens/content-detail.yaml |
| 3 | 상품/링크 관리 | /products | 상품 목록, URL 붙여넣기 import, 가격·수수료 관리 | 06-screens.md §3, specs/screens/products.yaml |
| 4 | 성과 기록 | /performance | 게시 URL, 조회·클릭·수익 숫자 3~4개 입력, 후킹 유형 | 06-screens.md §4, specs/screens/performance.yaml |
| 5 | 설정 | /settings | company_profile, 카테고리, 톤, 운영 원칙 | 06-screens.md §5, specs/screens/settings.yaml |

### 4.1 화면 설계 핵심 원칙 (loop/revision-request-02.md D1~D6)
- **D1**: 토스트 심각도 분리 (정보성=자동 소멸 / 에러=수동 해제)
- **D2**: 헤더 상태 색상 (정상=중립/긍정, 경보=빨강)
- **D3**: 사이드바 Phase 1 숨김 (미구현 하위 메뉴 렌더 금지)
- **D4**: 터치 타깃 반응형 (모바일 44px, 데스크톱 28px)
- **D5**: content-detail [저장][취소] 제거 (자동 저장), [되돌림]은 originalBody 기반
- **D6**: HQ 미기록 배지 (게시 후 성과 미기록 콘텐츠 수)

---

## 5. API 엔드포인트 계약 (specs/domain/resources.yaml, 02-trd.md)

### 5.1 Hermes API
- `POST /api/hermes/scan` — 전체 스캔 (Vercel Cron), CRON_SECRET 검증 필수
- `GET /api/hermes/opportunity-memos` — 목록
- `GET /api/hermes/opportunity-memos/:id` — 상세 + keyword_clusters 내장

### 5.2 HQ API
- `GET /api/hq/status` — 일일 브리핑 상태 요약
- `POST /api/hq/daily-briefing` — 오늘 브리핑 생성
- `POST /api/hq/decisions` — 주제 선택/보류/폐기
- `POST /api/hq/decisions/:id/approve` — 최종 승인
- `POST /api/hq/decisions/:id/reject` — 반려

### 5.3 Content API
- `POST /api/content-packages/:id/generate` — 콘텐츠 생성 (비동기, 단계별 순차 호출)
- `PATCH /api/drafts/:id` — 본문 수정
- `POST /api/content-packages/:id/export` — Export Bundle 생성 (Markdown, HTML, 복사용, ZIP)

### 5.4 Products API
- `POST /api/products` — 수동 입력
- `POST /api/products/import` — URL 붙여넣기 크롤링 (SSRF 방어: allowlist, 내부 IP 차단, 리다이렉트 제한)
- `GET /api/products?stale=true` — 가격 갱신 필요 목록

### 5.5 Compliance API
- `POST /api/compliance/check` — Draft 검수
- `POST /api/compliance/issues/:id/dismiss` — 이슈 무시 (low=원클릭, medium=사유 필수, high=금지)

### 5.6 Performance API
- `POST /api/performance-logs` — 성과 기록
- `GET /api/memory/winning-patterns` — 잘 된 패턴

**경로**: specs/domain/resources.yaml, docs/planning/02-trd.md §1, §2

---

## 6. 보안 요구사항 (loop/revision-request-02.md §C2, A 계열)

### 6.1 P0 보안 체크리스트
- **C2-①**: CRON_SECRET 헤더 검증 (P2-R1 Cron 엔드포인트 보호)
- **C2-②**: sanitization 이원화 (미리보기=DOMPurify 엄격 / Export=네이버 호환 allowlist)
- **C2-③**: error_logs.context 민감 필드 마스킹
- **C2-④**: `npm audit` 초기 통과 기록
- **C2-⑤**: env 파일 시크릿 저장, .gitignore 검증

### 6.2 인증 및 세션 (A4)
- jose signed-cookie 단일 Owner 인증
- httpOnly `paperclip_session` + CSRF 토큰
- 상태 변경 API CSRF 보호
- rate limit 적용 (공격적 lockout 금지)
- 세션 만료 시 로컬 보존 → 재로그인 후 재전송

### 6.3 데이터 접근 경계 (A7)
- RLS 미사용, 전 접근 서버(API Routes) 경유
- Supabase anon key 클라이언트 미사용
- Storage 버킷 비공개
- pgBouncer/DIRECT_URL 구분

### 6.4 AI 출력 검증 (A8)
- 모든 AI 출력 JSON zod 스키마 검증 필수
- 규칙 기반 컴플라이언스 판정이 LLM 판정을 override

**경로**: docs/planning/loop/revision-request-02.md §A, §C

---

## 7. 운영 원칙 (11개, 01-prd.md §4)

1. **블로그는 원본, 클립/SNS는 재활용** — 1주제당 블로그 1개 → 여러 채널 변형
2. **네이버 블로그 자동 발행 금지** — API 종료 + 정책 리스크, 수동 게시만
3. **쇼핑커넥트 링크 → 대가성 문구 필수** — 없으면 Export 차단
4. **가격 → 가격 기준일 필수** — 언제 확인한 가격인지 명시
5. **미사용 상품 후기체 금지** — 신뢰·법적 리스크
6. **홈판 제목은 강하게, 본문 첫 화면에서 약속 회수** — 낚시성 제목 방지
7. **링크 수보다 특정 상품 직접 클릭 이유 만들기** — 광고글 피로도 방지
8. **매일 성과 기록 + 잘 된 패턴만 반복** — Company Memory 저장, 다음 기회 활용
9. **고위험 카테고리 제외** — 건강, 투자, 법률, 의료, 다이어트 초기 제외
10. **하루 최대 5개 기회 제시** — 정보 과잉 방지
11. **매일 콘텐츠 1개 기준** — 회사 구조만 만들고 실행 안 하는 리스크 방지

---

## 8. 비동기 실행 및 성능 (A3, A5)

### 8.1 비동기 실행 모델 (A3 — council §4-2 사용자 결정)
- **확정**: 경량 중간해 — Vercel maxDuration 연장 + 클라이언트 단계별 순차 호출
- 제목 생성 → 검색 구조 → 본문 생성 → 검수를 각각 별도 POST
- 단계당 1 함수 실행, 타임아웃 내 완료
- 브라우저 이탈 시 중단, content_packages.progress + drafts 저장 상태 기준 재개
- **기각안**: 잡 큐 (Inngest/QStash/Supabase Queues) — 새 벤더 종속, 웹훅 서명 검증 공격면

### 8.2 성능 기준 (A5)
- **측정 대상**: 생성 시작 피드백 < 1초 + 단계별 진행 상태 가시화 + 완료 알림 도달
- AI 호출량 일일 기준선 (재생성 폭주 감지)
- 단계 경계 = 서킷브레이커 예산 체크 지점

### 8.3 AI 비용 서킷브레이커 (A2, DEC-007)
- 소프트 임계(알림) → 하드 캡(신규 생성 차단) 2단계
- 진행 중 파이프라인은 단계 경계에서 예산 체크 후 soft-stop
- 차단 상태의 HQ 헤더 알림 UI

**경로**: docs/planning/loop/revision-request-02.md §A3, §A5, §A2

---

## 9. Compliance Engine (02-trd.md §2.5)

### 9.1 검수 규칙 (policy_rules 테이블)
- **규칙 1**: 쇼핑커넥트 링크 존재 → 대가성 문구 필수 (본문 상단)
- **규칙 2**: 가격 포함 → price_checked_at 필수 + "기준일 기준, 변동 가능" 표현
- **규칙 3**: 상품명·스펙·이미지 출처 명시, 클레임 근거
- **규칙 4**: 금지 표현 (100%, 무조건, 완벽, 최저가, 1위, 최고, 0원, 미사용 후기, 건강 효능 단정, 의료·투자 조언)
- **규칙 5**: 본문 첫 화면에서 약속 회수, 낚시성 (AI 루브릭)

### 9.2 검수 출력 (compliance_checks)
- pass (true/false)
- risk_level (low / medium / high)
- issues 배열 (type, field, severity, message, suggested_fix)
- export_allowed (high risk 0건 + medium 사용자 확인 완료)

### 9.3 이슈 처리 (compliance_issues)
- **high**: dismiss 금지
- **medium**: dismiss_reason 필수
- **low**: 원클릭 dismiss + 감사 이력 기록

---

## 10. Phase 구조 (06-tasks.md)

### 10.1 Phase 0: 프로젝트 셋업
- **P0-T1**: Next.js + Prisma + Supabase 초기화, 28개 모델 + PackageStatus enum + StatusTransition
- **P0-T2**: 공통 인프라 (통일 API 응답, 에러 핸들러, AI Adapter, Naver API 클라이언트)

### 10.2 Phase 1: 공통 기반
- **P1-R1**: 인증 API (jose signed-cookie)
- **P1-R2**: company_profile Resource
- **P1-S0**: 공통 레이아웃 + 네비게이션

### 10.3 Phase 2: 기회 발굴 루프
- **P2-R1**: Hermes 기회 메모 + 키워드 클러스터 (네이버 API, 4축 점수)
- **P2-R2**: paperclip_decisions (의사결정)
- **P2-R3**: products + shopping_connect_links (CRUD + URL 크롤링)
- **P2-S1**: 상품/링크 화면 + 검증
- **P2-S2**: 설정 화면 + 검증

### 10.4 Phase 3: 콘텐츠 생성+검수+Export
- **P3-R1**: Content Engine (Master Content Engine + Channel Profiles)
- **P3-R2**: Compliance Engine
- **P3-R3**: Export Bundle
- **P3-S1**: 콘텐츠 상세 화면 + 검증

### 10.5 Phase 4: HQ 대시보드+성과
- **P4-R1**: HQ 브리핑
- **P4-R2**: 성과 분석
- **P4-R3**: Company Memory
- **P4-S1**: HQ 메인 화면 + 검증
- **P4-S2**: 성과 기록 화면 + 검증

**경로**: docs/planning/06-tasks.md 전체

---

## 11. MVP 제외 기능 (Won't, 01-prd.md §5)

- 네이버 블로그 자동 발행 (API 종료)
- Instagram/Threads/X 자동 발행 (OAuth, 권한, 정책 복잡도)
- 쇼핑커넥트 자동 스크래핑 (로그인/약관/권한 리스크)
- 완전 자동 대량 발행 (홈피드 숨김, 저품질 리스크)
- 멀티유저 SaaS (1인 회사 운영)
- 결제/구독 시스템 (SaaS 아님)
- 만세력 엔진 (수익형 미디어커머스 핵심과 분리)
- 영상 자동 생성 (초기는 클립 대본만)

---

## 12. 미합의 쟁점 (⚖️ council-report §4 — 반영 금지)

1. 승인 워크플로 방향 (상태 추가 vs 화면 삭제)
2. 비동기 실행 수단 (잡 큐 vs 경량 중간해) — **사용자 결정: 경량 중간해 확정 (A3)**
3. 멀티테넌시 owner_id 컬럼 — **종결: workspaces v2 전방 호환만 (B-platform)**
4. 4축 점수 이중 저장 의미론
5. 칸반 예외 상태 노출 방식
6. P2-S1 URL 붙여넣기 존속 여부
7. raw_items 저장 범위·법률 검토
8. Prompt Injection 투자 수위

**경로**: docs/planning/loop/revision-request-02.md §F

---

## 13. 요약 통계

- **핵심 계획 문서**: 12개 (00-10, loop 문서들)
- **스펙 파일**: 9개 (specs/**/*.yaml)
- **총 데이터베이스 테이블**: 28개
- **MVP 화면**: 5개 (HQ, 콘텐츠 상세, 상품, 성과, 설정)
- **Phase**: 5개 (P0~P4), 총 Task 24개
- **API 리소스**: 15개 (hq_status, opportunity_memos, content_packages, drafts, products, shopping_connect_links, compliance_checks, exports 등)
- **운영 원칙**: 11개
- **보안 체크리스트**: 5개 (P0 필수)

---

## 문서 추적

| 문서 경로 | 주요 내용 | 처리 |
|-----------|----------|------|
| docs/planning/00-source-plan.md | 제품 정의, MVP 범위, 워크플로우, 엔진 설계 | ✅ 읽음 |
| docs/planning/01-prd.md | 제품 요구사항, 13개 MVP 기능, 운영 원칙 | ✅ 읽음 |
| docs/planning/02-trd.md | 기술 스택, 엔진 설계, API 계약, 보안 | ✅ 읽음 (부분) |
| docs/planning/03-user-flow.md | 사용자 흐름, 예외 처리 | 미완 |
| docs/planning/04-database-design.md | 28개 테이블, Prisma 스키마 | ✅ 읽음 (부분) |
| docs/planning/05-design-system.md | 디자인 시스템, 색상, 타이포 | 미완 |
| docs/planning/06-screens.md | 5개 화면 상세 설계 | ✅ 읽음 (부분) |
| docs/planning/06-tasks.md | Phase 구조, 24개 Task, 병렬 실행 | ✅ 읽음 (부분) |
| docs/planning/07-coding-convention.md | 코딩 규칙 | 미완 |
| docs/planning/08-business-model.md | 비즈니스 모델 | 미완 |
| docs/planning/09-personas.md | 페르소나 | 미완 |
| docs/planning/10-desire-map.md | 욕망 지도 | 미완 |
| docs/planning/loop/revision-request-02.md | Council 합의사항 (A~F 섹션) | ✅ 읽음 |
| docs/planning/loop/final-planning-approval.md | 최종 승인 | 미완 |
| specs/domain/resources.yaml | API 리소스 계약 | ✅ 읽음 (부분) |
| specs/screens/hq-main.yaml | HQ 메인 화면 계약 | ✅ 읽음 |
| specs/screens/content-detail.yaml | 콘텐츠 상세 화면 | 미완 |
| specs/screens/products.yaml | 상품 화면 | 미완 |
| specs/screens/performance.yaml | 성과 화면 | 미완 |
| specs/screens/settings.yaml | 설정 화면 | 미완 |
| specs/shared/types.yaml | 공통 타입 (PackageStatus enum 등) | 미완 |

---

**다음 단계**: Lane B (소스 구현 inventory)와 비교하여 Gap 분석
