# Document Gap Report

> 산출: `docs/planning/loop/document-gap-report.md`
> 프로젝트: Paperclip Company OS v0.7 / 검증일: 2026-07-02 / Round 1

## 1. Missing Documents

- 없음. 검토 대상 전부 존재:
  - docs/planning/00-source-plan.md ~ 10-desire-map.md (12개 전부 present, 06-screens.md와 06-tasks.md 번호 중복은 역할 구분으로 무해)
  - specs/domain/resources.yaml, specs/shared/components.yaml, specs/shared/types.yaml
  - specs/screens/index.yaml, hq-main.yaml, content-detail.yaml, products.yaml, performance.yaml, settings.yaml
- 참고: 06-tasks.md Loop Metadata가 `09-testing-strategy.md`를 하류 문서로 언급하나 해당 파일은 존재하지 않음 (06-tasks.md "Downstream documents affected").

## 2. Missing Features (PRD에 있으나 하류에 없음)

| 기능 | PRD 위치 | 끊긴 단계 | 라우팅 |
|---|---|---|---|
| Vercel Cron 매일 06:00 Hermes 자동 스캔 | 01-prd §5 기능2 "네이버 검색 API 실데이터" + 02-trd §2.2 "Vercel Cron 매일 아침 6시 실행", 03-user-flow 1단계 | 06-tasks.md에 cron 설정/등록 태스크 없음 (P2-R1은 `POST /api/hermes/scan` 엔드포인트만, vercel.json cron 구성 미언급) | tasks-generator — P2-R1 구현 대상에 "Vercel Cron 등록(vercel.json)" 추가 |
| Export "SNS 복사용" 4번째 형식 (Phase 1 Must) | 01-prd §5 기능11 완료조건 "4가지 형식 모두 제공" (Must) | sns_variants는 Phase 2인데(01-prd 기능9) SNS 복사본의 Phase 1 내용물이 정의 안 됨. content-detail.yaml export_sns는 `trigger: phase 2 feature`로 명시 → PRD 완료조건과 충돌 | socrates/screen-spec — PRD 기능11을 "3형식 + (Phase 2) SNS"로 수정하거나 P3-R3에 SNS 형식 스텁 정의 |
| 사이드바 하위 메뉴 화면 (Hermes 키워드 스캔·경쟁 콘텐츠, Compliance 정책 룰, Memory 성공/실패 패턴, Reports 일간/주간/월간) | 00-source-plan §12.3, 03-user-flow 2단계, 06-screens §1.2 | specs/screens/index.yaml 화면 5개(+Phase2 2개)에 해당 라우트 없음, 06-tasks에도 없음 → 네비게이션 목적지 부재 | screen-spec — P1-S0 사이드바를 Phase 1 화면 5개로 축소하거나 "준비 중" 처리 명세 추가 |

## 3. Ambiguous Requirements

| 항목 | 위치 | 왜 모호한가 | 보강 액션 |
|---|---|---|---|
| 클릭 수 필수/선택 | 03-user-flow §4 "필드 4: 클릭 수 (optional)" vs specs/screens/performance.yaml `clicks_input.required: true` vs 06-tasks P4-S2 "필수 입력 2개(post_url, views)" | 3개 문서가 서로 다름 (optional / required / 필수 2개에 미포함) — 유효성 검사 구현 불가 | 03-user-flow 기준(선택)으로 performance.yaml·P4-S2 통일 권고 |
| paperclip_decisions.decision 값 | 00-source-plan §10 / 02-trd §3 `on_hold` vs 06-tasks P2-R2 `decision: "hold"` vs hq-main.yaml `create decision (hold)` | enum 값 표기 불일치 → API 계약 모호 | resources.yaml에 decision enum(selected/on_hold/rejected) 명시 |
| company_profile 미존재 시 동작 | 06-tasks P1-R2 acceptance "404 또는 초기값 반환 (정책 결정)" | 정책이 미결인 채 acceptance에 남음 → 테스트 기대값 2개 | 시드 데이터(04 마이그레이션 체크리스트 "시드 데이터: CompanyProfile 기본값")와 일치시켜 "초기값 반환"으로 확정 |
| 성과 수집 시점 | 03-user-flow 14단계 "조회수 (2시간 후)" + Loop Metadata Open question "2시간 vs 하루?" | 지난주 요약 계산 기준 시점 불명 | 운영 정책 문서화 (recorded_at 기준 집계로 충분함을 명시) |
| stale 기준 30일 vs 7일 | 03-user-flow 예외상태 "stale: 가격 기준일이 30일 이상" vs products.yaml/resources.yaml/06-tasks P2-R3 "price_checked_at > 7일" | 갱신 필요 판정 임계값이 문서 간 4배 차이 | 7일(다수 문서) 기준으로 03-user-flow 수정 |

