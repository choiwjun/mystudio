# Planning Loop Report — Round 1

> 산출: `docs/planning/loop/planning-loop-report.md` (라운드마다 갱신/누적)

## 0. Meta

- Project: Paperclip Company OS v0.7
- Planning line: socrates (01-prd 문제 정리 + 09-personas JTBD + 10-desire-map MoSCoW 구조)
- Iteration: 1 / 3
- Generated: 2026-07-02

## 1. Inventory (LOOP 0~1)

| 문서 | 상태 | 비고 |
|---|---|---|
| 00-source-plan.md | present | v0.7 기준 문서 (source of truth), 확정 결정사항 표 포함 |
| 01-prd.md | present | Must/Should/Could/Won't + 기능 13개 + 완료조건 |
| 02-trd.md | present | 스택 확정, 엔진 6개, AI 어댑터, 성능 기준 |
| 03-user-flow.md | present | 15단계 + 상태전이 + 예외흐름 4종 |
| 04-database-design.md | present | Prisma 스키마 — 화면 필요 필드/테이블 누락 (하드페일 원인) |
| 05-design-system.md | present | "하루 30분" 원칙을 설계 1원칙으로 명문화 |
| 06-screens.md | present | 화면 5개 + Phase 2 2개 |
| 07-coding-convention.md | present | tsconfig/디렉토리/API/에러/로깅 |
| 08-business-model.md | present | 수익 계산 자기모순 있음 (비차단) |
| 09-personas.md | present | 페르소나 1개 (MVP 오너=사용자) |
| 10-desire-map.md | present | Must 13개 ↔ 문제 연결 근거 |
| specs/screens/*.yaml | present | index + 5개 화면 (hq-main, content-detail, products, performance, settings) |
| specs/domain/resources.yaml | present | 리소스 17개, API 계약 |
| specs/shared/components.yaml, types.yaml | present | 공용 컴포넌트 20개, 타입 7종 |
| 06-tasks.md | present | 실제 24개 태스크 (문서 헤더 "27개"는 산술 오류) |

## 2. Document Role Validation (LOOP 2)

| 문서 | 점수 | 근거 |
|---|---|---|
| 01-prd (제품 목표/요구사항) | 5 | 한 줄 문제("혼자서 매일 … 지속이 안 된다", §문제 정리) + MoSCoW 4분면 + 기능 13개 각각에 완료 조건("H2 3~4개, FAQ 3개, 비교표 1개 최소", §5) + 리스크 11건 + 검증 가능한 성공 기준("30분 안에 선택 및 게시 준비", §7) |
| 02-trd (기술 구조/제약) | 5 | 스택 전 항목 확정·이유 명시(§기술 스택), 계층 구조도(§1), 엔진별 API·처리 로직(§2), AI 어댑터 인터페이스 코드(§5), 통일 응답 포맷(§6), 성능 기준 수치(§9: HQ<2초, Draft<10초), 폴백 설계(§2.2) |
| 03-user-flow (성공/실패/예외) | 5 | 성공 15단계에 단계별 API·소요시간, 상태전이 기본/예외 경로(§2), 예외흐름 4종(검수 실패·API 장애·가격 오래됨·클립 태그, §3), 입력 최소화 필드 명세(§4) |
| 04-database-design (데이터 모델/관계) | 3 | 핵심 11개 모델·관계도·인덱스·보존정책은 상세하나: exports/title_candidates 테이블 부재(resources.yaml·02-trd §4 요구), Draft에 comparison_table·faq 없음, ContentPackage에 progress·published_at 없음, OpportunitMemo(오탈자)에 risk 수치 축 없음, `String[]?` 등 Prisma 문법 오류, "29개" 헤더 vs 실제 25개 |
| 05-design-system (UI 규칙) | 5 | 컬러 hex+용도 규칙(§1), 타이포 크기/가중치/용례(§2), 컴포넌트별 픽셀 스펙(§3), breakpoints(§4), WCAG 대비 수치(§6), "하루 30분 입력 최소화"를 1원칙으로 예시까지 제시(§핵심 설계 원칙) |
| 06-screens + specs (화면 요구/상태) | 4 | 5개 화면 레이아웃·컴포넌트·픽셀 명세 + yaml에 data_requirements/actions/tests 완비. 감점: 로딩/빈/에러 상태 미정의(05 §7 애니메이션에 스치듯만), content-detail.yaml에 P3-S1-V가 필수 지정한 high-risk 시나리오 부재, 사이드바 하위 메뉴 목적지 화면 없음 |
| 06-tasks (실행 가능 단위) | 4 | 24개 전부 담당/의존/브랜치/Given-When-Then acceptance 명시, 의존 그래프·병렬 규칙·크리티컬 패스 제공. 감점: 프로젝트 요약이 PRD와 충돌("홈플러스·쿠팡 판매자"), 태스크 수 27 오기, `awaiting_export` 미정의 상태 사용, Vercel Cron 등록 태스크 부재 |
| 07-coding-convention (구현 규칙) | 4 | tsconfig strict 전체, 디렉토리 트리, API 라우트 전체 예시, 에러 클래스, 로깅 함수까지 실행 수준. 감점: Prisma 접근 예시가 snake_case(`db.opportunity_memos`)로 04의 PascalCase 모델과 불일치 → 예시 복붙 시 컴파일 실패 |

## 3. Cross-Document Consistency (LOOP 3)

> 상세 근거·라우팅은 document-gap-report.md §2~§6. 요약:

| # | 검사 | 결과 |
|---|---|---|
| C1 | PRD Must 13 ↔ User Flow | **통과** — 기능 1~7, 10~13이 03의 1~15단계에 전부 등장 (기능 8·9는 PRD가 Phase 2로 명시, 03의 9단계도 "Phase 2" 표기 일치) |
| C2 | User Flow 행동 ↔ Screens | **부분 통과** — 핵심 루프(스캔→검토→선택→생성→검수→Export→게시→기록)는 5개 화면·yaml 액션으로 전부 존재. 불일치: 클릭 수 필수/선택 3원화(03 §4 optional vs performance.yaml required vs P4-S2 필수 2개), stale 기준 30일(03) vs 7일(products.yaml·P2-R3), 사이드바 하위 메뉴(Reports 등) 목적지 화면 없음 |
| C3 | Screens 데이터 ↔ 04 DB + resources.yaml | **실패(하드페일)** — 화면이 요구하고 resources.yaml에 있으나 04에 없는 것: drafts.comparison_table/faq, content_packages.progress/published_at, opportunity_memos.risk_score, exports·title_candidates·hq_briefing 테이블. 네이밍 단절: resources `*_score` vs 04 `*Fit`. (revenue_summary/winning_patterns/refresh_needed는 resources.yaml notes에 "파생" 명시 → 정상) |
| C4 | TRD 기술 선택 ↔ 06-tasks | **통과** — Next.js API Routes/Prisma/Supabase/Vercel/AI 어댑터/NextAuth 모두 동일(06-tasks 기술 스택 표 = 02-trd 표). 유일한 틈: TRD Job Runner "Vercel Cron"에 대응하는 cron 등록 태스크 부재(충돌은 아니고 누락) |
| C5 | 06-tasks 24개 ↔ PRD Must 커버리지 | **통과** — 기능1→P4-R1/S1, 2·3→P2-R1, 4·5→P3-R1(optimizers), 6→P2-R3/S1, 7→P3-R1, 10→P3-R2, 11→P3-R3, 12→P4-R2/S2, 13→P4-R3, API 연동→P0-T2. 태스크 없는 Must 없음 |
| C6 | 4축 점수 모델 일관성 | **부분 통과** — 00 §16, 01 §5, 02 §2.2, 03 1단계, resources.yaml, types.yaml ScoreAxis, hq-main/content-detail 모두 4축+근거 문장. 11변수 공식은 00 §7.5·§16에서 "Phase 4+ 참고용 보존"으로만 존재 — 잘못 남은 곳 없음. 유일한 이탈: 04 DB가 3축(fit)+riskFlags로 risk 수치 축 누락 |
| C7 | 하루 30분 제약 ↔ 화면 명세 | **통과** — 05 §핵심 설계 원칙(1순위 명문화), 06-screens §1 목적("30분 안에 완료"), products.yaml(URL 붙여넣기 자동 크롤링), performance.yaml(필수 2~3 + 선택 2), settings 제외 전 화면에 입력 최소화 반영 |
| C8 | 상태값 머신 | **실패** — 00 §10(16단계+예외 11종) vs types.yaml PackageStatus(6개) vs 06-tasks `awaiting_export`/`hold`(어디에도 미정의). 06-tasks 스스로 "00 10장 준수 변경 금지" 선언과 모순 |
| C9 | 문서 자기 정합 | **부분 실패** — 06-tasks 요약("홈플러스·쿠팡 판매자") ↔ 01-prd 제품 정의 충돌, 태스크 수 27 vs 실제 24, 04 "29개" vs 실제 25개, 08-business-model 수익 계산 자기모순(₩6,000 vs 목표 ₩500,000 — 문서 스스로 인지, 비차단) |

## 4. Quality Scores (LOOP 5)

| # | 항목 | 점수 | 핵심? | 근거 | 수정 액션 |
|---|---|---|---|---|---|
| 1 | Product Clarity | 5 | ★ | 01-prd 한 줄 문제 + 10-desire-map §3 JTBD("매일 아침 30분 … 패키지로 받으면") + 00 §21 최종 정의가 전 문서에서 동일하게 반복됨 | 없음 |
| 2 | Requirement Completeness | 4 | ★ | 기능 13개 전부 완료 조건 보유(01 §5), 리스크·폴백까지 요구화(01 §6). 빈틈: Export SNS 형식의 Phase 1 내용물 미정의(기능11 vs content-detail.yaml "phase 2 feature"), Vercel Cron 요구가 태스크로 미전개 | 기능11 완료조건을 "3형식+SNS(Phase 2)"로 정정, cron을 P2-R1에 명시 |
| 3 | Technical Feasibility | 4 | ★ | 확정 스택(02 §기술 스택) 전부 검증된 조합, AI 미결은 어댑터 패턴(02 §5)으로 격리, 성능 기준 현실적(§9). 감점: 04 Prisma 스키마를 그대로 쓰면 마이그레이션 실패(오탈자·optional list·역relation 누락 — gap-report §5) | 04 스키마 문법 오류 5건 수정 후 P0-T1 착수 |
| 4 | User Flow Coverage | 5 | ★ | 03이 성공 15단계 + 보류/폐기 + 검수 실패 재순환 + API 장애 폴백 + 가격 stale 갱신까지 커버, 각 단계에 API·시간 명시 | 없음 (stale 30일→7일 표기만 정정) |
| 5 | Data Model Fit | 3 |  | 핵심 11모델·관계도·인덱스·보존정책은 우수하나 화면 계약(resources.yaml) 대비 테이블 3개·필드 7개 누락, 네이밍 이원화(fit vs score), keyword_clusters 연결 키 불일치 (gap-report §6) | 04를 resources.yaml 기준으로 정렬 (Top 우선순위 1) |
| 6 | UI / Screen Completeness | 4 |  | 5개 화면 전부 yaml 명세(data_requirements/components/actions/navigation/tests) + 06-screens 픽셀 수준 상세. 감점: 로딩/빈/에러 상태 미정의, high-risk Export 테스트 시나리오 부재, 사이드바 하위 메뉴 목적지 없음 | content-detail.yaml 시나리오 추가, 빈/로딩 상태 규칙 1절 추가 |
| 7 | Design System Applicability | 5 |  | 05가 컬러 hex·용도, 타이포 px·weight, 컴포넌트 픽셀 스펙, breakpoints, WCAG 대비 수치까지 제공 — 구현자가 즉시 토큰화 가능. 상태 라벨 색이 상태값과 매핑됨(§1 사용 규칙) | 없음 |
| 8 | Task Executability | 4 | ★ | 24개 전부 담당·의존·브랜치·Given/When/Then, 의존 그래프 순환 없음, 크리티컬 패스 명시. 감점: 산술 오류(27 vs 24), 미정의 상태 `awaiting_export`, P3-R1 과대(7 엔드포인트+AI 7종) | 집계 정정, 상태 용어 정정, P3-R1 3분할 권고 |
| 9 | Testability | 4 |  | 화면 yaml마다 tests 섹션(총 15개 시나리오) + acceptance가 관측 가능한 조건(HTTP 코드, 테이블 기록, UI 상태). 감점: P3-S1-V가 참조한 "high risk Export 비활성화" 시나리오가 원본 yaml에 없어 검증 근거 단절 1건 | 시나리오 추가 후 P3-S1-V 재연결 |
| 10 | Traceability | 3 | ★ | Loop Metadata(상류/하류)가 전 문서에 있고 C1·C5는 완전 추적. 그러나 요구→데이터 체인이 04에서 7곳 단절(risk_score, comparison_table/faq, progress, exports, title_candidates, hq_briefing, 네이밍 fit/score) + 상태값 3원화로 요구→상태→칸반 추적 불가 (gap-report §6) | 04 정렬 + types.yaml 상태 매핑표 — 해소 시 4~5점 재평가 |
| 11 | Consistency | 3 |  | 스택·4축·30분 원칙은 전 문서 일관. 그러나 06-tasks 제품 요약 충돌(홈플러스·쿠팡), 태스크 수·테이블 수 산술 오류, clicks 필수/선택 3원화, decision 값 표기(on_hold/hold), stale 7일/30일 (gap-report §3~4) | 06-tasks 요약 교체 + 표기 통일 패치 |
| 12 | Scope Control | 4 |  | Won't 8건에 각각 제외 사유(10-desire-map §5), Phase 경계 명확(01 MoSCoW, 06-tasks "Phase 2는 이 문서 범위 외"), 하루 5개·1일 1콘텐츠 상한(01 §4). 감점: Export SNS 형식 1건이 Must/Phase2 경계에 걸침 | 기능11 완료조건 정정과 동일 |
| 13 | Implementation Readiness | 4 | ★ | 시작점 명확(P0-T1: 프로젝트 생성→스키마→마이그레이션, acceptance에 실행 명령까지), 07에 tsconfig·디렉토리·.env.example 완비, 배포 규칙(06-tasks §병합)까지 존재. 감점: P0-T1이 참조할 04 스키마가 현재 상태로는 실패 → 첫 태스크가 문서 수정 없이 착수 불가 | 04 수정을 P0-T1 선행 조건으로 게이트화 |

- **핵심 7개**: Product Clarity 5 / Requirement Completeness 4 / Technical Feasibility 4 / User Flow Coverage 5 / Task Executability 4 / **Traceability 3 (미달, 기준 ≥4)** / Implementation Readiness 4
- **비핵심 6개**: Data Model Fit 3 / UI Screen 4 / Design System 5 / Testability 4 / Consistency 3 / Scope Control 4 — 전원 기준(≥3) 충족

- **Hard fails**: **1건**
  - [HF-3] Screens 데이터가 DB에 없음 — specs/screens가 요구하는 drafts.comparison_table·faq, content_packages.progress·published_at, opportunity_memos.risk_score 및 exports·title_candidates·hq_briefing 테이블이 04-database-design에 부재 (근거: gap-report §5~6)
  - 나머지 7종 통과: PRD 기능→Tasks 커버 완전(C5) / Flow 핵심 행동→Screens 존재(C2) / TRD-Tasks 스택 무충돌(C4) / 과대 태스크는 P3-R1 경계선(분할 권고, 검증 가능하므로 하드페일 아님) / acceptance 측정 가능(참조 단절 1건은 시나리오 추가로 해소) / MVP 범위 명확(MoSCoW+Won't 사유) / 시작점 명확(P0-T1)

## 5. Traceability Check

| Requirement (PRD 기능) | User Flow | Screen | Data | Task | Test Idea | Status |
|---|---|---|---|---|---|---|
| 1 HQ 메인 | 03 §1 2단계 | hq-main.yaml | hq_status/hq_briefing(**04 테이블 없음**) | P4-R1, P4-S1(+V) | hq-main tests 3종 | ⚠ 데이터 단절 |
| 2 Hermes Memo | 1~3단계 | hq-main memo_cards | opportunity_memos(**risk_score 없음**) | P2-R1 | P2-R1 acceptance 4종 | ⚠ 데이터 단절 |
| 3 주제 점수화 4축 | 3단계 | score_chip (components.yaml) | resources 4축 ↔ 04 3축 fit | P2-R1 | 점수+근거 문장 검증 | ⚠ 네이밍/축 단절 |
| 4 홈판형 제목 | 5단계 | content-detail preview/edit | title_candidates(**04 테이블 없음**) | P3-R1 | 10개+hook_type 검증 | ⚠ 데이터 단절 |
| 5 검색형 구조 | 6단계 | content-detail preview | drafts(**comparison_table/faq 없음**) | P3-R1 | H2/FAQ/비교표 검증 | ⚠ 데이터 단절 |
| 6 상품/링크 | 7단계 | products.yaml | products, shopping_connect_links ✓ | P2-R3, P2-S1(+V) | products tests 4종 | ✅ |
| 7 블로그 원문 | 8단계 | content-detail | drafts.body_markdown/html ✓ | P3-R1 | 생성+자동저장 검증 | ✅ |
| 10 Compliance Gate | 10~11단계 | content-detail compliance 탭 | compliance_checks/issues ✓ | P3-R2 | high→export 차단 검증 | ✅ (화면 시나리오 1건 추가 필요) |
| 11 Export Bundle | 12단계 | content-detail export_panel | exports(**04 테이블 없음**) | P3-R3 | 403/4형식 검증 | ⚠ 데이터 단절 |
| 12 Performance Logger | 14단계 | performance.yaml | performance_logs ✓ | P4-R2, P4-S2(+V) | performance tests 4종 | ✅ (clicks 필수/선택 통일 필요) |
| 13 Company Memory | 15단계 | winning_patterns 블록 | company_memory ✓ | P4-R3 | hook_type 학습 검증 | ✅ |
| 네이버 API 연동 | 1단계 | (백그라운드) | sources/raw_items ✓ | P0-T2, P2-R1 | 폴백/타임아웃 검증 | ✅ (cron 태스크만 보강) |
| 8·9 클립/SNS (Phase 2) | 9단계(Phase 2 표기) | index.yaml phase2 | sns_variants ✓ | 범위 외 명시 | — | ✅ 범위 통제됨 |

## 6. Routing Decisions (LOOP 6)

1. **[HF-3 해소] 04-database-design.md 정렬** → database-specialist(문서 수정) — Export·TitleCandidate 모델 추가, hq_briefing 저장 또는 파생 명시, Draft.comparisonTable/faq·ContentPackage.progress/publishedAt·OpportunityMemo.riskScore/riskReason 추가, `OpportunitMemo` 오탈자·`String[]?`·역relation 5건 수정, 네이밍을 resources.yaml `*_score`로 통일.
2. **types.yaml + 06-tasks 상태값 단일화** → screen-spec/tasks-generator — 00 §10을 정본으로 PackageStatus에 세부상태→칸반컬럼 매핑표 추가, `awaiting_export`·`hold` 표기 정정.
3. **06-tasks 패치** → tasks-generator — 프로젝트 요약을 01-prd 정의로 교체, 총 태스크 24로 정정, P2-R1에 Vercel Cron 등록 추가, P3-R1 3분할 검토.
4. **content-detail.yaml** → screen-spec — tests에 "high risk 시 Export 버튼 비활성화" 시나리오 추가.
5. **표기 통일 소패치** → 각 문서 — clicks 필수/선택(03 기준), stale 7일, decision enum(on_hold), 07 Prisma 접근 예시 camelCase.

## 7. This Round Result

- 통과 핵심 항목: **6/7** (Traceability 3점 미달)
- 하드페일: 1건 (HF-3: Screens 데이터 ↔ DB 부재)
- **판정: 조건부 — 위 라우팅 1~4 반영 전 구현 착수(P0-T1) 금지.** 결함이 04·types·06-tasks·content-detail.yaml 4개 파일의 국소 패치로 해소 가능하고 요구→태스크 커버리지는 완전하므로 재설계 불요.
- 다음 액션: **revision (LOOP 7)** → 수정 반영 후 Round 2 재검증 → 통과 시 gate derivation (LOOP 9)

---

# Planning Loop Report — Round 2 (2026-07-02 10:39~)

## 1. Revision Execution (LOOP 7)

revision-request-01.md R1~R5 전체 실행 (사용자 승인 후, 에이전트 3개 병렬 patch):

| 항목 | 실행 결과 | 증거 |
|---|---|---|
| R1 (하드페일 HF-3) | ✅ 04에 Export·TitleCandidate·HqBriefing 모델 추가, drafts.comparisonTable/faq/firstScreen, content_packages.progress/publishedAt, opportunity_memos.riskScore/scoreReasons 추가, `OpportunitMemo` 오탈자 수정, 4축 `*Score`+@map 통일, 헤더 26개=실제 26 모델 | 04:45(HqBriefing), 04:255(TitleCandidate), 04:270(Export), grep 검증 통과 |
| R2 | ✅ 06-tasks 요약을 01-prd 제품 정의로 교체("홈플러스·쿠팡" 삭제), 총 24개(P0:2/P1:3/P2:7/P3:5/P4:7) 정정 | grep '홈플러스\|쿠팡\|27개' → 0건 |
| R3 | ✅ types.yaml PackageStatus를 00 §10 정본(메인 18 + 예외 11)으로 단일화 + 칸반 매핑표 추가, 06-tasks `awaiting_export`→`approved` 2곳 치환 | types.yaml PackageStatus 절, 06-tasks:281,432 |
| R4 | ✅ content-detail.yaml tests에 "검수 실패 시 Export 차단" 시나리오 추가 | content-detail.yaml:220 |
| R5 | ✅ P2-R1 acceptance에 Vercel Cron(매일 06:00 KST) 추가, clicks 필수 통일(03:322,566 + 06-tasks P4-S2), stale 7일 통일(03:430, 04 주석) | 각 라인 grep 검증 |

**감독관 직접 후속 패치 (Round 2 재검증 중 발견분)**:
1. 04 Prisma 잔존 오류 — relation 필드의 잘못된 `@map` 17곳 → FK 스칼라로 이동, `String[]?` 6곳 → `String[]` (스크립트 패치, grep 재검증 0건)
2. 06-tasks:273 decision `"hold"` → `"on_hold"` (04:127 enum 정본 기준)
3. 06-tasks:533 "선택 입력 1개(direct_revenue, hook_type)" → "선택 입력 2개" (산술 정정)
4. 03:508 "30일 미만이므로 warning" → "7일 초과(stale)이므로 warning" (stale 7일 기준 정렬)
5. **keyword_clusters 연결 키 단일화** (gap-report §6 잔존 건): 04 KeywordCluster를 resources.yaml 계약 기준으로 정렬 — `topicId` → `opportunityMemoId`, 필드명 `relatedKeywords`/`competitionScore`로 통일, 관계도 갱신

## 2. Re-evaluation (LOOP 8, iteration 2)

| 검사 | Round 1 | Round 2 | 근거 |
|---|---|---|---|
| C3 Screens↔DB (하드페일) | 실패 | **통과** | 04 26모델 = resources.yaml 계약 정렬, 누락 테이블/필드 0건 (grep 검증) |
| C8 상태값 머신 | 실패 | **통과** | types.yaml = 00 §10 (29 상태 + 칸반 매핑), 미정의 상태 0건 |
| C9 문서 자기 정합 | 부분 실패 | **통과** | 06-tasks 요약·집계 정정, 04 헤더 26=실제 26 |
| C2 Flow↔Screens 표기 | 부분 통과 | **통과** | clicks 필수·stale 7일·decision on_hold 통일 |

**갱신 점수** (변경 항목만):
- Data Model Fit 3 → **5** (계약 정렬 + 문법 오류 0 + 연결 키 단일화)
- Traceability 3 → **5** (요구→데이터 체인 단절 7곳 전부 해소, 상태→칸반 매핑 확립)
- Consistency 3 → **5** (충돌·산술 오류·표기 3원화 전부 해소)
- Task Executability 4 → **5** (집계·상태 용어·cron 보강; P3-R1 분할 권고는 유지)
- Implementation Readiness 4 → **5** (P0-T1이 참조할 04 스키마가 유효 Prisma 문법)

- 핵심 7개: 5/4/4/5/5/5/5 — **전원 ≥4 충족**
- 비핵심 6개: 5/4/5/4/5/4 — 전원 ≥3 충족
- **하드페일: 0건**

## 3. Round 2 판정

**통과** — 잔존 리스크 (비차단, 기록):
1. 08-business-model 수익 계산 자기모순(₩6,000 vs 목표 ₩500,000) — 문서 스스로 인지, 설계 차단 아님
2. P3-R1 과대(7 엔드포인트 + AI 생성 7종) — 분할 권고, 빌더가 내부 분할 가능
3. 로딩/빈/에러 상태 화면 규칙 미정의 — 05 §7에 일부만 존재, 구현 시 TDS/디자인 시스템 기본값 적용 가능

**다음 액션: gate derivation (LOOP 9)**

---

# Planning Loop Report — Round 3: Council 질적 리뷰 반영 (2026-07-02 11:30~)

## 1. 트리거

사용자 요청("기획 내용 누락·개선·수정 확인") → `/council` 3인 패널(CTO·UX·Security) 워크플로우 실행 (독립 리뷰 → 교차검증 → 종합). 산출: `docs/planning/council-report.md`. 점수: CTO 5→4, UX 5→4, Security 4→3.5 (교차검증 후 하락 — 구조적 결함 확인).

## 2. 실행 (revision-request-02, 사용자 승인)

전원 합의 19건 + 개선 15건을 A~F 섹션으로 분해, 에이전트 5개 병렬 patch:
- **02-trd**: CRON_SECRET+실행ID 멱등키, AI 비용 2단계 서킷브레이커(§5 신설), 비동기 실행 모델 Open Question(§2.3), 인증 단일화(Bearer 폐기→NextAuth 세션+CSRF+rate limit), 성능 기준 재정의(§9), Markdown 정본+sanitization 이원화, 데이터 접근 경계(§3.5 신설), zod+규칙 override, Company Memory 구조화
- **04-db**: PackageStatus Prisma enum(29상태) + StatusTransition 이력 테이블(27모델), bodyHtml 폐지, faq Json 확정, ComplianceIssue 감사 필드, ErrorLog 마스킹, CompanyMemory 구조화(sampleCount), 보존 정책 통일
- **06-tasks + 08-gates**: P2-R1 Cron 보안 acceptance, P0-T2 보안 체크리스트 5항목, P3-R1 착수 금지 조건, HG-002-4/5·HG-013-4·DEC-007(비용)·DEC-008(zod)·DG-009-3/4 신설, MG-008-1 교체, DEC-003 강화
- **05+06-screens**: 토스트 심각도 분리, 헤더 색상 문법(정상=중립색)+상태 5종 통일, 사이드바 Phase 1 숨김, 터치 타깃 분기, [저장][취소] 제거+[되돌림] 스냅샷, 미기록 배지
- **03+specs**: 예외 흐름 5(빈 프로필 fail-closed), products SSRF 방어+수동 폴백, on_hold 필터 탭+모바일 동선, types.yaml 정본 주석, resources.yaml drafts 정합
- **감독관 후속**: policy_rules 명칭 전 문서 통일, original_body snake_case, P0-T1 스키마 참조 04 정본화(27모델)

## 3. 검증 (iteration 3/3)

- Prisma 문법: `String[]?` 0건, relation@map 0건, enum+이력 테이블 확인
- 명칭: compliance_rules 잔존 0건 (기록 문서 제외)
- ⚖️ 결정 대기 마커: 04·06-screens·products.yaml·types.yaml·revision-request-02 — 미합의 쟁점 선반영 없음 확인

## 4. 판정

**Ready with Risks** — 문서 패키지는 개발 착수 가능하나:
- **P3-R1 착수 차단 조건**: 쟁점 §4-2(비동기 실행 수단) 결정 필요
- **상태 enum 최종 확정 조건**: 쟁점 §4-1(승인 워크플로) 결정 필요 (현 29상태 enum은 중립 상태로 배치)
- 미합의 쟁점 8건: council-report §4 (사용자 결정 대기)