## 4. Conflicts (문서 간 충돌)

| A 문서/항목 | B 문서/항목 | 충돌 내용 | 해소 방향 |
|---|---|---|---|
| 06-tasks.md 프로젝트 요약 "홈플러스·쿠팡 판매자를 위한 AI 기반 콘텐츠 생성 플랫폼" | 01-prd §1 "1인 AI 미디어커머스 운영 시스템" / 09-personas (블로거 김수민) / 08-business-model "쿠팡은 향후 다각화 검토" | 대상 사용자 정의가 정면 충돌. 쿠팡·홈플러스는 어느 상위 문서에도 MVP 대상이 아님 | 06-tasks 요약 문단을 PRD 정의로 교체 (tasks-generator) |
| specs/shared/types.yaml PackageStatus enum 6개 (opportunity/in_progress/in_review/awaiting_approval/published/archived) | 00-source-plan §10 상태값 머신 (opportunity_found→…→memory_updated 16단계 + 예외 11종) + 06-tasks 결정사항 5 "상태값 머신: 00-source-plan 10장 준수 (변경 금지)" | 태스크는 00 준수를 선언했는데 types.yaml은 별도 6-state를 정의. 게다가 06-tasks 자체가 `awaiting_export`(P2-R2, P3-S1)라는 어느 문서에도 없는 상태를 사용 | types.yaml enum을 "칸반 컬럼 뷰 매핑"으로 재정의하고 세부 상태→컬럼 매핑표 추가, `awaiting_export` 제거 또는 00 §10에 등재 |
| specs/domain/resources.yaml opportunity_memos 필드 `homefeed_score/search_score/revenue_score/risk_score + score_reasons` | 04-database-design OpportunitMemo: `homefeedFit/searchFit/shoppingConnectFit` + 개별 reason, **risk 축 수치 필드 없음**(riskFlags 문자열 배열만) | API 계약(4축 score)과 DB 스키마(3축 fit + flags)가 이름·구조 모두 불일치. 00-source-plan §9은 compliance_risk_score를 포함하므로 04가 이탈 | 04 스키마를 resources.yaml 4축 네이밍으로 정렬 + riskScore/riskReason 추가 (database-specialist 문서 수정) |
| 06-tasks 헤더 "총 Task: 27개" / 집계표 P4 합계 "10" | 실제 태스크 수: P0 2 + P1 3 + P2 7 + P3 5 + P4 7 = **24개** (P4는 R3+S2+V2=7). 집계표 세로합(11R+6S+5V+P0 2)도 24 | 자기모순 산술 오류 (27 ≠ 24, P4 10 ≠ 7) | 헤더·집계표를 24로 정정 |
| 06-tasks P3-S1-V "검증 대상: content-detail.yaml tests 섹션 (4개 시나리오, 특히 high risk Export 비활성화)" | specs/screens/content-detail.yaml tests: 4개 시나리오 중 high risk 비활성화 시나리오 **없음** ("Export 가능 여부 확인"은 export_allowed=true 케이스만) | 필수라고 명시한 검증 시나리오의 원본이 스펙에 부재 | content-detail.yaml tests에 "high risk 시 Export 버튼 비활성화" 시나리오 추가 (screen-spec) |
| 08-business-model §3 "월 수익 목표 ₩500,000" | 같은 문서 계산 "12 구매 × 20,000 × 2.5% = ₩6,000/월? → 더 높은 조회수 or 더 비싼 상품 필요" + §7 "Month 1~3 AI 모델: $0" vs §6 "월 $50 미만" | 목표와 자체 계산이 80배 괴리(문서 스스로 인지), AI 비용 $0 vs $0.5~50 상충 | 08 수익 모델 재산정 — MVP 판정에는 비차단(제품 기능 아님) |
| 07-coding-convention §8 `db.opportunity_memos.findMany` (snake_case client 접근) | 04-database-design Prisma 모델 PascalCase + @@map → 실제 클라이언트는 `db.opportunityMemo` | 예제 코드가 Prisma 동작과 불일치 → 복붙 시 컴파일 실패 | 07 예제를 camelCase 모델 접근으로 수정 |

## 5. Implementation-blocking Gaps

- **구현 불가능한 task**: 없음 (24개 모두 스택·의존·엔드포인트 명시). 단 P0-T1은 04-database-design을 그대로 쓰면 아래 Prisma 오류로 마이그레이션 실패:
  - 04:77 `model OpportunitMemo` — 모델명 오탈자(OpportunityMemo)
  - 04:191,193 `String[]?` (homefeedTitle, thumbnailText), 04:228 `hashtags String[]?` — Prisma는 optional list 미지원 → 스키마 검증 에러
  - 04:242 Product→Topic relation "TopicProducts", 04:351 RevenueLog→Product "ProductRevenue" — 역방향 relation 필드가 Topic/Product 모델에 없음 → 검증 에러
  - 04:270 ShoppingConnectLink.contentPackageId — relation 미정의 고아 FK
- **테스트 불가능한 acceptance**: P3-S1-V의 "high risk Export 비활성화" — 검증 원본 시나리오가 content-detail.yaml에 없음 (시나리오 추가로 해소 가능). 나머지 acceptance는 Given/When/Then으로 측정 가능.
- **DB에 없는 화면 데이터** (하드페일 — 상세는 §6):
  - `drafts.comparison_table`, `drafts.faq` — content-detail.yaml preview 탭 필요, 04 Draft 모델에 없음
  - `content_packages.progress`, `content_packages.published_at`, `topic` — hq-main.yaml 칸반 필요, 04 ContentPackage에 없음 (topic은 relation으로 대체 가능하나 progress/published_at은 부재)
  - `opportunity_memos.risk_score` — hq-main/content-detail memo 카드 4축 필요, 04에 수치 필드 없음
  - `exports` 테이블 — resources.yaml/content-detail.yaml/02-trd §4("exports 테이블에 기록")/00 §9 목록에 있으나 04 테이블 목록·스키마 모두 누락
  - `title_candidates` 테이블 — resources.yaml·P0-T1·P3-R1이 요구하나 04에 없음
  - `hq_briefing` 저장 구조 — resources.yaml 필드(id,date,goals…)와 P4-R1 구현 대상이나 04에 테이블 없음 (파생 리소스 주석도 없음; revenue_summary/winning_patterns/refresh_needed는 resources.yaml notes에 "파생" 명시라 무해)
  - 참고: 04 헤더 "테이블 목록 (29개)"이나 실제 나열 25개 — 집계 오류
- **화면에 없는 사용자 흐름**: 사이드바 하위 메뉴 7그룹 중 Hermes 하위(키워드 스캔·상품 후보·경쟁 콘텐츠), Compliance 하위, Memory 하위, Reports 전체 — 03-user-flow 2단계와 06-screens §1.2가 명시하나 화면 스펙·태스크 없음 (핵심 루프인 선택→생성→검수→Export→기록 흐름 자체는 5개 화면으로 전부 커버됨).
- **기술 설계와 안 맞는 기능**: 없음 — 06-tasks 기술 스택 표는 02-trd와 완전 일치 (Next.js API Routes/Prisma/Supabase/Vercel/AI Adapter).
- **과도하게 큰 task**: P3-R1 (Master Content Engine) — 엔드포인트 7개 + AI 산출물 7종 + 자동저장 + optimizers 2개를 단일 태스크(5d)로 묶음. 분할 권고: (a) 패키지 CRUD+상태머신 (b) AI 생성 파이프라인 (c) optimizers/titles·structure. 하드페일 수준은 아님(acceptance가 단계별로 분리돼 있어 검증 가능).
- **개발 순서가 잘못된 task**: 없음 — 의존성 그래프 정합 (P4-S1이 P2-R2·P4-R1/R2/R3에 의존, 순환 없음). 단 P4-R1(HQ 브리핑)이 P2-R2(decisions)를 의존에 누락했는데 hq_status가 pending_approvals를 집계함 — 실제로는 P4-S1 의존으로 흡수되어 비차단.

## 6. Traceability Breaks

| Requirement | 끊긴 지점 | 영향 | 라우팅 |
|---|---|---|---|
| 4축 점수(risk 포함)를 memo 카드에 표시 (01-prd 기능2·3) | resources.yaml `risk_score` → 04 OpportunitMemo에 수치 risk 필드 없음 (riskFlags만) | HQ 메인 memo_card의 Risk 칩 데이터 원천 부재 | 04에 riskScore/riskReason 추가 |
| 비교표·FAQ 생성 (01-prd 기능5·7) | resources.yaml drafts.comparison_table/faq → 04 Draft 모델에 필드 없음 | content-detail 예상 뷰 탭·P3-R1 acceptance(comparison_table, faq 생성) 저장 불가 | 04 Draft에 comparisonTable(Json), faq(Json) 추가 |
| Export Bundle 기록 (01-prd 기능11, 02-trd §4) | 04에 exports 테이블 부재 | P3-R3 acceptance "exports 테이블 저장" 구현 근거 없음 | 04에 Export 모델 추가 |
| 제목 후보 10+5+5 (01-prd 기능4) | resources.yaml title_candidates → 04에 테이블 없음 (P0-T1 목록에는 있음) | P3-R1 `selected=true 1개 선정` 저장처 불명 | 04에 TitleCandidate 모델 추가 |
| 칸반 진행률 표시 (06-screens 블록3 "진행 60%") | hq-main.yaml content_packages.progress → 04 ContentPackage에 progress 없음 | 제작중 컬럼 게이지 렌더 불가 | 04에 progress Int 추가 또는 status 파생 계산 명시 |
| 상태값 머신 (00 §10 → 화면 칸반) | 00 16단계 상태 → types.yaml 6-state → tasks `awaiting_export` | 상태→칸반 컬럼 매핑 미정의, 구현자마다 다르게 해석 | types.yaml에 매핑표 추가 |
| keyword_clusters 연결 키 | resources.yaml `opportunity_memo_id` ↔ 04 KeywordCluster.topicId (Topic 소속) | P2-R1 "memo에 내장 반환" 조인 경로 불명 | 04 또는 resources.yaml 한쪽으로 통일 |

## 7. Summary

- **총 갭 수**: 21건 (누락 기능 3, 모호 요구 5, 충돌 7, 구현 차단성 갭 6그룹)
- **하드페일 유발 갭**: 1종 — "Screens 데이터가 DB에 없음" (§5·§6의 04-database-design 누락 필드/테이블 묶음). 나머지 7종 하드페일 검사는 통과.
- **우선 해결 순위 (Top 3)**:
  1. **04-database-design 정렬** — exports/title_candidates 테이블 추가, Draft.comparison_table·faq, ContentPackage.progress·published_at, OpportunityMemo.riskScore 추가, 필드 네이밍을 resources.yaml(4축 *_score)로 통일, Prisma 문법 오류 5건 수정. (P0-T1 착수 전 필수)
  2. **상태값 단일화** — 00 §10을 정본으로 types.yaml 매핑표 작성, 06-tasks의 `awaiting_export`·`hold` 표기 정정.
  3. **06-tasks 정합 수정** — 프로젝트 요약(홈플러스·쿠팡) 교체, 태스크 수 24로 정정, content-detail.yaml에 high-risk Export 비활성화 테스트 시나리오 추가, Vercel Cron 등록을 P2-R1에 명시.
